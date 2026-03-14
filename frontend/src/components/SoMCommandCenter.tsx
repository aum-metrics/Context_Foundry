"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line } from "recharts";
import { TrendingUp, Search, Globe, Activity, ShieldAlert, ArrowUpRight, Lock, FilePenLine, BriefcaseBusiness, ClipboardList, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import { auth } from "../lib/firebase";
import { useOrganization } from "./OrganizationContext";
import { UpgradeModal } from "./UpgradeModal";
import { Hexagon, Award } from "lucide-react";
import BrandHealthCertificate from "./BrandHealthCertificate";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import { getLocalMockSession, isLocalMockMode } from "@/lib/localMockMode";
import { describeGeoMethod } from "@/lib/geoMethod";
import { resolveRemediationTargets, type RemediationPageTarget } from "@/lib/remediationTargets";

interface BatchResult {
    domainStability: number;
    driftRate: number;
    modelAverages?: Record<string, number>;
    results?: Array<{
        prompt?: string;
        results?: { model: string; accuracy: number; hasDisplacement?: boolean; hasHallucination?: boolean; claimScore?: string; answer?: string }[];
        error?: string;
    }>;
}

interface ScoringHistoryEntry {
    prompt: string;
    results: { model: string; accuracy: number; hasDisplacement?: boolean; hasHallucination?: boolean; claimScore?: string; answer?: string }[];
    timestamp: { seconds: number };
}

interface SEOResult {
    url: string;
    seoScore: number;
    geoScore: number;
    overallScore: number;
    geoMethod?: string;
    checks: { check: string; status: string; detail: string }[];
    recommendation: string;
}

interface GapAssertion {
    assertion: string;
    gapConfidence: number;  // 0-100: how confident the model is this is a real positioning gap
    somImpact: number;      // 1-20: estimated SoM % points recoverable by closing this gap
}

interface CompetitorInsight {
    name: string;
    displacementRate: number;
    strengths: string[];
    weaknesses: string[];
    winningCategory?: string;
    buyerQueries?: string[];  // example buyer questions this competitor is winning on
    claimsOwned?: string[];
    missingAssertions?: (GapAssertion | string)[];  // supports both old string[] and new object[] format
}

interface ManifestSnapshot {
    sourceUrl?: string | null;
    name?: string | null;
    schemaData?: Record<string, unknown>;
}

interface PromptRun {
    prompt: string;
    results: { model: string; accuracy: number; hasDisplacement?: boolean; hasHallucination?: boolean; claimScore?: string; answer?: string }[];
}

interface QueryClusterInsight {
    prompt: string;
    category: string;
    avgAccuracy: number;
    claimRecall: number;
    hallucinationCount: number;
    winnerModel: string;
    weakestModel: string;
    observedOutcome: string;
    winningCompetitor: string;
    claimsOwned: string[];
    missingClaims: string[];
}

interface RemediationRecommendation {
    title: string;
    category: string;
    observedOutcome: string;
    winningCompetitor: string;
    missingClaims: string[];
    pageTargets: RemediationPageTarget[];
    copyBlock: string;
    schemaSuggestion: string;
    faqSuggestion: string;
    llmsSuggestion: string;
}

const FALLBACK_MODEL_ORDER: string[] = ["GPT-4o", "Gemini 3 Flash", "Claude 4.5 Sonnet"];

function normalizeModelName(model: string): string {
    const raw = (model || "").trim();
    const lowered = raw.toLowerCase();
    const aliases: Record<string, string> = {
        "gpt-4o": "GPT-4o",
        "gpt-4o-mini": "GPT-4o",
        "gpt-4o mini": "GPT-4o",
        "gemini 1.5 flash": "Gemini 3 Flash",
        "gemini 2.0 flash": "Gemini 3 Flash",
        "gemini 2.5 flash": "Gemini 3 Flash",
        "gemini 3 flash": "Gemini 3 Flash",
        "gemini-1.5-flash": "Gemini 3 Flash",
        "gemini-2.0-flash": "Gemini 3 Flash",
        "gemini-2.5-flash": "Gemini 3 Flash",
        "gemini-3-flash": "Gemini 3 Flash",
        "claude 3.5 sonnet": "Claude 4.5 Sonnet",
        "claude 3.5 haiku": "Claude 4.5 Sonnet",
        "claude 4 sonnet": "Claude 4.5 Sonnet",
        "claude 4.5 sonnet": "Claude 4.5 Sonnet",
        "claude 4.5": "Claude 4.5 Sonnet",
        "claude-3-5-sonnet": "Claude 4.5 Sonnet",
        "claude-3-5-sonnet-20241022": "Claude 4.5 Sonnet",
        "claude-3-5-haiku": "Claude 4.5 Sonnet",
        "claude-sonnet-4-20250514": "Claude 4.5 Sonnet",
        "claude-sonnet-4-5": "Claude 4.5 Sonnet",
    };

    return aliases[lowered] || raw;
}

function parseClaimRecallPercent(claimScore?: string): number | null {
    if (!claimScore) return null;
    const ratioMatch = claimScore.match(/(\d+)\s*\/\s*(\d+)/);
    if (!ratioMatch) return null;
    const supported = Number(ratioMatch[1]);
    const total = Number(ratioMatch[2]);
    if (!Number.isFinite(supported) || !Number.isFinite(total) || total <= 0) return null;
    return Math.max(0, Math.min(100, Math.round((supported / total) * 100)));
}

function clampPct(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
}

function averageAccuracy(results: { accuracy: number }[]): number {
    if (!results.length) return 0;
    return Math.round(results.reduce((sum, result) => sum + (result.accuracy || 0), 0) / results.length);
}

function hallucinationRate(results: { hasHallucination: boolean }[]): number {
    if (!results.length) return 0;
    return Math.round((results.filter((result) => result.hasHallucination).length / results.length) * 100);
}

function getFirstSentence(value?: string): string {
    if (!value) return "";
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (!cleaned) return "";
    const match = cleaned.match(/.*?[.!?](\s|$)/);
    return (match ? match[0] : cleaned).trim();
}

function classifyPromptCluster(prompt: string): string {
    const value = prompt.toLowerCase();
    if (value.includes("databricks") || value.includes("snowflake") || value.includes("google cloud") || value.includes("modernization")) {
        return "Cloud & data modernization";
    }
    if (value.includes("compare with") || value.includes("accenture") || value.includes("fractal") || value.includes("mu sigma") || value.includes("tiger analytics")) {
        return "Competitive differentiation";
    }
    if (value.includes("fortune 500") || value.includes("partner is best") || value.includes("large-scale ai") || value.includes("transformation")) {
        return "Enterprise transformation fit";
    }
    if (value.includes("domain expertise") || value.includes("cpg") || value.includes("bfsi") || value.includes("supply chain") || value.includes("retail")) {
        return "Industry expertise";
    }
    return "Market ranking";
}

function getCategoryFallbackClaims(category: string): string[] {
    switch (category) {
        case "Cloud & data modernization":
            return ["Databricks delivery proof", "Snowflake modernization proof", "Google Cloud transformation outcomes"];
        case "Competitive differentiation":
            return ["why buyers choose you over larger consultancies", "clear proof of delivery outcomes", "named competitive differentiators"];
        case "Enterprise transformation fit":
            return ["Fortune 500 transformation credibility", "executive governance model", "enterprise operating model depth"];
        case "Industry expertise":
            return ["vertical outcome proof in CPG, BFSI, retail, and supply chain", "industry-specific case studies", "domain-led consulting evidence"];
        default:
            return ["enterprise analytics consulting positioning", "buyer shortlist rationale", "clear transformation proof"];
    }
}

function buildCopyBlock(subject: string, category: string, competitorName: string, missingClaims: string[]): string {
    const proofPoint = missingClaims[0] || "enterprise delivery proof";
    const proofPointTwo = missingClaims[1] || "buyer-facing differentiation";
    return `${subject} is built for ${category.toLowerCase()} decisions with verified delivery depth, not generic transformation language. Buyers evaluating alternatives such as ${competitorName} should see explicit proof of ${proofPoint} and ${proofPointTwo} in the first screenful of your site content.`;
}

function buildSchemaSuggestion(category: string, subject: string, missingClaims: string[]): string {
    const joinedClaims = missingClaims.slice(0, 2).join(" and ") || "core service proof";
    return `Add Organization + Service schema that ties ${subject} directly to ${joinedClaims}.`;
}

function buildFaqSuggestion(subject: string, category: string, competitorName: string): string {
    return `FAQ: How does ${subject} compare with ${competitorName} for ${category.toLowerCase()}?`;
}

function buildLlmsSuggestion(category: string, subject: string, missingClaims: string[]): string {
    const claims = missingClaims.slice(0, 2).join("; ") || "explicit buyer-facing proof";
    return `llms.txt: Add a ${category} section for ${subject} with direct claims on ${claims}.`;
}

export default function SoMCommandCenter({ setActiveView: _setActiveView }: { setActiveView?: (view: string) => void }) {
    const { organization, refreshKey, activeManifestVersion, activeContextName } = useOrganization();
    const { models } = useModelCatalog();
    const [activeTab, setActiveTab] = useState<string>("GPT-4o");
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [upgradeFeatureName, setUpgradeFeatureName] = useState("");

    // SEO Audit state
    const [seoUrl, setSeoUrl] = useState("");
    const [seoLoading, setSeoLoading] = useState(false);
    const [seoResult, setSeoResult] = useState<SEOResult | null>(null);
    const [isCertificateOpen, setIsCertificateOpen] = useState(false);
    const [currentManifestVersion, setCurrentManifestVersion] = useState<string | null>(null);
    const [manifestSnapshot, setManifestSnapshot] = useState<ManifestSnapshot | null>(null);
    const [historicalData, setHistoricalData] = useState<{ date: string; score: number }[]>([]);
    const [competitors, setCompetitors] = useState<CompetitorInsight[]>([]);
    const batchIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const analysisSubject = activeContextName || organization?.name || "the selected context";

    const getEffectiveToken = async () => {
        const token = await auth.currentUser?.getIdToken();
        if (token) return token;
        if (isLocalMockMode()) {
            return getLocalMockSession().token;
        }
        return undefined;
    };

    useEffect(() => {
        return () => {
            if (batchIntervalRef.current) clearInterval(batchIntervalRef.current);
        };
    }, []);

    useEffect(() => {
        if (!organization) return;
        const fetchCompetitors = async () => {
            try {
                const effectiveToken = await getEffectiveToken();
                if (!effectiveToken) return;

                const res = await fetch(`/api/competitor/displacement/${organization.id}?version=${encodeURIComponent(activeManifestVersion)}`, {
                    headers: { 'Authorization': `Bearer ${effectiveToken}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setCompetitors(data.competitors || []);
                }
            } catch (err) {
                console.error("Failed to fetch competitors", err);
            }
        };
        fetchCompetitors();
    }, [organization, refreshKey, activeManifestVersion]);

    useEffect(() => {
        if (!organization?.id) {
            setCurrentManifestVersion(null);
            return;
        }

        const fetchManifestMeta = async () => {
            try {
                const token = await getEffectiveToken();
                if (!token) return;
                const response = await fetch(`/api/workspaces/${organization.id}/manifest-data?version=${encodeURIComponent(activeManifestVersion)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!response.ok) {
                    setCurrentManifestVersion(null);
                    return;
                }
                const data = await response.json();
                setCurrentManifestVersion(data.version || null);
                setManifestSnapshot({
                    sourceUrl: data.sourceUrl,
                    name: data.name,
                    schemaData: data.schemaData || {},
                });
            } catch (error) {
                console.error("Failed to fetch manifest metadata", error);
                setCurrentManifestVersion(null);
                setManifestSnapshot(null);
            }
        };

        fetchManifestMeta();
    }, [organization?.id, refreshKey, activeManifestVersion]);

    const fetchHistory = async (orgId: string) => {
        try {
            const effectiveToken = await getEffectiveToken();
            if (!effectiveToken) return null;

            const res = await fetch(`/api/simulation/history/${orgId}`, {
                headers: { 'Authorization': `Bearer ${effectiveToken}` }
            });
            if (!res.ok) return null;

            const data = await res.json();
            const entries = (data.history || []).map((entry: { timestamp: string | { seconds: number } }) => ({
                ...entry,
                timestamp: typeof entry.timestamp === 'string'
                    ? { seconds: Math.floor(new Date(entry.timestamp).getTime() / 1000) }
                    : entry.timestamp
            }));

            return entries.reverse(); // oldest first for chart
        } catch (err) {
            console.error("Failed to fetch history from API", err);
            return null;
        }
    };

    const { data: historyEntries, error: _error, isLoading: loading } = useSWR(
        organization ? `history-${organization.id}-${activeManifestVersion}-${refreshKey}` : null,
        () => fetchHistory(organization!.id)
    );

    const filteredHistoryEntries = useMemo(() => {
        if (!historyEntries) return historyEntries;
        if (!currentManifestVersion) return historyEntries;
        return historyEntries.filter((entry: { version?: string }) => entry.version === currentManifestVersion);
    }, [historyEntries, currentManifestVersion]);

    // Memoized Calculations to prevent infinite re-renders
    const modelAverages = useMemo(() => {
        if (!filteredHistoryEntries || filteredHistoryEntries.length === 0) {
            return {
                "GPT-4o": 0,
                "Gemini 3 Flash": 0,
                "Claude 4.5 Sonnet": 0,
            };
        }

        const modelSums: Record<string, { total: number, count: number }> = {};
        filteredHistoryEntries.forEach((entry: ScoringHistoryEntry) => {
            entry.results?.forEach((res: { model: string; accuracy: number }) => {
                const normalized = normalizeModelName(res.model || "Unknown");
                if (!modelSums[normalized]) modelSums[normalized] = { total: 0, count: 0 };
                modelSums[normalized].total += res.accuracy;
                modelSums[normalized].count += 1;
            });
        });

        const newAverages: Record<string, number> = {};
        Object.keys(modelSums).forEach((model: string) => {
            newAverages[model] = Math.round(modelSums[model].total / modelSums[model].count);
        });

        // Mix in Batch Results if present
        if (batchResult && batchResult.modelAverages) {
            const normalizedBatch: Record<string, number> = {};
            Object.entries(batchResult.modelAverages).forEach(([model, avg]) => {
                normalizedBatch[normalizeModelName(model)] = avg as number;
            });
            return { ...newAverages, ...normalizedBatch };
        }

        return newAverages;
    }, [filteredHistoryEntries, batchResult]);

    const modelTabs = useMemo(() => {
        const discovered = new Set<string>(Object.keys(modelAverages).map(normalizeModelName));
        const preferredOrder = models.length > 0 ? models.map(model => normalizeModelName(model.displayName)) : FALLBACK_MODEL_ORDER;
        return preferredOrder.filter((model) => discovered.has(model));
    }, [modelAverages, models]);

    useEffect(() => {
        if (modelTabs.length > 0 && !modelTabs.includes(activeTab)) {
            setActiveTab(modelTabs[0]);
        }
    }, [activeTab, modelTabs]);

    const radarData = useMemo(() => {
        const empty = [
            { subject: "Consistency", A: 0, B: 0, C: 0, fullMark: 100 },
            { subject: "Factuality", A: 0, B: 0, C: 0, fullMark: 100 },
            { subject: "Sentiment", A: 0, B: 0, C: 0, fullMark: 100 },
            { subject: "Safety", A: 0, B: 0, C: 0, fullMark: 100 },
            { subject: "Authority", A: 0, B: 0, C: 0, fullMark: 100 },
        ];

        if (!filteredHistoryEntries || filteredHistoryEntries.length === 0) return empty;

        const latestEntry = filteredHistoryEntries[0];
        if (!latestEntry?.results?.length) return empty;

        const byModel: Record<string, { consistency: number; factuality: number; sentiment: number; safety: number; authority: number }> = {
            "GPT-4o": { consistency: 0, factuality: 0, sentiment: 0, safety: 0, authority: 0 },
            "Claude 4.5 Sonnet": { consistency: 0, factuality: 0, sentiment: 0, safety: 0, authority: 0 },
            "Gemini 3 Flash": { consistency: 0, factuality: 0, sentiment: 0, safety: 0, authority: 0 },
        };

        latestEntry.results.forEach((result: { model: string; accuracy: number; hasHallucination: boolean; claimScore?: string }) => {
            const model = normalizeModelName(result.model);
            if (!byModel[model]) return;
            const accuracy = clampPct(result.accuracy || 0);
            const claimRecall = parseClaimRecallPercent(result.claimScore) ?? accuracy;
            const safety = result.hasHallucination ? clampPct(claimRecall - 25) : clampPct(claimRecall + 10);
            const authority = clampPct((accuracy * 0.6) + (claimRecall * 0.4));
            const sentiment = clampPct((accuracy * 0.5) + (safety * 0.5));
            byModel[model] = {
                consistency: accuracy,
                factuality: claimRecall,
                sentiment,
                safety,
                authority,
            };
        });

        return [
            { subject: "Consistency", A: byModel["GPT-4o"].consistency, B: byModel["Claude 4.5 Sonnet"].consistency, C: byModel["Gemini 3 Flash"].consistency, fullMark: 100 },
            { subject: "Factuality", A: byModel["GPT-4o"].factuality, B: byModel["Claude 4.5 Sonnet"].factuality, C: byModel["Gemini 3 Flash"].factuality, fullMark: 100 },
            { subject: "Sentiment", A: byModel["GPT-4o"].sentiment, B: byModel["Claude 4.5 Sonnet"].sentiment, C: byModel["Gemini 3 Flash"].sentiment, fullMark: 100 },
            { subject: "Safety", A: byModel["GPT-4o"].safety, B: byModel["Claude 4.5 Sonnet"].safety, C: byModel["Gemini 3 Flash"].safety, fullMark: 100 },
            { subject: "Authority", A: byModel["GPT-4o"].authority, B: byModel["Claude 4.5 Sonnet"].authority, C: byModel["Gemini 3 Flash"].authority, fullMark: 100 },
        ];
    }, [filteredHistoryEntries]);

    const visibleModelAverages = useMemo(() => {
        const preferredOrder = models.length > 0 ? models.map(model => normalizeModelName(model.displayName)) : FALLBACK_MODEL_ORDER;
        return preferredOrder.reduce<Record<string, number>>((acc, modelName) => {
            if (typeof modelAverages[modelName] === "number") {
                acc[modelName] = modelAverages[modelName];
            }
            return acc;
        }, {});
    }, [modelAverages, models]);

    const promptRuns = useMemo<PromptRun[]>(() => {
        if (batchResult?.results && batchResult.results.length > 0) {
            return batchResult.results
                .filter((entry) => entry.prompt && entry.results && entry.results.length > 0 && !entry.error)
                .map((entry) => ({
                    prompt: entry.prompt || "",
                    results: (entry.results || []).map((result) => ({
                        ...result,
                        model: normalizeModelName(result.model),
                    })),
                }));
        }

        return (filteredHistoryEntries || [])
            .filter((entry: ScoringHistoryEntry) => entry.prompt && entry.results?.length)
            .map((entry: ScoringHistoryEntry) => ({
                prompt: entry.prompt,
                results: (entry.results || []).map((result) => ({
                    ...result,
                    model: normalizeModelName(result.model),
                })),
            }));
    }, [batchResult, filteredHistoryEntries]);

    const competitorRanking = useMemo(() => {
        return [...competitors].sort((a, b) => (b.displacementRate || 0) - (a.displacementRate || 0));
    }, [competitors]);

    const queryClusterInsights = useMemo<QueryClusterInsight[]>(() => {
        const getCompetitorForCategory = (category: string) => {
            const normalizedCategory = category.toLowerCase();
            return competitorRanking.find((competitor) => {
                const winningCategory = (competitor.winningCategory || "").toLowerCase();
                return winningCategory.includes(normalizedCategory) || normalizedCategory.includes(winningCategory);
            }) || competitorRanking[0];
        };

        return promptRuns.map((run) => {
            const sortedResults = [...run.results].sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0));
            const avgAccuracy = sortedResults.length > 0
                ? clampPct(sortedResults.reduce((sum, result) => sum + (result.accuracy || 0), 0) / sortedResults.length)
                : 0;
            const claimRecallValues = sortedResults
                .map((result) => parseClaimRecallPercent(result.claimScore))
                .filter((value): value is number => value !== null);
            const claimRecall = claimRecallValues.length > 0
                ? clampPct(claimRecallValues.reduce((sum, value) => sum + value, 0) / claimRecallValues.length)
                : avgAccuracy;
            const category = classifyPromptCluster(run.prompt);
            const matchedCompetitor = getCompetitorForCategory(category);
            const observedOutcome = getFirstSentence(sortedResults[0]?.answer)
                || `${category} prompts are currently scoring ${avgAccuracy}% average fidelity across the audited model set.`;
            const fallbackClaims = getCategoryFallbackClaims(category);
            const missingClaims: string[] = (matchedCompetitor?.missingAssertions && matchedCompetitor.missingAssertions.length > 0)
                ? matchedCompetitor.missingAssertions.map(a => typeof a === "string" ? a : a.assertion)
                : fallbackClaims;


            return {
                prompt: run.prompt,
                category,
                avgAccuracy,
                claimRecall,
                hallucinationCount: sortedResults.filter((result) => result.hasDisplacement ?? result.hasHallucination).length,
                winnerModel: sortedResults[0]?.model || "No data",
                weakestModel: sortedResults[sortedResults.length - 1]?.model || "No data",
                observedOutcome,
                winningCompetitor: matchedCompetitor?.name || "No competitor identified",
                claimsOwned: matchedCompetitor?.claimsOwned || [],
                missingClaims,
            };
        }).sort((a, b) => b.avgAccuracy - a.avgAccuracy);
    }, [promptRuns, competitorRanking]);

    const winningClusters = useMemo(() => queryClusterInsights.slice(0, 2), [queryClusterInsights]);

    const weakClusters = useMemo(() => {
        const meaningful = queryClusterInsights
            .filter((cluster) => cluster.avgAccuracy < 80 || cluster.hallucinationCount > 0 || cluster.claimRecall < 80)
            .sort((a, b) => a.avgAccuracy - b.avgAccuracy);
        return meaningful.length > 0 ? meaningful.slice(0, 3) : queryClusterInsights.slice(-2).reverse();
    }, [queryClusterInsights]);

    const remediationSnapshot = useMemo(() => {
        if (!filteredHistoryEntries || filteredHistoryEntries.length < 2) return null;
        const chronological = [...filteredHistoryEntries];
        const baseline = chronological[0];
        const current = chronological[chronological.length - 1];
        const baselineAvg = averageAccuracy(baseline.results || []);
        const currentAvg = averageAccuracy(current.results || []);
        const baselineHallucinationRate = hallucinationRate(baseline.results || []);
        const currentHallucinationRate = hallucinationRate(current.results || []);
        return {
            baselinePrompt: baseline.prompt,
            currentPrompt: current.prompt,
            baselineAvg,
            currentAvg,
            deltaLcrs: currentAvg - baselineAvg,
            baselineHallucinationRate,
            currentHallucinationRate,
            deltaHallucinationRate: currentHallucinationRate - baselineHallucinationRate,
        };
    }, [filteredHistoryEntries]);

    const remediationRecommendations = useMemo<RemediationRecommendation[]>(() => {
        const recommendations = weakClusters.map((cluster) => {
            const missingClaims = cluster.missingClaims.length > 0 ? cluster.missingClaims : getCategoryFallbackClaims(cluster.category);
            const pageTargets = resolveRemediationTargets({
                category: cluster.category,
                schemaData: manifestSnapshot?.schemaData || undefined,
                sourceUrl: manifestSnapshot?.sourceUrl,
                missingClaims,
            });
            return {
                title: `Close the ${cluster.category.toLowerCase()} visibility gap`,
                category: cluster.category,
                observedOutcome: cluster.observedOutcome,
                winningCompetitor: cluster.winningCompetitor,
                missingClaims,
                pageTargets,
                copyBlock: buildCopyBlock(analysisSubject, cluster.category, cluster.winningCompetitor, missingClaims),
                schemaSuggestion: buildSchemaSuggestion(cluster.category, analysisSubject, missingClaims),
                faqSuggestion: buildFaqSuggestion(analysisSubject, cluster.category, cluster.winningCompetitor),
                llmsSuggestion: buildLlmsSuggestion(cluster.category, analysisSubject, missingClaims),
            };
        });

        if (seoResult) {
            const weakChecks = seoResult.checks.filter((check) => check.status !== "pass").slice(0, 2);
            if (weakChecks.length > 0) {
                recommendations.push({
                    title: "Close GEO evidence gaps on the public site",
                    category: "Site-level GEO readiness",
                    observedOutcome: `${seoResult.geoScore}% GEO score with ${weakChecks.map((check) => check.check).join(", ")} flagged.`,
                    winningCompetitor: competitorRanking[0]?.name || "No competitor identified",
                    missingClaims: weakChecks.map((check) => check.check),
                    pageTargets: resolveRemediationTargets({
                        category: "Site-level GEO readiness",
                        schemaData: manifestSnapshot?.schemaData || undefined,
                        sourceUrl: manifestSnapshot?.sourceUrl,
                        missingClaims: weakChecks.map((check) => check.check),
                    }),
                    copyBlock: `${analysisSubject} should restate its core identity, category fit, and differentiators in the title block, opening H1, and above-the-fold descriptive copy so AI retrieval systems stop defaulting to generic vendor language.`,
                    schemaSuggestion: "Add complete Organization / Service / FAQ schema and align the visible page copy with the same core claims.",
                    faqSuggestion: `FAQ: What makes ${analysisSubject} credible for enterprise AI and analytics transformation?`,
                    llmsSuggestion: "llms.txt: Add a short top section that names the company category, buyer fit, and primary service lines in plain language.",
                });
            }
        }

        return recommendations.slice(0, 4);
    }, [weakClusters, manifestSnapshot?.schemaData, manifestSnapshot?.sourceUrl, analysisSubject, seoResult, competitorRanking]);


    const dashboardKpis = useMemo(() => {
        const visibleScores = Object.values(visibleModelAverages);
        const lcrsAverage = batchResult?.domainStability
            ?? (visibleScores.length > 0 ? clampPct(visibleScores.reduce((sum, score) => sum + score, 0) / visibleScores.length) : 0);
        const bestModelEntry = Object.entries(visibleModelAverages)
            .sort((a, b) => (b[1] || 0) - (a[1] || 0))[0];
        const topCompetitor = competitorRanking[0];
        return {
            lcrsAverage,
            bestModelName: bestModelEntry?.[0] || "No data",
            bestModelScore: bestModelEntry?.[1] || 0,
            topCompetitorName: topCompetitor?.name || "No competitor identified",
            topCompetitorPressure: topCompetitor?.displacementRate || 0,
            weakClusterCount: weakClusters.length,
            geoScore: seoResult?.geoScore ?? 0,
            winningCluster: winningClusters[0]?.category || "No winning cluster yet",
        };
    }, [batchResult, visibleModelAverages, competitorRanking, weakClusters, seoResult, winningClusters]);

    const executiveSummary = useMemo(() => {
        const topCompetitor = competitorRanking[0];
        const strongest = winningClusters[0];
        const weakest = weakClusters[0];
        const geoLine = seoResult
            ? `GEO is ${seoResult.geoScore}% and still needs stronger manifest-aligned proof on the public site.`
            : "Run the SEO/GEO audit to validate whether site copy supports what the models are inferring.";
        const competitorLine = topCompetitor
            ? `${topCompetitor.name} is currently owning ${topCompetitor.winningCategory || "high-intent buyer"} searches with ${topCompetitor.displacementRate}% competitive pressure.`
            : "No grounded competitor displacement has been detected from the current manifest yet.";
        const strongLine = strongest
            ? `${analysisSubject} is strongest on ${strongest.category.toLowerCase()} prompts, led by ${strongest.winnerModel}.`
            : `${analysisSubject} does not yet have enough scored prompts to determine a strong cluster.`;
        const weakLine = weakest
            ? `The clearest gap is ${weakest.category.toLowerCase()}, where the system is missing claims around ${weakest.missingClaims.slice(0, 2).join(" and ")}.`
            : "The weakest enterprise query cluster will appear after the batch analysis runs.";
        return `${strongLine} ${weakLine} ${competitorLine} ${geoLine}`;
    }, [analysisSubject, competitorRanking, winningClusters, weakClusters, seoResult]);

    const remediationNarrative = useMemo(() => {
        if (!remediationSnapshot) {
            return "Before/after remediation proof will appear after at least two runs exist for the same analyzed context.";
        }
        const somDirection = remediationSnapshot.deltaLcrs > 0 ? "expanded" : remediationSnapshot.deltaLcrs < 0 ? "contracted" : "held flat";
        const hallucinationDirection = remediationSnapshot.deltaHallucinationRate < 0
            ? "decreased displacement risk"
            : remediationSnapshot.deltaHallucinationRate > 0
                ? "increased displacement risk"
                : "kept displacement risk flat";
        return `Compared with the baseline run, Share of Model (SoM) has ${somDirection} by ${Math.abs(remediationSnapshot.deltaLcrs)} points and competitive displacement has ${hallucinationDirection}. Build specific site evidence to improve this further.`;
    }, [remediationSnapshot]);

    const normalizeAuditUrl = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return "";
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        return `https://${trimmed}`;
    };



    const runBatchStabilityCheck = async () => {
        if (!organization) return;
        setBatchLoading(true);
        try {
            const effectiveToken = await getEffectiveToken();
            if (!effectiveToken) throw new Error("Authentication required.");

            const response = await fetch('/api/batch/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${effectiveToken}`
                },
                body: JSON.stringify({
                    orgId: organization.id,
                    prompts: [
                        `Which companies are leading AI-driven enterprise transformation, and how does ${analysisSubject} compare?`,
                        `What are the key criteria enterprise buyers use to shortlist a partner like ${analysisSubject}?`,
                        `How does ${analysisSubject} differentiate from other established players in its market category?`,
                        `Which partner is best for large-scale enterprise transformation for Fortune 500 companies, and why would a buyer shortlist ${analysisSubject}?`,
                        `What specific proof points and outcomes does ${analysisSubject} offer that enterprise decision-makers prioritize?`
                    ],
                    manifestVersion: activeManifestVersion
                })
            });
            const data = await response.json();

            if ((data.status === "processing" || data.status === "queued") && data.jobId) {
                // Poll for completion
                const pollInterval = setInterval(async () => {
                    batchIntervalRef.current = pollInterval;
                    try {
                        const currentToken = await getEffectiveToken();
                        const statusRes = await fetch(`/api/batch/batch/status/${organization.id}/${data.jobId}`, {
                            headers: { 'Authorization': `Bearer ${currentToken}` }
                        });
                        if (statusRes.ok) {
                            const statusData = await statusRes.json();
                            if (statusData.status === "completed" && (statusData.summary || statusData.result)) {
                                clearInterval(pollInterval);
                                const result = statusData.summary || statusData.result;
                                setBatchResult(result);
                                setBatchLoading(false);
                            } else if (statusData.status === "failed") {
                                clearInterval(pollInterval);
                                console.error("Batch Job Failed:", statusData.error);
                                setBatchLoading(false);
                            }
                        }
                    } catch (pollErr) {
                        console.error("Polling error:", pollErr);
                    }
                }, 3000); // Poll every 3 seconds
            }
            else {
                // Fallback direct response
                setBatchResult(data);
                setBatchLoading(false);
            }
        } catch (err) {
            console.error("Batch Error:", err);
            setBatchLoading(false);
        }
    };

    const runSEOAudit = async () => {
        if (!seoUrl || !organization) return;
        setSeoLoading(true);
        try {
            const effectiveToken = await getEffectiveToken();
            const normalizedUrl = normalizeAuditUrl(seoUrl);
            setSeoUrl(normalizedUrl);

            const endpoint = organization.id === "demo_org_id" ? '/api/seo/audit/mock' : '/api/seo/audit';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${effectiveToken}`
                },
                body: JSON.stringify({ url: normalizedUrl, orgId: organization.id, manifestVersion: activeManifestVersion })
            });
            const data = await response.json();

            if (data.seoScore !== undefined) {
                // Audit completed synchronously
                setSeoResult(data);
                setSeoLoading(false);
            } else if (data.jobId) {
                // Async polling fallback
                let attempts = 0;
                const pollInterval = setInterval(async () => {
                    attempts++;
                    if (attempts > 20) {
                        clearInterval(pollInterval);
                        setSeoLoading(false);
                        console.error("SEO Audit timeout");
                        return;
                    }
                    try {
                        const currentToken = await getEffectiveToken();
                        const statusRes = await fetch(`/api/seo/audit/status/${organization.id}/${data.jobId}`, {
                            headers: { 'Authorization': `Bearer ${currentToken}` }
                        });

                        if (statusRes.ok) {
                            const statusData = await statusRes.json();
                            if (statusData.status === "completed" && statusData.result) {
                                clearInterval(pollInterval);
                                setSeoResult(statusData.result);
                                setSeoLoading(false);
                            } else if (statusData.status === "failed") {
                                clearInterval(pollInterval);
                                console.error("SEO Audit Failed:", statusData.error || statusData);
                                setSeoLoading(false);
                            }
                        }
                    } catch (pollErr) {
                        console.error("SEO Polling error:", pollErr);
                    }
                }, 3000); // Poll every 3 seconds
            } else {
                setSeoLoading(false);
                console.error("SEO Audit Failed:", data);
            }
        } catch (err) {
            console.error("SEO Error:", err);
            setSeoLoading(false);
        }
    };

    useEffect(() => {
        if (!filteredHistoryEntries || filteredHistoryEntries.length === 0) {
            // No real data yet — show empty state, not fake numbers
            setHistoricalData([]);
            return;
        }

        const dayMap: Record<string, { score: number, count: number }> = {};
        filteredHistoryEntries.forEach((entry: ScoringHistoryEntry) => {
            const ts = entry.timestamp?.seconds ? new Date(entry.timestamp.seconds * 1000) : new Date();
            const label = ts.toLocaleDateString("en-US", { month: "short", day: "numeric" });

            if (entry.results && entry.results.length > 0) {
                const totalAccuracy = entry.results.reduce((s: number, r: { accuracy: number }) => s + r.accuracy, 0);
                const avg = totalAccuracy / entry.results.length;

                if (!dayMap[label]) dayMap[label] = { score: 0, count: 0 };
                dayMap[label].score += avg;
                dayMap[label].count += 1;
            }
        });

        const realData = Object.keys(dayMap).map(day => ({
            date: day,
            score: Math.round(dayMap[day].score / dayMap[day].count)
        }));

        if (realData.length > 0) {
            setHistoricalData(realData.reverse()); // Set to oldest first
        }
    }, [filteredHistoryEntries]);

    const chartData = useMemo(() => {
        if (loading) return [];
        if (!filteredHistoryEntries && !_error) return [];
        if (filteredHistoryEntries && filteredHistoryEntries.length === 0) return [];

        const targetModel = activeTab;
        const dataPoints: { name: string; score: number }[] = [];

        for (const entry of (filteredHistoryEntries || [])) {
            const ts = entry.timestamp?.seconds ? new Date(entry.timestamp.seconds * 1000) : new Date();
            const label = ts.toLocaleDateString("en-US", { weekday: "short" });
            const modelResult = entry.results?.find((r: { model: string; accuracy: number }) => normalizeModelName(r.model) === targetModel);
            if (modelResult) {
                dataPoints.push({ name: label, score: modelResult.accuracy });
            }
        }

        return dataPoints;
    }, [filteredHistoryEntries, activeTab, loading, _error]);

    const fidelityRisks = useMemo(() => {
        if (!filteredHistoryEntries) return [];
        const risks: { id: number; model: string; text: string; severity: string }[] = [];
        let riskId = 1;
        for (const entry of filteredHistoryEntries) {
            for (const result of (entry.results || []) as { model: string; accuracy: number; hasDisplacement?: boolean; hasHallucination?: boolean }[]) {
                // Show displacement alerts: competitor ranked above us OR low SoM score
                const isDisplaced = (result.hasDisplacement ?? result.hasHallucination) || result.accuracy < 60;
                if (isDisplaced) {
                    risks.push({
                        id: riskId++,
                        model: result.model,
                        text: `Competitive Displacement on: "${entry.prompt.slice(0, 50)}..."`,
                        severity: result.accuracy < 40 ? "high" : "medium"
                    });
                }
            }
        }
        return risks.slice(0, 5);
    }, [filteredHistoryEntries]);

    const radarExplainer = [
        { label: "Consistency", detail: "How stable the narrative stays across prompts." },
        { label: "Factuality", detail: "How closely answers stay anchored to verified claims." },
        { label: "Sentiment", detail: "Whether tone about the brand remains context-appropriate." },
        { label: "Safety", detail: "How reliably the model avoids harmful or fabricated assertions." },
        { label: "Authority", detail: "How strongly the model preserves your real market positioning." },
    ];

    const avgScore = dashboardKpis.lcrsAverage;

    const isCriticalDrift = (batchResult?.driftRate || 0) > 40 || avgScore < 55;

    return (
        <div className={`w-full animate-fade-in font-sans transition-all duration-700 ${isCriticalDrift ? 'ring-2 ring-rose-500/20 ring-inset rounded-2xl p-1' : ''}`}>
            {isCriticalDrift && (
                <div className="w-full rounded-xl mb-6 h-1 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-rose-500 animate-shimmer" />
            )}
            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
                <div className="rounded-2xl p-4 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 shadow-sm">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">Avg SoM</p>
                    <div className="flex items-end gap-2">
                        <span className="text-3xl font-light text-slate-900 dark:text-white">{dashboardKpis.lcrsAverage || "—"}</span>
                        {dashboardKpis.lcrsAverage > 0 && <span className="text-slate-500 mb-1">%</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">{batchResult ? "Batch-calculated enterprise score" : "Derived from current simulation history"}</p>
                </div>
                <div className="rounded-2xl p-4 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 shadow-sm">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">Best Model</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{dashboardKpis.bestModelName}</p>
                    <p className="text-xs text-slate-500 mt-2">{Math.round(dashboardKpis.bestModelScore)}% on current context</p>
                </div>
                <div className="rounded-2xl p-4 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 shadow-sm">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">Top Competitor Pressure</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{dashboardKpis.topCompetitorName}</p>
                    <p className="text-xs text-rose-500 mt-2">{dashboardKpis.topCompetitorPressure}% displacement pressure</p>
                </div>
                <div className="rounded-2xl p-4 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 shadow-sm">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">Weak Clusters</p>
                    <p className="text-3xl font-light text-slate-900 dark:text-white">{dashboardKpis.weakClusterCount}</p>
                    <p className="text-xs text-slate-500 mt-2">{weakClusters[0]?.category || "Run batch to detect weak buyer-intent areas"}</p>
                </div>
                <div className="rounded-2xl p-4 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 shadow-sm">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">Winning Cluster</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{dashboardKpis.winningCluster}</p>
                    <p className="text-xs text-slate-500 mt-2">{winningClusters[0] ? `${winningClusters[0].avgAccuracy}% average SoM` : "Awaiting enterprise query evidence"}</p>
                </div>
                <div className="rounded-2xl p-4 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 shadow-sm">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">GEO Readiness</p>
                    <p className="text-3xl font-light text-slate-900 dark:text-white">{seoResult ? `${dashboardKpis.geoScore}%` : "—"}</p>
                    <p className="text-xs text-slate-500 mt-2">{seoResult ? describeGeoMethod(seoResult.geoMethod) : "Run audit to populate"}</p>
                </div>
            </div>
            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 mb-8">
                <button
                    onClick={runBatchStabilityCheck}
                    disabled={batchLoading || !["growth", "scale", "enterprise"].includes(organization?.subscriptionTier || "")}
                    className={`text-xs px-4 py-2 rounded-lg transition-colors flex items-center ${["growth", "scale", "enterprise"].includes(organization?.subscriptionTier || "") ? "bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50" : "bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700"}`}
                >
                    {["growth", "scale", "enterprise"].includes(organization?.subscriptionTier || "") ? (
                        <><Activity className={`w-3 h-3 mr-2 ${batchLoading ? "animate-spin" : ""}`} />{batchLoading ? "Analyzing..." : "Run Enterprise Batch"}</>
                    ) : (
                        <><Lock className="w-3 h-3 mr-2 text-slate-500" />Growth/Scale/Enterprise</>
                    )}
                </button>
                <button
                    onClick={() => {
                        if (organization?.subscriptionTier === "explorer") { setUpgradeFeatureName("Brand Health PDF Report"); setIsUpgradeModalOpen(true); return; }
                        setIsCertificateOpen(true);
                    }}
                    className="text-xs px-4 py-2 rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20 transition-colors flex items-center"
                >
                    {organization?.subscriptionTier === "explorer" ? <Lock className="w-3 h-3 mr-2" /> : <Award className="w-3 h-3 mr-2" />}
                    {organization?.subscriptionTier === "explorer" ? "Unlock Executive Report" : "Open Executive Report"}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl dark:shadow-none">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-4 h-4 text-indigo-500" />
                            <h2 className="text-lg font-medium text-slate-900 dark:text-white">Executive Summary</h2>
                        </div>
                        <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">{executiveSummary}</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
                            <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/40 p-4">
                                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Observed Outcome</p>
                                <p className="text-sm text-slate-700 dark:text-slate-300">{weakClusters[0]?.observedOutcome || "Batch analysis will surface the clearest losing outcome."}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/40 p-4">
                                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Winning Competitor</p>
                                <p className="text-sm text-slate-700 dark:text-slate-300">{weakClusters[0]?.winningCompetitor || dashboardKpis.topCompetitorName}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/40 p-4">
                                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Priority Fix</p>
                                <p className="text-sm text-slate-700 dark:text-slate-300">{weakClusters[0]?.missingClaims.slice(0, 2).join(" · ") || "Clarify missing buyer-facing claims"}</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl dark:shadow-none">
                        <div className="flex items-center gap-2 mb-4">
                            <Award className="w-4 h-4 text-emerald-500" />
                            <h2 className="text-lg font-medium text-slate-900 dark:text-white">Before / After Remediation Proof</h2>
                        </div>
                        <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">{remediationNarrative}</p>
                        {remediationSnapshot ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
                                <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/40 p-4">
                                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Baseline SoM</p>
                                    <p className="text-2xl font-light text-slate-900 dark:text-white">{remediationSnapshot.baselineAvg}%</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/40 p-4">
                                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Current SoM</p>
                                    <p className="text-2xl font-light text-slate-900 dark:text-white">{remediationSnapshot.currentAvg}%</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/40 p-4">
                                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">SoM Delta</p>
                                    <p className={`text-2xl font-light ${remediationSnapshot.deltaLcrs >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                        {remediationSnapshot.deltaLcrs >= 0 ? "+" : ""}{remediationSnapshot.deltaLcrs}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/40 p-4">
                                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Displacement Delta</p>
                                    <p className={`text-2xl font-light ${remediationSnapshot.deltaHallucinationRate <= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                        {remediationSnapshot.deltaHallucinationRate >= 0 ? "+" : ""}{remediationSnapshot.deltaHallucinationRate}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 mt-5 text-center">
                                <p className="text-sm text-slate-500 dark:text-slate-400">Run the same context at least twice to prove a remediation delta.</p>
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl dark:shadow-none">
                        <div className="flex items-center justify-between gap-4 mb-5">
                            <div>
                                <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center">
                                    <ClipboardList className="w-4 h-4 mr-2 text-indigo-500" />
                                    Buyer-Intent Query Clusters
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">Winning and losing enterprise query themes across the current batch or scored history.</p>
                            </div>
                            <div className="text-xs text-slate-500">Models compared: {Object.keys(visibleModelAverages).join(" · ") || FALLBACK_MODEL_ORDER.join(" · ")}</div>
                        </div>
                        {queryClusterInsights.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
                                <p className="text-sm text-slate-500 dark:text-slate-400">Run the enterprise batch to see which buyer-intent categories you win and lose.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {queryClusterInsights.map((insight) => {
                                    const isWinningCluster = winningClusters.some((cluster) => cluster.prompt === insight.prompt);
                                    const isWeakCluster = weakClusters.some((cluster) => cluster.prompt === insight.prompt);
                                    return (
                                        <div key={insight.prompt} className={`rounded-2xl border p-5 ${isWeakCluster ? "border-rose-200 dark:border-rose-500/20 bg-rose-50/60 dark:bg-rose-950/20" : isWinningCluster ? "border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-950/20" : "border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/30"}`}>
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-1">{insight.category}</p>
                                                    <p className="text-sm font-medium text-slate-900 dark:text-white leading-6">{insight.prompt}</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className={`text-2xl font-light ${insight.avgAccuracy >= 80 ? "text-emerald-500" : insight.avgAccuracy >= 60 ? "text-amber-500" : "text-rose-500"}`}>{insight.avgAccuracy}%</p>
                                                    <p className="text-[10px] text-slate-500">avg SoM</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mb-3 text-[11px]">
                                                <span className="px-2 py-1 rounded-full bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">Winner: {insight.winnerModel}</span>
                                                <span className="px-2 py-1 rounded-full bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">Weakest: {insight.weakestModel}</span>
                                                <span className="px-2 py-1 rounded-full bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">Claim recall: {insight.claimRecall}%</span>
                                                <span className="px-2 py-1 rounded-full bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">Hallucinations: {insight.hallucinationCount}</span>
                                                {isWinningCluster && <span className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-300">Winning cluster</span>}
                                                {isWeakCluster && <span className="px-2 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300">Losing cluster</span>}
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{insight.observedOutcome}</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                <div className="rounded-xl bg-white/80 dark:bg-black/10 border border-slate-200 dark:border-white/5 p-3">
                                                    <p className="uppercase tracking-widest text-slate-500 mb-2">Winning competitor</p>
                                                    <p className="text-slate-700 dark:text-slate-300">{insight.winningCompetitor}</p>
                                                </div>
                                                <div className="rounded-xl bg-white/80 dark:bg-black/10 border border-slate-200 dark:border-white/5 p-3">
                                                    <p className="uppercase tracking-widest text-slate-500 mb-2">Missing claims</p>
                                                    <p className="text-slate-700 dark:text-slate-300">{insight.missingClaims.slice(0, 2).join(" · ")}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl dark:shadow-none">
                        <div className="flex items-center gap-2 mb-5">
                            <FilePenLine className="w-4 h-4 text-fuchsia-500" />
                            <h2 className="text-lg font-medium text-slate-900 dark:text-white">Prescriptive Remediation Recommendations</h2>
                        </div>
                        {remediationRecommendations.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
                                <p className="text-sm text-slate-500 dark:text-slate-400">Remediation guidance will appear after we have scored at least one buyer-intent cluster.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {remediationRecommendations.map((recommendation) => (
                                    <div key={`${recommendation.category}-${recommendation.title}`} className="rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/30 p-5">
                                        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-4">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-1">{recommendation.category}</p>
                                                <h3 className="text-base font-semibold text-slate-900 dark:text-white">{recommendation.title}</h3>
                                            </div>
                                            <span className="inline-flex px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-slate-300">
                                                Winning competitor: {recommendation.winningCompetitor}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-sm">
                                            <div className="rounded-xl bg-white dark:bg-black/10 border border-slate-200 dark:border-white/5 p-4">
                                                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Observed outcome</p>
                                                <p className="text-slate-700 dark:text-slate-300">{recommendation.observedOutcome}</p>
                                            </div>
                                            <div className="rounded-xl bg-white dark:bg-black/10 border border-slate-200 dark:border-white/5 p-4">
                                                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Missing claims</p>
                                                <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                                                    {recommendation.missingClaims.map((claim) => (
                                                        <li key={claim}>• {claim}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="rounded-xl bg-white dark:bg-black/10 border border-slate-200 dark:border-white/5 p-4">
                                                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Page(s) to update</p>
                                                <ul className="space-y-3 text-slate-700 dark:text-slate-300">
                                                    {recommendation.pageTargets.map((target) => (
                                                        <li key={`${target.label}-${target.url}`}>
                                                            <a
                                                                href={target.url || undefined}
                                                                target={target.url ? "_blank" : undefined}
                                                                rel={target.url ? "noreferrer" : undefined}
                                                                className="font-medium text-indigo-600 dark:text-indigo-300 hover:underline break-all"
                                                            >
                                                                {target.url ? `${target.label} — ${target.url}` : target.label}
                                                            </a>
                                                            <p className="text-xs text-slate-500 mt-1">{target.reason}</p>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="rounded-xl bg-white dark:bg-black/10 border border-slate-200 dark:border-white/5 p-4">
                                                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Suggested copy block</p>
                                                <p className="text-slate-700 dark:text-slate-300">{recommendation.copyBlock}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mt-4 text-xs">
                                            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-500/10 p-4">
                                                <p className="uppercase tracking-widest text-indigo-500 mb-2">Schema</p>
                                                <p className="text-slate-700 dark:text-slate-300">{recommendation.schemaSuggestion}</p>
                                            </div>
                                            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-500/10 p-4">
                                                <p className="uppercase tracking-widest text-indigo-500 mb-2">FAQ</p>
                                                <p className="text-slate-700 dark:text-slate-300">{recommendation.faqSuggestion}</p>
                                            </div>
                                            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-500/10 p-4">
                                                <p className="uppercase tracking-widest text-indigo-500 mb-2">llms.txt</p>
                                                <p className="text-slate-700 dark:text-slate-300">{recommendation.llmsSuggestion}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl dark:shadow-none">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center">
                                    <Search className="w-4 h-4 mr-2 text-indigo-500" />
                                    Accuracy Over Time
                                </h2>
                                <div className="flex p-1 bg-slate-100 dark:bg-slate-950/50 rounded-lg border border-slate-200 dark:border-white/5">
                                    {modelTabs.map((model) => (
                                        <button
                                            key={model}
                                            onClick={() => setActiveTab(model)}
                                            className={`px-4 py-1.5 text-sm rounded-md transition-all ${activeTab === model ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"}`}
                                        >
                                            {model}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {loading ? (
                                <div className="h-[260px] flex items-center justify-center animate-pulse">
                                    <div className="w-full h-full bg-slate-800/50 rounded-xl"></div>
                                </div>
                            ) : chartData.length === 0 ? (
                                <div className="h-[260px] flex flex-col items-center justify-center text-center">
                                    <Activity className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-3" />
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Run simulations to unlock trend tracking.</p>
                                </div>
                            ) : (
                                <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="h-[260px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <defs>
                                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                            <XAxis dataKey="name" stroke="#64748b" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#64748b" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                                            <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: "8px" }} itemStyle={{ color: "#c7d2fe" }} />
                                            <Area type="monotone" dataKey="score" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </motion.div>
                            )}
                        </div>

                        <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl dark:shadow-none">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center">
                                    <Hexagon className="w-4 h-4 mr-2 text-fuchsia-500" />
                                    SoM Radar
                                </h2>
                                <div className="flex space-x-4 text-[10px] uppercase tracking-widest font-bold">
                                    <span className="flex items-center text-indigo-400"><span className="w-2 h-2 bg-indigo-500 rounded-full mr-1"></span> GPT</span>
                                    <span className="flex items-center text-fuchsia-400"><span className="w-2 h-2 bg-fuchsia-500 rounded-full mr-1"></span> Claude</span>
                                    <span className="flex items-center text-cyan-400"><span className="w-2 h-2 bg-cyan-500 rounded-full mr-1"></span> Gemini</span>
                                </div>
                            </div>
                            <div className="h-[260px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="78%" data={radarData}>
                                        <PolarGrid stroke="#334155" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748b", fontSize: 10 }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                        <Radar name="GPT" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                                        <Radar name="Claude" dataKey="B" stroke="#d946ef" fill="#d946ef" fillOpacity={0.3} />
                                        <Radar name="Gemini" dataKey="C" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
                                        <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: "12px", fontSize: "12px" }} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-4 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50/80 dark:bg-slate-950/40 p-4">
                                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mb-3">How to read the SoM Radar</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {radarExplainer.map((item) => (
                                        <div key={item.label} className="text-xs text-slate-500">
                                            <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}:</span> {item.detail}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl dark:shadow-none">
                        <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center mb-6">
                            <TrendingUp className="w-4 h-4 mr-2 text-indigo-500" />
                            Historical Competitor Ranking
                        </h2>
                        {historicalData.length === 0 ? (
                            <div className="h-[250px] flex flex-col items-center justify-center text-center">
                                <TrendingUp className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-3" />
                                <p className="text-sm text-slate-500 dark:text-slate-400">No trend data yet.</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Run simulations to build longitudinal competitor ranking history.</p>
                            </div>
                        ) : (
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={historicalData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="date" stroke="#64748b" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#64748b" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                                        <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: "12px" }} />
                                        <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: "#6366f1" }} activeDot={{ r: 6, fill: "#818cf8", stroke: "#fff", strokeWidth: 2 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl dark:shadow-none">
                        <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center mb-5">
                            <BriefcaseBusiness className="w-4 h-4 mr-2 text-indigo-500" />
                            Competitor Intelligence
                        </h2>
                        {competitorRanking.length === 0 ? (
                            <div className="flex flex-col items-center text-center py-6 space-y-2">
                                <ArrowUpRight className="w-6 h-6 text-slate-300 dark:text-slate-700" />
                                <p className="text-sm text-slate-500 dark:text-slate-400">No grounded competitor evidence yet.</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">Upload a richer context manifest to enable competitor benchmarking by buyer-intent category.</p>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {competitorRanking.map((competitor) => {
                                    const gaps: GapAssertion[] = (competitor.missingAssertions || []).map(a =>
                                        typeof a === "string"
                                            ? { assertion: a, gapConfidence: 70, somImpact: 5 }
                                            : a
                                    ).sort((a, b) => b.gapConfidence - a.gapConfidence);
                                    const totalSomImpact = gaps.reduce((s, g) => s + g.somImpact, 0);

                                    return (
                                        <div key={competitor.name} className="rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/30 overflow-hidden">
                                            {/* Header row */}
                                            <div className="flex items-center justify-between px-5 pt-5 pb-3">
                                                <div>
                                                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{competitor.name}</p>
                                                    {competitor.winningCategory && (
                                                        <p className="text-xs text-slate-500 mt-0.5">Winning on: <span className="text-rose-500 dark:text-rose-400">{competitor.winningCategory}</span></p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-light text-rose-500">{competitor.displacementRate}%</p>
                                                    <p className="text-[10px] text-slate-500">displacement rate</p>
                                                </div>
                                            </div>

                                            {/* Buyer queries this competitor wins */}
                                            {competitor.buyerQueries && competitor.buyerQueries.length > 0 && (
                                                <div className="px-5 pb-3">
                                                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Buyer queries they're winning</p>
                                                    <div className="space-y-1">
                                                        {competitor.buyerQueries.map((q) => (
                                                            <div key={q} className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400">
                                                                <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" />
                                                                <span>{q}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Gap assertions with confidence + SoM impact */}
                                            {gaps.length > 0 && (
                                                <div className="px-5 pb-5">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <p className="text-[10px] uppercase tracking-widest text-slate-500">Your positioning gaps</p>
                                                        {totalSomImpact > 0 && (
                                                            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                                                Recover up to +{totalSomImpact}% SoM
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="space-y-3">
                                                        {gaps.map((gap) => (
                                                            <div key={gap.assertion} className="rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 p-3">
                                                                <div className="flex items-start justify-between gap-3 mb-2">
                                                                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-5">{gap.assertion}</p>
                                                                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                                        gap.gapConfidence >= 80
                                                                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                                                            : gap.gapConfidence >= 65
                                                                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                                                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700"
                                                                    }`}>
                                                                        {gap.gapConfidence}% confirmed
                                                                    </span>
                                                                </div>
                                                                {/* Confidence progress bar */}
                                                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-2">
                                                                    <div
                                                                        className={`h-1.5 rounded-full transition-all ${
                                                                            gap.gapConfidence >= 80 ? "bg-rose-500" : gap.gapConfidence >= 65 ? "bg-amber-400" : "bg-slate-400"
                                                                        }`}
                                                                        style={{ width: `${gap.gapConfidence}%` }}
                                                                    />
                                                                </div>
                                                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Closing this gap: estimated +{gap.somImpact}% SoM</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Training claims they own */}
                                            {competitor.claimsOwned && competitor.claimsOwned.length > 0 && (
                                                <div className="border-t border-slate-100 dark:border-white/5 px-5 py-3">
                                                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">What AI says about them</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {competitor.claimsOwned.map((claim) => (
                                                            <span key={claim} className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">{claim}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-6 shadow-xl dark:shadow-none">
                        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-6">Model Comparison</h3>
                        <div className="space-y-6">
                            {Object.entries(visibleModelAverages).map(([modelName, score], i) => (
                                <div key={modelName}>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="font-medium text-slate-900 dark:text-white">{modelName}</span>
                                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">{Math.round(score as number)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 1, delay: i * 0.2, ease: "easeOut" }} className="h-full bg-indigo-500 rounded-full" style={{ opacity: 1 - (i * 0.2) }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl dark:shadow-none">
                        <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center mb-4">
                            <Globe className="w-4 h-4 mr-2 text-emerald-500" />
                            SEO + GEO Readiness
                        </h2>
                        {["growth", "scale", "enterprise"].includes(organization?.subscriptionTier || "explorer") ? (
                            <div className="flex space-x-3 mb-4">
                                <input
                                    type="url"
                                    value={seoUrl}
                                    onChange={(e) => setSeoUrl(e.target.value)}
                                    placeholder="https://yourbusiness.com"
                                    className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 outline-none"
                                    onKeyDown={(e) => { if (e.key === "Enter") runSEOAudit(); }}
                                />
                                <button
                                    onClick={runSEOAudit}
                                    disabled={seoLoading || !seoUrl}
                                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm transition-colors"
                                >
                                    {seoLoading ? "Auditing..." : "Audit"}
                                </button>
                            </div>
                        ) : (
                            <div className="bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-xl p-6 text-center mb-4">
                                <Lock className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                                <p className="text-sm text-slate-600 dark:text-slate-300">SEO &amp; GEO audits require a Growth, Scale, or Enterprise plan.</p>
                                <button
                                    onClick={() => {
                                        setUpgradeFeatureName("SEO & GEO Readiness Audits");
                                        setIsUpgradeModalOpen(true);
                                    }}
                                    className="text-xs text-indigo-500 mt-1 cursor-pointer hover:underline py-1 px-3 border border-indigo-200 dark:border-indigo-500/20 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                                >
                                    Upgrade to Growth
                                </button>
                            </div>
                        )}
                        {seoResult && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 text-center">
                                        <p className="text-xs text-slate-500 mb-1">SEO</p>
                                        <p className={`text-2xl font-light ${seoResult.seoScore >= 60 ? "text-emerald-500" : "text-amber-500"}`}>{seoResult.seoScore}%</p>
                                    </div>
                                    <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 text-center">
                                        <p className="text-xs text-slate-500 mb-1">GEO</p>
                                        <p className={`text-2xl font-light ${seoResult.geoScore >= 50 ? "text-emerald-500" : "text-rose-500"}`}>{seoResult.geoScore}%</p>
                                    </div>
                                    <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 text-center">
                                        <p className="text-xs text-slate-500 mb-1">Overall</p>
                                        <p className={`text-2xl font-light ${seoResult.overallScore >= 50 ? "text-emerald-500" : "text-rose-500"}`}>{seoResult.overallScore}%</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {seoResult.checks.map((check, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-900 rounded-lg px-4 py-2 border border-slate-200 dark:border-white/5">
                                            <span className="text-slate-700 dark:text-slate-300">{check.check}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded ${check.status === "pass" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : ["warning", "warn"].includes(check.status) ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"}`}>
                                                {check.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 italic">{seoResult.recommendation}</p>
                            </motion.div>
                        )}
                    </div>

                    <div className="rounded-2xl p-6 border border-rose-500/10 bg-white dark:bg-gradient-to-b dark:from-slate-900/50 dark:to-slate-950/50 shadow-xl dark:shadow-none">
                        <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center mb-6">
                            <ShieldAlert className="w-4 h-4 mr-2 text-rose-500" />
                            Active Displacement Alerts
                        </h2>
                        <div className="space-y-4">
                            {loading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <div key={i} className="animate-pulse bg-slate-800/40 h-16 rounded-lg w-full"></div>
                                ))
                            ) : fidelityRisks.length > 0 ? (
                                fidelityRisks.map((risk: { id: number, model: string, text: string }) => (
                                    <div key={risk.id} className="p-4 rounded-lg bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/30 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">{normalizeModelName(risk.model)}</span>
                                            <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                                        </div>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{risk.text}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6">
                                    <p className="text-sm text-slate-500">No high-confidence drift alerts are active.</p>
                                    <p className="text-xs text-slate-400 mt-1">This updates as new scored prompts are written into history.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Brand Health Certificate Modal */}
            <AnimatePresence>
                {isCertificateOpen && (
                    <BrandHealthCertificate
                        organizationName={analysisSubject}
                        asovScore={avgScore}
                        driftRate={batchResult?.driftRate || 0}
                        onClose={() => setIsCertificateOpen(false)}
                        modelResults={filteredHistoryEntries && filteredHistoryEntries.length > 0 ? [...filteredHistoryEntries].reverse()[0]?.results : undefined}
                        lastPrompt={filteredHistoryEntries && filteredHistoryEntries.length > 0 ? [...filteredHistoryEntries].reverse()[0]?.prompt : undefined}
                        seoResult={seoResult || undefined}
                         competitors={competitors.map(c => ({
                                ...c,
                                missingAssertions: (c.missingAssertions || []).map(a => typeof a === "string" ? a : a.assertion)
                            }))}
                        activeContextName={analysisSubject}
                        clusterInsights={queryClusterInsights}
                        remediationRecommendations={remediationRecommendations}
                        allowPdfDownload={organization?.subscriptionTier !== "explorer"}
                        onUpgradeRequired={() => {
                            setUpgradeFeatureName("Brand Health PDF Report");
                            setIsUpgradeModalOpen(true);
                        }}
                    />
                )}
            </AnimatePresence>

            <UpgradeModal
                isOpen={isUpgradeModalOpen}
                onClose={() => setIsUpgradeModalOpen(false)}
                featureHighlight={upgradeFeatureName}
            />
        </div >
    );
}
