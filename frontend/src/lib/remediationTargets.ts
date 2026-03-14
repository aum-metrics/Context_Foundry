"use client";

export interface RemediationPageTarget {
  label: string;
  url: string;
  reason: string;
}

const STOP_WORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "your",
  "their",
  "they",
  "have",
  "has",
  "are",
  "about",
  "around",
  "what",
  "where",
  "which",
  "when",
  "who",
  "why",
  "best",
  "will",
  "would",
  "should",
  "than",
  "over",
  "more",
  "most",
  "clear",
  "proof",
  "page",
  "pages",
  "update",
  "buyer",
  "buyers",
  "enterprise",
  "analytics",
  "consulting",
  "transformation",
]);

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Cloud & data modernization": ["cloud", "data", "modernization", "migration", "databricks", "snowflake", "google", "platform"],
  "Competitive differentiation": ["compare", "competitive", "differentiation", "why", "choose", "positioning", "advantage"],
  "Enterprise transformation fit": ["enterprise", "transformation", "fortune", "governance", "operating", "delivery", "partner"],
  "Industry expertise": ["cpg", "bfsi", "retail", "supply", "chain", "industry", "domain", "vertical"],
  "Site-level GEO readiness": ["home", "about", "services", "solutions", "faq", "case", "partner", "proof"],
  "Market ranking": ["home", "about", "services", "solutions", "overview", "case", "proof"],
};

interface ManifestLinkCandidate {
  label: string;
  url: string;
  sourceType: string;
}

function tokenize(value: string): string[] {
  return (value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function getObjectLabel(record: Record<string, unknown>): string {
  const labelFields = ["name", "headline", "title", "serviceType", "description"];
  for (const field of labelFields) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  const objectType = record["@type"];
  return typeof objectType === "string" && objectType.trim() ? objectType.trim() : "Manifest page";
}

function walkSchema(value: unknown, candidates: ManifestLinkCandidate[]) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => walkSchema(item, candidates));
    return;
  }
  if (typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  const url = record.url;
  if (typeof url === "string" && /^https?:\/\//i.test(url)) {
    candidates.push({
      label: getObjectLabel(record),
      url,
      sourceType: typeof record["@type"] === "string" ? record["@type"] : "Page",
    });
  }

  Object.values(record).forEach((nested) => walkSchema(nested, candidates));
}

function dedupeCandidates(candidates: ManifestLinkCandidate[]): ManifestLinkCandidate[] {
  const seen = new Map<string, ManifestLinkCandidate>();
  candidates.forEach((candidate) => {
    if (!seen.has(candidate.url)) {
      seen.set(candidate.url, candidate);
    }
  });
  return Array.from(seen.values());
}

function buildFallbackTargets(sourceUrl?: string | null, category?: string): RemediationPageTarget[] {
  if (sourceUrl && /^https?:\/\//i.test(sourceUrl)) {
    return [{
      label: "Homepage",
      url: sourceUrl,
      reason: `Best available manifest-backed surface for ${category?.toLowerCase() || "this remediation"}.`,
    }];
  }
  return [{
    label: "Public site homepage",
    url: "",
    reason: `No manifest-linked URLs were found. Start with the public homepage for ${category?.toLowerCase() || "this remediation"}.`,
  }];
}

export function resolveRemediationTargets(params: {
  category: string;
  schemaData?: Record<string, unknown> | null;
  sourceUrl?: string | null;
  missingClaims?: string[];
  limit?: number;
}): RemediationPageTarget[] {
  const {
    category,
    schemaData,
    sourceUrl,
    missingClaims = [],
    limit = 3,
  } = params;

  const rawCandidates: ManifestLinkCandidate[] = [];
  if (schemaData) {
    walkSchema(schemaData, rawCandidates);
  }

  const candidates = dedupeCandidates(rawCandidates);
  if (candidates.length === 0) {
    return buildFallbackTargets(sourceUrl, category);
  }

  const categoryKeywords = CATEGORY_KEYWORDS[category] || CATEGORY_KEYWORDS["Market ranking"];
  const claimKeywords = missingClaims.flatMap((claim) => tokenize(claim)).slice(0, 10);
  const weightedKeywords = Array.from(new Set([...categoryKeywords, ...claimKeywords]));

  let homepageHost = "";
  if (sourceUrl) {
    try {
      const parseUrl = sourceUrl.includes("://") ? sourceUrl : `https://${sourceUrl}`;
      homepageHost = new URL(parseUrl).hostname.replace(/^www\./, "");
    } catch {
      homepageHost = sourceUrl.replace(/^https?:\/\//i, "").replace(/^www\./, "").split('/')[0];
    }
  }

  const scored = candidates.map((candidate) => {
    const haystack = `${candidate.label} ${candidate.url} ${candidate.sourceType}`.toLowerCase();
    const matches = weightedKeywords.filter((keyword) => haystack.includes(keyword));
    const urlPath = (() => {
      try {
        return new URL(candidate.url).pathname.toLowerCase();
      } catch {
        return "";
      }
    })();

    let score = matches.length * 3;
    if (urlPath && urlPath !== "/") score += 1;
    if (candidate.sourceType.toLowerCase().includes("service")) score += 1;
    if (candidate.sourceType.toLowerCase().includes("product")) score += 1;
    if (["faq", "case", "partner", "industry"].some((token) => haystack.includes(token))) score += 1;
    if (homepageHost && candidate.url.includes(homepageHost)) score += 1;

    const reason = matches.length > 0
      ? `Closest manifest-backed URL for ${matches.slice(0, 3).join(", ")}.`
      : `Closest manifest-backed URL for ${category.toLowerCase()}.`;

    return {
      ...candidate,
      score,
      reason,
    };
  });

  const sorted = scored
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((candidate) => ({
      label: candidate.label,
      url: candidate.url,
      reason: candidate.reason,
    }));

  if (sourceUrl && /^https?:\/\//i.test(sourceUrl) && !sorted.some((candidate) => candidate.url === sourceUrl)) {
    sorted.push({
      label: "Homepage",
      url: sourceUrl,
      reason: "Use the homepage if the primary market narrative still needs to be tightened above the fold.",
    });
  }

  return sorted.slice(0, limit);
}
