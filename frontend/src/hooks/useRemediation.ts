import { useMemo } from "react";
import { resolveRemediationTargets } from "@/lib/remediationTargets";
import type { CompetitorInsight, GapAssertion, ManifestSnapshot, PromptRun, QueryClusterInsight, RemediationRecommendation, ScoringHistoryEntry, SEOResult } from "@/types/som";
import { averageAccuracy, clampPct, getFirstSentence, hallucinationRate, parseClaimRecallPercent } from "@/lib/somUtils";

function classifyPromptCluster(prompt: string): string {
    const value = prompt.toLowerCase();
    if (value.includes("fortune 500") || value.includes("retail transformation") || value.includes("analytics partner")) {
        return "Executive Market Positioning";
    }
    if (value.includes("iphone") || value.includes("electronics") || value.includes("appliances") || value.includes("store near me") || value.includes("delivery")) {
        return "Retail Availability & Logistics";
    }
    if (value.includes("crisis") || value.includes("simulation") || value.includes("resilience") || value.includes("training") || value.includes("threat")) {
        return "Cyber Readiness & Training";
    }
    if (value.includes("crm") || value.includes("billing") || value.includes("compliance") || value.includes("scalability")) {
        return "Enterprise Scale & Reliability";
    }
    if (value.includes("compare with") || value.includes("vs") || value.includes("competitor") || value.includes("alternative")) {
        return "Competitive Differentiation";
    }
    return "Market Authority";
}

function getCategoryFallbackClaims(category: string): string[] {
    switch (category) {
        case "Executive Market Positioning":
            return ["verified Fortune 500 retail decision cases", "top-tier analytics partnership authority", "enterprise-scale ROI proof"];
        case "Retail Availability & Logistics":
            return ["verified same-day delivery proof", "nationwide store inventory visibility", "post-purchase service network"];
        case "Cyber Readiness & Training":
            return ["crisis simulation realism", "executive board governance proof", "automated scenario generation depth"];
        case "Enterprise Scale & Reliability":
            return ["99.99% uptime SLA evidence", "enterprise-grade security SOC2", "multi-region deployment proof"];
        case "Competitive Differentiation":
            return ["proprietary innovation signals", "named buyer-intent differentiators", "clear proof of outcome"];
        default:
            return ["industry-specific outcome proof", "category authority signals", "explicit buyer trust factors"];
    }
}

function buildCopyBlock(subject: string, category: string, competitorName: string, missingClaims: string[]): string {
    const claim = missingClaims[0] || "industry-leading signals";
    const competitorSignal = competitorName === "Shopify"
        ? "'Ecosystem App Scale'"
        : competitorName === "Reliance Digital"
            ? "'Nationwide Network Presence'"
            : "'Category Authority'";

    return `AI identifies that ${competitorName} is winning on ${competitorSignal}. To counter this, ${subject} must inject explicit assertions around '${claim}' into your primary value proposition. We recommend adding a "Compare vs ${competitorName}" section on your homepage specifically highlighting ${missingClaims.slice(0, 2).join(" and ")}.`;
}

function buildSchemaSuggestion(category: string, subject: string, missingClaims: string[]): string {
    const claim = missingClaims[0] || "core service proof";
    return `Update Organization schema: Add '${claim}' to 'knowsAbout' and 'description' properties to improve extraction for the ${category.toLowerCase()} cluster.`;
}

function buildFaqSuggestion(subject: string, category: string, competitorName: string): string {
    return `Enterprise FAQ: "How does ${subject}'s approach to ${category.toLowerCase()} differ from legacy providers like ${competitorName}?" (Focus answer on verified ROI and specific delivery proof).`;
}

function buildLlmsSuggestion(category: string, subject: string, missingClaims: string[]): string {
    const claims = missingClaims.slice(0, 2).join("; ") || "differentiated signals";
    return `llms.txt: Under the '${category}' header, add a 'Verified Capabilities' list claiming: ${claims}. This ensures crawler-based crawlers prioritize these signals.`;
}

interface UseRemediationArgs {
    promptRuns: PromptRun[];
    competitorRanking: CompetitorInsight[];
    manifestSnapshot: ManifestSnapshot | null;
    analysisSubject: string;
    seoResult: SEOResult | null;
    filteredHistoryEntries: ScoringHistoryEntry[] | null | undefined;
}

export function useRemediation({
    promptRuns,
    competitorRanking,
    manifestSnapshot,
    analysisSubject,
    seoResult,
    filteredHistoryEntries,
}: UseRemediationArgs) {
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
                ? matchedCompetitor.missingAssertions.map((a: string | GapAssertion) => typeof a === "string" ? a : a.assertion)
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

        // Deduplicate by category to avoid redundant remediation plans
        const uniqueByCategory: QueryClusterInsight[] = [];
        const categories = new Set<string>();
        for (const cluster of meaningful) {
            if (!categories.has(cluster.category)) {
                uniqueByCategory.push(cluster);
                categories.add(cluster.category);
            }
        }

        return uniqueByCategory.length > 0 ? uniqueByCategory.slice(0, 3) : queryClusterInsights.slice(-2).reverse();
    }, [queryClusterInsights]);

    const remediationSnapshot = useMemo(() => {
        if (!filteredHistoryEntries || filteredHistoryEntries.length < 2) return null;
        
        // 🚨 DEMO REFINEMENT: If this is a demo org, hide the delta som to avoid misleading prospect
        const isDemo = analysisSubject.toLowerCase().includes("latentview") || analysisSubject.toLowerCase().includes("demo");

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
            deltaSom: isDemo ? 0 : currentAvg - baselineAvg,
            baselineHallucinationRate,
            currentHallucinationRate,
            deltaHallucinationRate: isDemo ? 0 : currentHallucinationRate - baselineHallucinationRate,
            isDemoBypass: isDemo
        };
    }, [filteredHistoryEntries, analysisSubject]);

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

    return {
        queryClusterInsights,
        winningClusters,
        weakClusters,
        remediationSnapshot,
        remediationRecommendations,
    };
}
