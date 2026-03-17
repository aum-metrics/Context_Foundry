"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis } from "recharts";
import { 
    Zap, Activity, Globe, ShieldAlert, Sparkles, TrendingUp, Award, 
    BriefcaseBusiness, FilePenLine, FileText, Lock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import { auth } from "../lib/firebase";
import { useOrganization } from "./OrganizationContext";
import { UpgradeModal } from "./UpgradeModal";
import BrandHealthCertificate from "./BrandHealthCertificate";
import AuthErrorCard from "./AuthErrorCard";
import QueryClusterInsights from "./QueryClusterInsights";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useRemediation } from "@/hooks/useRemediation";
import { getLocalMockSession, isLocalMockMode } from "@/lib/localMockMode";
import { normalizeModelName } from "@/lib/somUtils";
import type { BatchResult, CompetitorInsight, ManifestSnapshot, PromptRun, ScoringHistoryEntry, SEOResult } from "@/types/som";

function detectVertical(name: string): string {
    const n = (name || "").toLowerCase();
    if (n.includes("croma") || n.includes("reliance") || n.includes("retail") || n.includes("store") || n.includes("fmcg") || n.includes("grocery")) return "Retail & Consumer Markets";
    if (n.includes("cyber") || n.includes("resilience") || n.includes("security") || n.includes("threat") || n.includes("defense")) return "Cyber & Enterprise Security";
    if (n.includes("crm") || n.includes("saas") || n.includes("enterprise") || n.includes("software") || n.includes("platform")) return "Enterprise SaaS";
    if (n.includes("bank") || n.includes("fintech") || n.includes("payment") || n.includes("insurance") || n.includes("wealth")) return "FinTech & Banking";
    if (n.includes("airline") || n.includes("hotel") || n.includes("travel") || n.includes("hospitality")) return "Travel & Hospitality";
    return "General Enterprise";
}

export default function SoMCommandCenter({ 
    setActiveView: _setActiveView,
    view = "all",
    showReport = false,
    onReportClose
}: { 
    setActiveView?: (view: string) => void,
    view?: "all" | "analyze" | "intelligence" | "action",
    showReport?: boolean,
    onReportClose?: () => void
}) {
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

    useEffect(() => {
        if (showReport) setIsCertificateOpen(true);
    }, [showReport]);

    const handleCloseCertificate = useCallback(() => {
        setIsCertificateOpen(false);
        if (onReportClose) onReportClose();
    }, [onReportClose]);
    
    const batchIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const seoIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const autoPilotKeyRef = useRef<string | null>(null);
    const mounted = useRef(true);
    
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const analysisSubject = activeContextName || organization?.name || "the selected context";

    const clearIntervalRef = useCallback((ref: { current: NodeJS.Timeout | null }) => {
        if (ref.current) {
            clearInterval(ref.current);
            ref.current = null;
        }
    }, []);

    const getEffectiveToken = useCallback(async () => {
        const token = await auth.currentUser?.getIdToken();
        if (token) return token;
        if (isLocalMockMode()) {
            return getLocalMockSession().token;
        }
        return undefined;
    }, []);

    const fetcher = useCallback(async (url: string) => {
        const token = await getEffectiveToken();
        if (!token) throw new Error("auth");
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.status === 401 || res.status === 403) throw new Error("auth");
        if (!res.ok) throw new Error(`request_failed_${res.status}`);
        return res.json();
    }, [getEffectiveToken]);

    // Consolidated SWR Data Fetching
    const competitorsKey = organization
        ? `/api/competitor/displacement/${organization.id}?version=${encodeURIComponent(activeManifestVersion)}`
        : null;
    const { data: competitorsData, error: competitorsError, mutate: mutateCompetitors } = useSWR(
        competitorsKey,
        fetcher
    );
    const competitors = useMemo<CompetitorInsight[]>(() => competitorsData?.competitors || [], [competitorsData]);

    const manifestKey = organization
        ? `/api/workspaces/${organization.id}/manifest-data?version=${encodeURIComponent(activeManifestVersion)}`
        : null;
    const { data: manifestData, error: manifestError, mutate: mutateManifest } = useSWR(
        manifestKey,
        fetcher
    );
    const manifestSnapshot: ManifestSnapshot | null = manifestData ? {
        sourceUrl: manifestData.sourceUrl,
        name: manifestData.name,
        schemaData: manifestData.schemaData || {},
        industryTaxonomy: manifestData.industryTaxonomy || null,
        industryTags: manifestData.industryTags || [],
    } : null;
    const currentManifestVersion = manifestData?.version || null;
    const vertical = useMemo(() => manifestSnapshot?.industryTaxonomy || detectVertical(analysisSubject), [manifestSnapshot?.industryTaxonomy, analysisSubject]);

    const runAutoPilot = useCallback(async () => {
        if (!organization || batchLoading) return;
        setBatchLoading(true);
        try {
            const token = await getEffectiveToken();
            if (!token) throw new Error("auth");
            const manifestVersion = currentManifestVersion || activeManifestVersion;

            const fallbackPrompts = [
                "Who are the top enterprise analytics consulting firms for retail CPG transformation?",
                "Which firms are strongest in Databricks, Snowflake, and Google Cloud data modernization?",
                `How does ${analysisSubject} compare with Accenture, Fractal, and Mu Sigma?`,
                "Which partner is best for large-scale AI/analytics transformation for Fortune 500 companies?",
                "Which vendors have domain expertise in CPG, BFSI, retail, and supply chain analytics?",
            ];

            let prompts = fallbackPrompts;
            try {
                const promptRes = await fetch("/api/simulation/suggest-prompts", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ orgId: organization.id }),
                });
                if (promptRes.ok) {
                    const promptData = await promptRes.json();
                    if (Array.isArray(promptData.prompts) && promptData.prompts.length > 0) {
                        prompts = promptData.prompts;
                    }
                }
            } catch (_err) {
                // fallback prompts already set
            }

            const batchRes = await fetch("/api/batch/batch", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    orgId: organization.id,
                    prompts,
                    manifestVersion,
                }),
            });

            if (!batchRes.ok) {
                throw new Error(`batch_failed_${batchRes.status}`);
            }

            const batchData = await batchRes.json();
            if (batchData.status === "processing" && batchData.jobId) {
                clearIntervalRef(batchIntervalRef);
                const interval = setInterval(async () => {
                    if (!mounted.current) {
                        clearInterval(interval);
                        return;
                    }
                    const statusRes = await fetch(`/api/batch/batch/status/${organization.id}/${batchData.jobId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (statusRes.ok) {
                        const statusData = await statusRes.json();
                        if (statusData.status === "completed" && (statusData.summary || statusData.result)) {
                            if (mounted.current) {
                                setBatchResult(statusData.summary || statusData.result);
                                setBatchLoading(false);
                            }
                            clearIntervalRef(batchIntervalRef);
                        } else if (statusData.status === "failed") {
                            if (mounted.current) setBatchLoading(false);
                            clearIntervalRef(batchIntervalRef);
                        }
                    }
                }, 3000);
                batchIntervalRef.current = interval;
            } else {
                setBatchResult(batchData.summary || batchData.result || batchData);
                setBatchLoading(false);
            }
        } catch (_e) {
            setBatchLoading(false);
        }
    }, [organization, batchLoading, getEffectiveToken, activeManifestVersion, currentManifestVersion, analysisSubject, clearIntervalRef]);

    const isAuthError = (err: unknown) => {
        if (!err) return false;
        if (typeof err === "string") return err === "auth" || err.includes("401") || err.includes("403");
        if (err instanceof Error) {
            const msg = err.message || "";
            return msg === "auth" || msg.includes("401") || msg.includes("403");
        }
        const anyErr = err as { status?: number; message?: string };
        return anyErr.status === 401 || anyErr.status === 403 || anyErr.message === "auth";
    };


    useEffect(() => {
        clearIntervalRef(batchIntervalRef);
        clearIntervalRef(seoIntervalRef);
        setBatchResult(null);
        setBatchLoading(false);
        setSeoLoading(false);
    }, [organization?.id, activeManifestVersion, clearIntervalRef]);

    useEffect(() => {
        return () => {
            clearIntervalRef(batchIntervalRef);
            clearIntervalRef(seoIntervalRef);
        };
    }, [clearIntervalRef]);


    const fetchHistory = useCallback(async (orgId: string) => {
        const effectiveToken = await getEffectiveToken();
        if (!effectiveToken) throw new Error("auth");

        const res = await fetch(`/api/simulation/history/${orgId}`, {
            headers: { 'Authorization': `Bearer ${effectiveToken}` }
        });
        if (res.status === 401 || res.status === 403) throw new Error("auth");
        if (!res.ok) throw new Error(`history_failed_${res.status}`);

        const data = await res.json();
        const entries = (data.history || []).map((entry: { timestamp: string | { seconds: number } }) => ({
            ...entry,
            timestamp: typeof entry.timestamp === 'string'
                ? { seconds: Math.floor(new Date(entry.timestamp).getTime() / 1000) }
                : entry.timestamp
        }));

        return entries.slice().reverse(); // oldest first for chart
    }, [getEffectiveToken]);

    const orgId = organization?.id;
    const historyKey = useMemo(() => {
        return orgId ? [orgId, activeManifestVersion] as const : null;
    }, [orgId, activeManifestVersion]);
    const { data: historyEntries, error: historyError, isLoading: loading, mutate: mutateHistory } = useSWR(
        historyKey,
        ([orgId]) => fetchHistory(orgId)
    );

    const filteredHistoryEntries = useMemo(() => {
        if (!historyEntries) return historyEntries;
        if (!currentManifestVersion) return historyEntries;
        return historyEntries.filter((entry: { version?: string }) => entry.version === currentManifestVersion);
    }, [historyEntries, currentManifestVersion]);

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

    const competitorKeyRef = useRef<string>("");
    const competitorRankingRef = useRef<CompetitorInsight[]>([]);
    const competitorKey = useMemo(() => {
        return competitors
            .map((c) => `${c.name}|${c.displacementRate || 0}|${c.winningCategory || ""}|${(c.missingAssertions || []).length}`)
            .join("||");
    }, [competitors]);
    const competitorRanking = useMemo(() => {
        if (competitorKey === competitorKeyRef.current) {
            return competitorRankingRef.current;
        }
        competitorKeyRef.current = competitorKey;
        competitorRankingRef.current = [...competitors].sort((a, b) => (b.displacementRate || 0) - (a.displacementRate || 0));
        return competitorRankingRef.current;
    }, [competitorKey, competitors]);

    const isDemoOrg = organization?.id === "demo_org_id";
    const {
        queryClusterInsights,
        winningClusters,
        weakClusters,
        remediationSnapshot,
        remediationRecommendations,
    } = useRemediation({
        promptRuns,
        competitorRanking,
        manifestSnapshot,
        analysisSubject,
        seoResult,
        filteredHistoryEntries,
        isDemoOrg,
    });

    const {
        modelTabs,
        radarData,
        chartData,
        fidelityRisks,
        dashboardKpis,
    } = useDashboardMetrics({
        filteredHistoryEntries,
        batchResult,
        models,
        activeTab,
        seoResult,
        competitorRanking,
        winningClusters,
        weakClusters,
    });

    const authError = [competitorsError, manifestError, historyError].find(isAuthError);

    useEffect(() => {
        if (authError || !organization) return;
        if (!filteredHistoryEntries || filteredHistoryEntries.length > 0) return;
        if (batchLoading || loading) return;
        if (!currentManifestVersion) return;
        const autoKey = `${organization.id}|${currentManifestVersion}`;
        if (autoPilotKeyRef.current === autoKey) return;
        autoPilotKeyRef.current = autoKey;
        runAutoPilot();
    }, [filteredHistoryEntries, loading, organization, batchLoading, runAutoPilot, authError, activeManifestVersion, currentManifestVersion]);

    useEffect(() => {
        if (!refreshKey) return;
        if (competitorsKey) mutateCompetitors();
        if (manifestKey) mutateManifest();
        if (historyKey) mutateHistory();
    }, [refreshKey, competitorsKey, manifestKey, historyKey, mutateCompetitors, mutateManifest, mutateHistory]);

    useEffect(() => {
        if (modelTabs.length > 0 && !modelTabs.includes(activeTab)) {
            setActiveTab(modelTabs[0]);
        }
    }, [activeTab, modelTabs]);

    const executiveSummary = useMemo(() => {
        const topCompetitor = competitorRanking[0];
        const strongest = winningClusters[0];
        const weakest = weakClusters[0];
        const geoLine = seoResult
            ? `AI Search Readiness is ${seoResult.geoScore}% and still needs stronger manifest-aligned proof on the public site.`
            : "Run the AI Search Readiness audit to validate whether site copy supports what the models are inferring.";
        const competitorLine = topCompetitor
            ? `${topCompetitor.name} is currently owning ${topCompetitor.winningCategory || "high-intent buyer"} searches with ${topCompetitor.displacementRate}% competitive pressure.`
            : "No grounded competitor displacement has been detected from the current manifest yet.";
        const strongLine = strongest
            ? `${analysisSubject} is strongest on ${strongest.category.toLowerCase()} prompts, led by ${strongest.winnerModel}.`
            : `${analysisSubject} does not yet have enough scored prompts to determine a strong cluster.`;
        const weakLine = weakest
            ? `The clearest gap is ${weakest.category.toLowerCase()}, where the system is missing claims around ${weakest.missingClaims.slice(0, 2).join(" and ")}.`
            : "The weakest enterprise query cluster will appear after the batch analysis runs.";
        
        // Use remediation recommendations from competitors if available
        const topRemediation = topCompetitor?.remediationRecommendation 
            ? ` ${topCompetitor.remediationRecommendation}` 
            : "";

        return `${strongLine} ${weakLine}${topRemediation} ${competitorLine} ${geoLine}`;
    }, [analysisSubject, competitorRanking, winningClusters, weakClusters, seoResult]);


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
                        `Who is the best partner for cyber resilience training and exercises?`,
                        `Compare ${analysisSubject} with CrisisSim for enterprise crisis tabletop exercises.`,
                        `Which platform provides the most actionable executive cyber crisis reporting?`,
                        `Top tools for automating cyber response training and incident readiness.`,
                        `Which companies are leading AI-driven enterprise transformation, and how does ${analysisSubject} compare?`,
                        `What are the key criteria enterprise buyers use to shortlist a partner like ${analysisSubject}?`,
                        `How does ${analysisSubject} differentiate from other established players in its market category?`,
                        `Who should I choose for large-scale digital modernization: ${analysisSubject} or a Big 4 consultancy?`,
                        `Industry-specific expertise of ${analysisSubject} in CPG and supply chain domains.`,
                        `Recent case studies and ROI proof for ${analysisSubject} in financial services.`
                    ],
                    manifestVersion: activeManifestVersion
                })
            });
            const data = await response.json();

            if ((data.status === "processing" || data.status === "queued") && data.jobId) {
                // Poll for completion
                clearIntervalRef(batchIntervalRef);
                const pollInterval = setInterval(async () => {
                    try {
                        const currentToken = await getEffectiveToken();
                        const statusRes = await fetch(`/api/batch/batch/status/${organization.id}/${data.jobId}`, {
                            headers: { 'Authorization': `Bearer ${currentToken}` }
                        });
                        if (statusRes.ok) {
                            const statusData = await statusRes.json();
                            if (statusData.status === "completed" && (statusData.summary || statusData.result)) {
                                clearIntervalRef(batchIntervalRef);
                                const result = statusData.summary || statusData.result;
                                setBatchResult(result);
                                setBatchLoading(false);
                            } else if (statusData.status === "failed") {
                                clearIntervalRef(batchIntervalRef);
                                console.error("Batch Job Failed:", statusData.error);
                                setBatchLoading(false);
                            }
                        } else {
                            // Non-OK response from status endpoint
                            clearIntervalRef(batchIntervalRef);
                            console.error("Batch status check failed:", statusRes.statusText);
                            setBatchLoading(false);
                        }
                    } catch (pollErr) {
                        clearIntervalRef(batchIntervalRef);
                        console.error("Polling error:", pollErr);
                        setBatchLoading(false);
                    }
                }, 3000); // Poll every 3 seconds
                batchIntervalRef.current = pollInterval;
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
                clearIntervalRef(seoIntervalRef);
                const pollInterval = setInterval(async () => {
                    attempts++;
                    if (attempts > 20) {
                        clearIntervalRef(seoIntervalRef);
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
                                clearIntervalRef(seoIntervalRef);
                                setSeoResult(statusData.result);
                                setSeoLoading(false);
                            } else if (statusData.status === "failed") {
                                clearIntervalRef(seoIntervalRef);
                                console.error("SEO Audit Failed:", statusData.error || statusData);
                                setSeoLoading(false);
                            }
                        }
                    } catch (pollErr) {
                        console.error("SEO Polling error:", pollErr);
                    }
                }, 3000); // Poll every 3 seconds
                seoIntervalRef.current = pollInterval;
            } else {
                setSeoLoading(false);
                console.error("SEO Audit Failed:", data);
            }
        } catch (err) {
            console.error("SEO Error:", err);
            setSeoLoading(false);
        }
    };
    const avgScore = dashboardKpis.somAverage;

    const isCriticalDrift = (batchResult?.driftRate || 0) > 40 || avgScore < 55;

    if (authError) {
        return <AuthErrorCard />;
    }

    return (
        <div className={`w-full animate-fade-in font-sans transition-all duration-700 ${isCriticalDrift ? 'ring-2 ring-rose-500/20 ring-inset rounded-2xl p-1' : ''}`}>
            {/* STEP 1: AI OUTCOME (Global / Always Visible) */}
            <div className="mb-12 space-y-8">
                {/* PHASE 1: OUTCOME - EXECUTIVE SUMMARY */}
                <div className="flex flex-col xl:flex-row items-start justify-between gap-8 mb-10">
                    <div className="flex-1 space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-widest">
                            <Zap className="w-3 h-3" /> Step 1: AI Outcome
                        </div>
                        <h1 className="text-4xl xl:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1]">
                            {analysisSubject} <br/>
                            <span className="text-indigo-500">Market Intelligence Pulse</span>
                        </h1>
                        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                            AI Recommendation Share analysis across GPT-4o, Claude 4.5, and Gemini 3. <br/>
                            Identifying where you lose buyer intent to <span className="font-bold text-slate-900 dark:text-white">{dashboardKpis.topCompetitorName}</span>.
                        </p>
                    </div>
                    
                    {batchLoading && (
                        <div className="w-full xl:w-auto p-6 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-center gap-4 animate-pulse">
                            <Activity className="w-8 h-8 text-indigo-500 animate-spin" />
                            <div>
                                <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Generating Market Pulse...</p>
                                <p className="text-[10px] text-slate-500 font-bold">Scanning GPT-4o, Claude 4.5 & Gemini 3 for {vertical} insights</p>
                            </div>
                        </div>
                    )}

                    {!filteredHistoryEntries?.length && !batchLoading && !loading && (
                        <div className="w-full xl:w-auto">
                            <button 
                                onClick={runAutoPilot}
                                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-5 rounded-2xl font-black text-lg shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group"
                            >
                                <Sparkles className="w-6 h-6 text-indigo-400 group-hover:rotate-12 transition-transform" />
                                Run Full Market Audit
                            </button>
                            <p className="text-center text-[10px] text-slate-500 mt-3 font-bold uppercase tracking-widest leading-relaxed">
                                One-click competitive intelligence for {vertical}
                            </p>
                        </div>
                    )}
                </div>

                {/* KPI STRIP */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {loading ? (
                        Array(4).fill(0).map((_, i) => (
                            <div key={i} className="animate-pulse h-32 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 backdrop-blur-xl"></div>
                        ))
                    ) : (
                        <>
                            <div className="group relative rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">AI Recommendation Share</p>
                                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                                        <Globe className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="flex items-end gap-2 mb-1">
                                    <h3 className="text-4xl font-bold text-slate-900 dark:text-white">{dashboardKpis.somAverage}%</h3>
                                    {remediationSnapshot && !remediationSnapshot.isDemoBypass && (
                                        <span className={`text-xs font-medium mb-1 ${remediationSnapshot.deltaSom >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {remediationSnapshot.deltaSom >= 0 ? `+${remediationSnapshot.deltaSom}` : remediationSnapshot.deltaSom}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500">Narrative share across LLM families</p>
                                
                                {/* TOOLTIP */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                    <div className="p-3 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-[10px] shadow-2xl w-48 border border-white/10 ring-4 ring-black/5">
                                        <p className="font-bold mb-1 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-indigo-400" /> AI Recommendation Share</p>
                                        <p className="leading-relaxed opacity-80 italic">"The percentage of buyer queries where AI recommends you with your verified claims intact."</p>
                                    </div>
                                </div>
                            </div>

                            <div className="group relative rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">AI Rec. Frequency (ARF)</p>
                                    <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
                                        <ShieldAlert className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="flex items-end gap-2 mb-1">
                                    <h3 className="text-4xl font-bold text-slate-900 dark:text-white">{dashboardKpis.topCompetitorPressure}%</h3>
                                </div>
                                <p className="text-xs text-slate-500">Preference toward <span className="font-bold">{dashboardKpis.topCompetitorName}</span></p>

                                {/* TOOLTIP */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                    <div className="p-3 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-[10px] shadow-2xl w-48 border border-white/10 ring-4 ring-black/5">
                                        <p className="font-bold mb-1 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-rose-400" /> Defining ARF</p>
                                        <p className="leading-relaxed opacity-80 italic">How often AI prefers {dashboardKpis.topCompetitorName} over you in buyer-intent scenarios.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="group relative rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm hover:shadow-md transition-all text-emerald-500">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Winning Narrative</p>
                                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                                        <Award className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="flex items-end gap-2 mb-1">
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white truncate max-w-[150px]">
                                        {queryClusterInsights && queryClusterInsights.length > 0 ? queryClusterInsights[0].category : "None"}
                                    </h3>
                                </div>
                                <p className="text-xs text-slate-500">Highest brand authority cluster</p>
                            </div>

                            <div className="group relative rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Visibility Gaps</p>
                                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                                        <TrendingUp className="w-4 h-4 rotate-180" />
                                    </div>
                                </div>
                                <div className="flex items-end gap-2 mb-1">
                                    <h3 className="text-4xl font-bold text-slate-900 dark:text-white">{weakClusters.length}</h3>
                                </div>
                                <p className="text-xs text-slate-500">Buyer intent clusters requiring action</p>
                            </div>
                        </>
                    )}
                </div>


                {/* EXECUTIVE NARRATIVE */}
                <div className="rounded-3xl p-10 border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-bl-[120px] pointer-events-none" />
                    <div className="flex items-center gap-2 mb-6 text-indigo-600 dark:text-indigo-400">
                        <BriefcaseBusiness className="w-5 h-5" />
                        <h2 className="text-xs font-extrabold uppercase tracking-[0.3em]">Strategy Insight</h2>
                    </div>
                    <p className="text-2xl md:text-3xl font-medium text-slate-800 dark:text-slate-100 leading-relaxed first-letter:text-6xl first-letter:font-bold first-letter:text-indigo-600 first-letter:mr-3 first-letter:float-left first-letter:leading-none">
                        {executiveSummary}
                    </p>
                    
                    <div className="mt-10 flex flex-wrap gap-4 pt-8 border-t border-slate-100 dark:border-white/5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-8">
                             <div className="space-y-1">
                                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Observed Outcome</p>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{weakClusters[0]?.observedOutcome || "Narrative drift detected in core categories."}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Winning Competitor</p>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{weakClusters[0]?.winningCompetitor || dashboardKpis.topCompetitorName}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Priority Remediation</p>
                                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{weakClusters[0]?.missingClaims[0] || "Inject missing capability assertions."}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between w-full">
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsCertificateOpen(true)}
                                    className="px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center gap-3 shadow-xl shadow-indigo-500/30 transition-all active:scale-95"
                                >
                                    <FilePenLine className="w-5 h-5" />
                                    View Brand Health Report
                                </button>
                                <button
                                    onClick={runBatchStabilityCheck}
                                    disabled={batchLoading}
                                    className="px-8 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-bold text-sm flex items-center gap-3 transition-all active:scale-95"
                                >
                                    <Activity className={`w-5 h-5 ${batchLoading ? 'animate-spin' : ''}`} />
                                    {batchLoading ? 'Processing Audit...' : 'Re-Run Enterprise Audit'}
                                </button>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Analysis Stability</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="flex gap-0.5">
                                        {[1, 2, 3, 4, 5].map(i => <div key={i} className={`w-1 h-3 rounded-full ${i <= 4 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />)}
                                    </div>
                                    <span className="text-xs font-bold text-emerald-500">High Confidence</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* STEP 2: INTELLIGENCE (Risk/Opportunity) */}
            {(view === "all" || view === "intelligence") && (
                <div className="space-y-12 mb-12 animate-in slide-in-from-bottom duration-500">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500">
                                <Award className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Step 2: Competitive Intelligence</h2>
                                <p className="text-sm text-slate-500">Where you are winning vs losing in the Generative Search ecosystem.</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                            {/* Query Clusters */}
                            <QueryClusterInsights loading={loading} insights={queryClusterInsights} />

                            {/* Long-term Trends */}
                            <div className="rounded-2xl p-8 border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-400">Positioning Stability Trend</h3>
                                    <div className="flex gap-2">
                                        {modelTabs.map(m => (
                                            <button key={m} onClick={() => setActiveTab(m)} className={`px-3 py-1 rounded-lg text-[10px] uppercase font-bold tracking-widest transition-all ${activeTab === m ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{m}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="h-[300px] w-full">
                                    {loading ? (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-100/30 dark:bg-slate-800/20 rounded-xl animate-pulse">
                                            <p className="text-xs text-slate-400">Loading historical signals...</p>
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData}>
                                                <defs>
                                                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} strokeOpacity={0.1} />
                                                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                                <YAxis stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700 }} domain={[0, 100]} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }} />
                                                <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} fill="url(#trendGradient)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-8">
                            {/* Competitor Leaderboard */}
                            <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 shadow-xl">
                                <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-400 mb-6">Market Displacement</h3>
                                <div className="space-y-6">
                                    {competitorRanking.length === 0 ? (
                                        <div className="py-4 text-center">
                                            <p className="text-xs text-slate-500 uppercase font-bold">No competitors detected</p>
                                        </div>
                                    ) : (
                                    <div className="space-y-3">
                                    <p className="text-xs font-bold text-rose-500 dark:text-rose-400 uppercase tracking-widest mb-1">Top Competitive Risk</p>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{dashboardKpis.topCompetitorName}</h3>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 bg-slate-100 dark:bg-white/5 h-2 rounded-full overflow-hidden">
                                            <div className="bg-rose-500 h-full transition-all duration-1000" style={{ width: `${dashboardKpis.topCompetitorPressure}%` }}></div>
                                        </div>
                                        <span className="text-sm font-black text-rose-500">{dashboardKpis.topCompetitorPressure}% ARF</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2 italic">
                                        * AI Recommendation Frequency (ARF): Percentage of simulations where this rival was preferred over you.
                                    </p>
                                    </div>
                                    )}
                                </div>
                            </div>

                            {/* Context Radar */}
                            <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 shadow-xl">
                                <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-400 mb-4">Context Radar Analysis</h3>
                                <div className="h-[240px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                            <PolarGrid stroke="#334155" />
                                            <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748b", fontSize: 9, fontWeight: 700 }} />
                                            <Radar name="Brand Profile" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.6} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Lower Intelligence Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* AI Search Readiness */}
                        <div className="rounded-2xl p-8 border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 shadow-xl">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center mb-6">
                                <Globe className="w-5 h-5 mr-3 text-emerald-500" />
                                AI Search Readiness
                            </h2>
                            {["growth", "scale", "enterprise"].includes(organization?.subscriptionTier || "explorer") ? (
                                <div className="space-y-6">
                                    <div className="flex gap-2">
                                        <input
                                            type="url"
                                            value={seoUrl}
                                            onChange={(e) => setSeoUrl(e.target.value)}
                                            placeholder="https://yourbusiness.com"
                                            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        />
                                        <button
                                            onClick={runSEOAudit}
                                            disabled={seoLoading || !seoUrl}
                                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                                        >
                                            {seoLoading ? "Auditing..." : "Audit"}
                                        </button>
                                    </div>
                                    {seoResult && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-center">
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">SEO Score</p>
                                                    <p className={`text-2xl font-black ${seoResult.seoScore >= 70 ? 'text-emerald-500' : 'text-amber-500'}`}>{seoResult.seoScore}%</p>
                                                </div>
                                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-center">
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">AI Search Readiness</p>
                                                    <p className={`text-2xl font-black ${seoResult.geoScore >= 50 ? 'text-emerald-500' : 'text-rose-500'}`}>{seoResult.geoScore}%</p>
                                                </div>
                                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-center">
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Overall</p>
                                                    <p className="text-2xl font-black text-indigo-500">{seoResult.overallScore}%</p>
                                                </div>
                                            </div>
                                            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                                                    <Sparkles className="w-3 h-3 inline mr-2 text-indigo-400" />
                                                    {seoResult.recommendation}
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            ) : (
                                <div className="py-8 text-center bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                                    <Lock className="w-8 h-8 mx-auto text-slate-400 mb-4" />
                                    <p className="text-sm text-slate-600 dark:text-slate-400">Upgrade to unlock AI Search Readiness audits.</p>
                                    <button onClick={() => setIsUpgradeModalOpen(true)} className="mt-4 text-xs font-bold text-indigo-500 hover:underline">View Scaling Plans</button>
                                </div>
                            )}
                        </div>

                        {/* Displacement Alerts */}
                        <div className="rounded-2xl p-8 border border-rose-500/10 bg-white dark:bg-slate-900 shadow-xl overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-4">
                                <ShieldAlert className="w-12 h-12 text-rose-500/10" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center mb-6">
                                <Activity className="w-5 h-5 mr-3 text-rose-500" />
                                Active Displacement Alerts
                            </h2>
                            <div className="space-y-4">
                                {loading ? (
                                    Array(3).fill(0).map((_, i) => (
                                        <div key={i} className="animate-pulse bg-slate-100 dark:bg-slate-800/40 h-16 rounded-xl w-full"></div>
                                    ))
                                ) : fidelityRisks.length > 0 ? (
                                    fidelityRisks.map((risk) => (
                                        <div key={risk.id} className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex items-center justify-between group hover:border-rose-500/30 transition-all">
                                            <div>
                                                <p className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-1">{normalizeModelName(risk.model)}</p>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{risk.text}</p>
                                            </div>
                                            <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${risk.severity === 'high' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'}`}>
                                                {risk.severity}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-12 text-center text-slate-400">
                                        <p className="text-sm font-medium">Monitoring complete.</p>
                                        <p className="text-[10px] mt-1 font-bold">No high-risk competitive displacement detected.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* STEP 3: ACTION (Prescriptive Remediation) */}
            {(view === "all" || view === "action") && (
                <div className="space-y-6">
                     <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl dark:shadow-none">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <FilePenLine className="w-4 h-4 text-fuchsia-500" />
                                <h2 className="text-lg font-medium text-slate-900 dark:text-white font-bold">Step 3: Action Center</h2>
                            </div>
                            <button
                                onClick={() => setIsCertificateOpen(true)}
                                className="px-4 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-all flex items-center gap-2"
                            >
                                <FileText className="w-4 h-4" />
                                View Full Report
                            </button>
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
                </div>
            )}

            {/* Brand Health Certificate Modal */}
            <AnimatePresence>
                {isCertificateOpen && (
                    <BrandHealthCertificate
                        organizationName={analysisSubject}
                        asovScore={avgScore}
                        driftRate={batchResult?.driftRate || 0}
                        onClose={handleCloseCertificate}
                        modelResults={filteredHistoryEntries && filteredHistoryEntries.length > 0 ? [...filteredHistoryEntries].reverse()[0]?.results : undefined}
                        lastPrompt={filteredHistoryEntries && filteredHistoryEntries.length > 0 ? [...filteredHistoryEntries].reverse()[0]?.prompt : undefined}
                        seoResult={seoResult || undefined}
                         competitors={competitors.map((c: CompetitorInsight) => ({
                                ...c,
                                missingAssertions: (c.missingAssertions || [])
                                    .map((a) => typeof a === "string" ? a : (a as { assertion?: string }).assertion || "")
                                    .filter((a) => a),
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
        </div>
    );
}
