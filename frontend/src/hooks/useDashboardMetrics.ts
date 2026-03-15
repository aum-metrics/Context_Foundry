import { useMemo } from "react";
import type { BatchResult, CompetitorInsight, QueryClusterInsight, ScoringHistoryEntry, SEOResult } from "@/types/som";
import { FALLBACK_MODEL_ORDER, clampPct, normalizeModelName, parseClaimRecallPercent } from "@/lib/somUtils";

interface UseDashboardMetricsArgs {
    filteredHistoryEntries: ScoringHistoryEntry[] | null | undefined;
    batchResult: BatchResult | null;
    models: { displayName: string }[];
    activeTab: string;
    seoResult: SEOResult | null;
    competitorRanking: CompetitorInsight[];
    winningClusters: QueryClusterInsight[];
    weakClusters: QueryClusterInsight[];
}

export function useDashboardMetrics({
    filteredHistoryEntries,
    batchResult,
    models,
    activeTab,
    seoResult,
    competitorRanking,
    winningClusters,
    weakClusters,
}: UseDashboardMetricsArgs) {
    const modelAverages = useMemo(() => {
        if (!filteredHistoryEntries || filteredHistoryEntries.length === 0) {
            return {
                "GPT-4o": 0,
                "Gemini 3 Flash": 0,
                "Claude 4.5 Sonnet": 0,
            };
        }

        const modelSums: Record<string, { total: number; count: number }> = {};
        filteredHistoryEntries.forEach((entry) => {
            entry.results?.forEach((res) => {
                const normalized = normalizeModelName(res.model || "Unknown");
                if (!modelSums[normalized]) modelSums[normalized] = { total: 0, count: 0 };
                modelSums[normalized].total += res.accuracy;
                modelSums[normalized].count += 1;
            });
        });

        const newAverages: Record<string, number> = {};
        Object.keys(modelSums).forEach((model) => {
            newAverages[model] = Math.round(modelSums[model].total / modelSums[model].count);
        });

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
        const preferredOrder = models.length > 0 ? models.map((model) => normalizeModelName(model.displayName)) : FALLBACK_MODEL_ORDER;
        return preferredOrder.filter((model) => discovered.has(model));
    }, [modelAverages, models]);

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

        latestEntry.results.forEach((result) => {
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
        const preferredOrder = models.length > 0 ? models.map((model) => normalizeModelName(model.displayName)) : FALLBACK_MODEL_ORDER;
        return preferredOrder.reduce<Record<string, number>>((acc, modelName) => {
            if (typeof modelAverages[modelName] === "number") {
                acc[modelName] = modelAverages[modelName];
            }
            return acc;
        }, {});
    }, [modelAverages, models]);

    const chartData = useMemo(() => {
        if (!filteredHistoryEntries || filteredHistoryEntries.length === 0) return [];

        const targetModel = activeTab;
        const dataPoints: { name: string; score: number }[] = [];

        for (const entry of filteredHistoryEntries) {
            const ts = entry.timestamp?.seconds ? new Date(entry.timestamp.seconds * 1000) : new Date();
            const label = ts.toLocaleDateString("en-US", { weekday: "short" });
            const modelResult = entry.results?.find((r) => normalizeModelName(r.model) === targetModel);
            if (modelResult) {
                dataPoints.push({ name: label, score: modelResult.accuracy });
            }
        }

        return dataPoints;
    }, [filteredHistoryEntries, activeTab]);

    const fidelityRisks = useMemo(() => {
        if (!filteredHistoryEntries) return [];
        const risks: { id: number; model: string; text: string; severity: string }[] = [];
        let riskId = 1;
        for (const entry of filteredHistoryEntries) {
            for (const result of (entry.results || []) as { model: string; accuracy: number; hasDisplacement?: boolean; hasHallucination?: boolean }[]) {
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

    const dashboardKpis = useMemo(() => {
        const visibleScores = Object.values(visibleModelAverages);
        const somAverage = batchResult?.domainStability
            ?? (visibleScores.length > 0 ? clampPct(visibleScores.reduce((sum, score) => sum + score, 0) / visibleScores.length) : 0);
        const bestModelEntry = Object.entries(visibleModelAverages)
            .sort((a, b) => (b[1] || 0) - (a[1] || 0))[0];
        const topCompetitor = competitorRanking[0];
        return {
            somAverage,
            bestModelName: bestModelEntry?.[0] || "No data",
            bestModelScore: bestModelEntry?.[1] || 0,
            topCompetitorName: topCompetitor?.name || "No competitor identified",
            topCompetitorPressure: topCompetitor?.displacementRate || 0,
            weakClusterCount: weakClusters.length,
            geoScore: seoResult?.geoScore ?? 0,
            winningCluster: winningClusters[0]?.category || "No winning cluster yet",
        };
    }, [batchResult, visibleModelAverages, competitorRanking, weakClusters, seoResult, winningClusters]);

    return {
        modelAverages,
        modelTabs,
        radarData,
        visibleModelAverages,
        chartData,
        fidelityRisks,
        dashboardKpis,
    };
}
