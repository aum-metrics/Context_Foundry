/**
 * useRemediation.ts
 * Generic remediation hook — derives cluster categories from prompt text,
 * never from hardcoded industry verticals.
 */
import { useMemo } from "react";
import type {
  CompetitorInsight, GapAssertion, ManifestSnapshot,
  PromptRun, QueryClusterInsight, RemediationRecommendation,
  ScoringHistoryEntry, SEOResult,
} from "@/types/som";
import { averageAccuracy, clampPct, getFirstSentence, hallucinationRate, parseClaimRecallPercent } from "@/lib/somUtils";
import { resolveRemediationTargets } from "@/lib/remediationTargets";

// ─── Generic cluster classification ──────────────────────────────────────────
// Derives a label purely from the prompt's signal words — no vertical hardcoding.

function classifyPromptCluster(prompt: string): string {
  const p = prompt.toLowerCase();

  if (/\b(vs\.?|versus|compare|comparison|alternative|differ|better than)\b/.test(p))
    return "Competitive Differentiation";
  if (/\b(roi|revenue|cost|saving|budget|price|payback|profit|value)\b/.test(p))
    return "Business Value & ROI";
  if (/\b(case stud|proof|evidence|outcome|client|customer|win|success story)\b/.test(p))
    return "Proof & Credibility";
  if (/\b(market|leader|rank|top|best|leading|shortlist|recommend)\b/.test(p))
    return "Market Leadership";
  if (/\b(certif|compli|secure|soc2|iso|gdpr|regulation|audit|trust|govern)\b/.test(p))
    return "Trust & Compliance";
  if (/\b(scale|enterprise|fortune|large|global|multi|complex|transform)\b/.test(p))
    return "Enterprise Fit";
  if (/\b(implement|deploy|integrat|onboard|migrat|adopt|partner|support)\b/.test(p))
    return "Delivery & Partnership";
  if (/\b(ai|ml|data|cloud|platform|technolog|digital|automat|innovat)\b/.test(p))
    return "Technology & Innovation";
  if (/\b(domain|industry|vertical|sector|specialist|expert|niche)\b/.test(p))
    return "Domain Expertise";

  // Last resort: derive from first meaningful words
  const words = prompt.split(/\s+/).filter((w) => w.length > 4).slice(0, 3);
  return words.length ? words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") : "General Positioning";
}

// ─── Category fallback claims (generic buyer-intent signals) ──────────────────

function getCategoryFallbackClaims(category: string): string[] {
  const map: Record<string, string[]> = {
    "Competitive Differentiation":  ["named differentiators vs top rivals", "unique methodology or IP", "buyer-facing comparison proof"],
    "Business Value & ROI":         ["quantified ROI or cost savings", "time-to-value benchmarks", "financial outcome case studies"],
    "Proof & Credibility":          ["named client outcomes", "verifiable case studies", "third-party validation"],
    "Market Leadership":            ["analyst recognition or rankings", "market share signals", "category leadership assertions"],
    "Trust & Compliance":           ["security certifications (SOC2, ISO)", "regulatory compliance proof", "audit track record"],
    "Enterprise Fit":               ["Fortune 500 or large-org references", "scalability and uptime evidence", "enterprise procurement readiness"],
    "Delivery & Partnership":       ["implementation success metrics", "partner ecosystem depth", "post-sale support proof"],
    "Technology & Innovation":      ["proprietary technology proof", "AI/data capability assertions", "innovation track record"],
    "Domain Expertise":             ["vertical-specific outcome evidence", "named industry credentials", "domain thought leadership"],
  };
  return map[category] ?? ["specific outcome proof points", "named buyer-relevant differentiators", "verifiable capability assertions"];
}

// ─── Copy builders (fully generic — no industry mentions) ────────────────────

function buildCopyBlock(subject: string, category: string, competitor: string, missing: string[]): string {
  return (
    `AI identifies that ${competitor} is winning on '${category}'. ` +
    `${subject} lacks explicit signals around '${missing[0] ?? "key proof points"}'. ` +
    `Add a section addressing '${missing.slice(0, 2).join(" and ")}' with verifiable evidence.`
  );
}
function buildSchemaSuggestion(category: string, missing: string[]): string {
  return `Add '${missing[0] ?? "core capability"}' to Organization schema under 'knowsAbout' and 'description' for the '${category}' cluster.`;
}
function buildFaqSuggestion(subject: string, category: string, competitor: string): string {
  return `FAQ: "How does ${subject} differ from ${competitor} on ${category.toLowerCase()}?" — answer with specific, verifiable proof.`;
}
function buildLlmsSuggestion(category: string, missing: string[]): string {
  return `llms.txt: Under '${category}', add a 'Verified Capabilities' list: ${missing.slice(0, 2).join("; ") || "key differentiators"}.`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseRemediationArgs {
  promptRuns: PromptRun[];
  competitorRanking: CompetitorInsight[];
  manifestSnapshot: ManifestSnapshot | null;
  analysisSubject: string;
  seoResult: SEOResult | null;
  filteredHistoryEntries: ScoringHistoryEntry[] | null | undefined;
  isDemoOrg?: boolean;
}

export function useRemediation({
  promptRuns,
  competitorRanking,
  manifestSnapshot,
  analysisSubject,
  seoResult,
  filteredHistoryEntries,
  isDemoOrg = false,
}: UseRemediationArgs) {

  // ── Query cluster insights ─────────────────────────────────────────────────
  const queryClusterInsights = useMemo<QueryClusterInsight[]>(() => {
    const getCompetitorForCategory = (cat: string): CompetitorInsight | undefined => {
      const cl = cat.toLowerCase();
      return (
        competitorRanking.find((c) => {
          const wc = (c.winningCategory ?? "").toLowerCase();
          return wc.includes(cl) || cl.includes(wc);
        }) ?? competitorRanking[0]
      );
    };

    return promptRuns
      .map((run) => {
        const sorted = [...run.results].sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0));
        const avgAcc = sorted.length
          ? clampPct(sorted.reduce((s, r) => s + (r.accuracy ?? 0), 0) / sorted.length)
          : 0;
        const recallVals = sorted.map((r) => parseClaimRecallPercent(r.claimScore)).filter((v): v is number => v !== null);
        const claimRecall = recallVals.length
          ? clampPct(recallVals.reduce((s, v) => s + v, 0) / recallVals.length)
          : avgAcc;

        const category = classifyPromptCluster(run.prompt);
        const matched = getCompetitorForCategory(category);
        const observedOutcome = getFirstSentence(sorted[0]?.answer) || `'${category}' prompts scoring ${avgAcc}% average fidelity.`;

        const missingClaims: string[] =
          matched?.missingAssertions?.length
            ? matched.missingAssertions.map((a: string | GapAssertion) => typeof a === "string" ? a : a.assertion)
            : getCategoryFallbackClaims(category);

        return {
          prompt: run.prompt,
          category,
          avgAccuracy: avgAcc,
          claimRecall,
          hallucinationCount: sorted.filter((r) => r.hasDisplacement ?? r.hasHallucination).length,
          winnerModel: sorted[0]?.model ?? "No data",
          weakestModel: sorted[sorted.length - 1]?.model ?? "No data",
          observedOutcome,
          winningCompetitor: matched?.name ?? "No competitor identified",
          claimsOwned: matched?.claimsOwned ?? [],
          missingClaims,
        } satisfies QueryClusterInsight;
      })
      .sort((a, b) => b.avgAccuracy - a.avgAccuracy);
  }, [promptRuns, competitorRanking]);

  const winningClusters = useMemo(() => queryClusterInsights.slice(0, 2), [queryClusterInsights]);

  const weakClusters = useMemo(() => {
    const meaningful = queryClusterInsights
      .filter((c) => c.avgAccuracy < 80 || c.hallucinationCount > 0 || c.claimRecall < 80)
      .sort((a, b) => a.avgAccuracy - b.avgAccuracy);

    // Deduplicate by category
    const seen = new Set<string>();
    const unique = meaningful.filter((c) => { if (seen.has(c.category)) return false; seen.add(c.category); return true; });
    return unique.length > 0 ? unique.slice(0, 3) : queryClusterInsights.slice(-2).reverse();
  }, [queryClusterInsights]);

  // ── Remediation snapshot ───────────────────────────────────────────────────
  const remediationSnapshot = useMemo(() => {
    if (!filteredHistoryEntries || filteredHistoryEntries.length < 2) return null;
    const chrono = [...filteredHistoryEntries];
    const baseline = chrono[0];
    const current = chrono[chrono.length - 1];
    const baselineAvg = averageAccuracy(baseline.results ?? []);
    const currentAvg = averageAccuracy(current.results ?? []);
    const baselineHR = hallucinationRate(baseline.results ?? []);
    const currentHR = hallucinationRate(current.results ?? []);

    return {
      baselinePrompt: baseline.prompt,
      currentPrompt: current.prompt,
      baselineAvg,
      currentAvg,
      deltaSom: isDemoOrg ? 0 : Math.round(currentAvg - baselineAvg),
      baselineHallucinationRate: baselineHR,
      currentHallucinationRate: currentHR,
      deltaHallucinationRate: isDemoOrg ? 0 : Math.round((currentHR - baselineHR) * 10) / 10,
      isDemoBypass: isDemoOrg,
    };
  }, [filteredHistoryEntries, isDemoOrg]);

  // ── Remediation recommendations ────────────────────────────────────────────
  const remediationRecommendations = useMemo<RemediationRecommendation[]>(() => {
    const recs = weakClusters.map((cluster) => {
      const missing = cluster.missingClaims.length > 0
        ? cluster.missingClaims
        : getCategoryFallbackClaims(cluster.category);

      return {
        title: `Close the ${cluster.category.toLowerCase()} visibility gap`,
        category: cluster.category,
        observedOutcome: cluster.observedOutcome,
        winningCompetitor: cluster.winningCompetitor,
        missingClaims: missing,
        pageTargets: resolveRemediationTargets({
          category: cluster.category,
          schemaData: manifestSnapshot?.schemaData,
          sourceUrl: manifestSnapshot?.sourceUrl,
          missingClaims: missing,
        }),
        copyBlock: buildCopyBlock(analysisSubject, cluster.category, cluster.winningCompetitor, missing),
        schemaSuggestion: buildSchemaSuggestion(cluster.category, missing),
        faqSuggestion: buildFaqSuggestion(analysisSubject, cluster.category, cluster.winningCompetitor),
        llmsSuggestion: buildLlmsSuggestion(cluster.category, missing),
      } satisfies RemediationRecommendation;
    });

    // Append SEO-based recommendation when available
    if (seoResult) {
      const failing = seoResult.checks.filter((c) => c.status !== "pass").slice(0, 2);
      if (failing.length > 0) {
        const missing = failing.map((c) => c.check);
        recs.push({
          title: "Close AI Search Readiness gaps on the public site",
          category: "AI Search Readiness",
          observedOutcome: `${seoResult.geoScore}% AI Search Readiness — ${missing.join(", ")} flagged.`,
          winningCompetitor: competitorRanking[0]?.name ?? "Leading competitors",
          missingClaims: missing,
          pageTargets: resolveRemediationTargets({
            category: "AI Search Readiness",
            schemaData: manifestSnapshot?.schemaData,
            sourceUrl: manifestSnapshot?.sourceUrl,
            missingClaims: missing,
          }),
          copyBlock: `${analysisSubject} should restate its core identity and differentiators in page titles, H1 headings, and above-the-fold copy so AI retrieval systems stop defaulting to generic language.`,
          schemaSuggestion: "Add complete Organization/Service/FAQ schema aligned to visible page copy.",
          faqSuggestion: `FAQ: What makes ${analysisSubject} the right choice for enterprise buyers in this category?`,
          llmsSuggestion: "llms.txt: Add a plain-language section naming the company category, buyer fit, and primary service lines.",
        });
      }
    }

    return recs.slice(0, 4);
  }, [weakClusters, manifestSnapshot, analysisSubject, seoResult, competitorRanking]);

  return { queryClusterInsights, winningClusters, weakClusters, remediationSnapshot, remediationRecommendations };
}
