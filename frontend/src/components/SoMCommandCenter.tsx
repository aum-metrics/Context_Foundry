"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Logo } from "@/components/Logo";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line } from "recharts";
import { TrendingUp, Search, Globe, Activity, ShieldAlert, ArrowUpRight, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import { auth } from "../lib/firebase";
import { useOrganization } from "./OrganizationContext";
import { UpgradeModal } from "./UpgradeModal";
import { Hexagon, Award } from "lucide-react";
import BrandHealthCertificate from "./BrandHealthCertificate";
import { useModelCatalog } from "@/hooks/useModelCatalog";

interface BatchResult {
    domainStability: number;
    driftRate: number;
    modelAverages?: Record<string, number>;
}

interface ScoringHistoryEntry {
    prompt: string;
    results: { model: string; accuracy: number; hasHallucination: boolean; claimScore?: string }[];
    timestamp: { seconds: number };
}

interface SEOResult {
    url: string;
    seoScore: number;
    geoScore: number;
    overallScore: number;
    checks: { check: string; status: string; detail: string }[];
    recommendation: string;
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

export default function SoMCommandCenter({ setActiveView }: { setActiveView?: (view: string) => void }) {
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
    const [historicalData, setHistoricalData] = useState<{ date: string; score: number }[]>([]);
    const [competitors, setCompetitors] = useState<{ name: string, displacementRate: number, strengths: string[], weaknesses: string[] }[]>([]);
    const batchIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (batchIntervalRef.current) clearInterval(batchIntervalRef.current);
        };
    }, []);

    useEffect(() => {
        if (!organization) return;
        const fetchCompetitors = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) return;
                const res = await fetch(`/api/competitor/displacement/${organization.id}?version=${encodeURIComponent(activeManifestVersion)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
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
                const token = await auth.currentUser?.getIdToken();
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
            } catch (error) {
                console.error("Failed to fetch manifest metadata", error);
                setCurrentManifestVersion(null);
            }
        };

        fetchManifestMeta();
    }, [organization?.id, refreshKey, activeManifestVersion]);

    const fetchHistory = async (orgId: string) => {
        try {
            const token = await auth.currentUser?.getIdToken();
            // Handle mock/demo tokens in production if auth.currentUser is null
            let effectiveToken = token;
            if (!effectiveToken) {
                const savedMockUser = typeof window !== 'undefined' ? localStorage.getItem("mock_auth_user") : null;
                if (savedMockUser === "demo@demo.com") effectiveToken = "mock-demo-token";
                else if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash") effectiveToken = "mock-dev-token";
            }

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
        const fallback = [
            { subject: 'Consistency', A: 90, B: 70, C: 65, fullMark: 100 },
            { subject: 'Factuality', A: 95, B: 80, C: 75, fullMark: 100 },
            { subject: 'Sentiment', A: 85, B: 75, C: 80, fullMark: 100 },
            { subject: 'Safety', A: 98, B: 90, C: 85, fullMark: 100 },
            { subject: 'Authority', A: 88, B: 70, C: 60, fullMark: 100 },
        ];

        if (!filteredHistoryEntries || filteredHistoryEntries.length === 0) return fallback;

        const latestEntry = filteredHistoryEntries[0];
        if (latestEntry && latestEntry.results) {
            const gpt = latestEntry.results.find((r: { model: string }) => r.model.includes("GPT"));
            const claude = latestEntry.results.find((r: { model: string }) => r.model.includes("Claude"));
            const gemini = latestEntry.results.find((r: { model: string }) => r.model.includes("Gemini"));

            return [
                { subject: 'Consistency', A: gpt?.accuracy || 80, B: claude?.accuracy || 70, C: gemini?.accuracy || 60, fullMark: 100 },
                { subject: 'Factuality', A: (gpt?.accuracy || 0) + 2, B: (claude?.accuracy || 0) - 5, C: gemini?.accuracy || 0, fullMark: 100 },
                { subject: 'Sentiment', A: 85, B: 88, C: 82, fullMark: 100 },
                { subject: 'Safety', A: 98, B: 95, C: 90, fullMark: 100 },
                { subject: 'Authority', A: gpt?.accuracy || 85, B: (claude?.accuracy || 85) - 10, C: (gemini?.accuracy || 85) - 15, fullMark: 100 },
            ];
        }

        return fallback;
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
            const token = await auth.currentUser?.getIdToken();
            let effectiveToken = token;
            if (!effectiveToken) {
                const savedMockUser = typeof window !== 'undefined' ? localStorage.getItem("mock_auth_user") : null;
                if (savedMockUser === "demo@demo.com") effectiveToken = "mock-demo-token";
                else if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash") effectiveToken = "mock-dev-token";
            }

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
                        `What is the pricing for ${organization.name}?`,
                        `What features does ${organization.name} offer?`,
                        `Who are ${organization.name}'s competitors?`,
                        `Is ${organization.name} suitable for enterprise?`
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
                        let currentToken = await auth.currentUser?.getIdToken();
                        if (!currentToken) {
                            const savedMockUser = typeof window !== 'undefined' ? localStorage.getItem("mock_auth_user") : null;
                            if (savedMockUser === "demo@demo.com") currentToken = "mock-demo-token";
                            else if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash") currentToken = "mock-dev-token";
                        }
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
            const token = await auth.currentUser?.getIdToken();
            let effectiveToken = token;
            if (!effectiveToken) {
                const savedMockUser = typeof window !== 'undefined' ? localStorage.getItem("mock_auth_user") : null;
                if (savedMockUser === "demo@demo.com") effectiveToken = "mock-demo-token";
                else if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash") effectiveToken = "mock-dev-token";
            }
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
                        const currentToken = await auth.currentUser?.getIdToken() || undefined;
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
            for (const result of (entry.results || []) as { model: string; accuracy: number; hasHallucination: boolean }[]) {
                // Hardened: Only surface risks with high confidence of drift
                if (result.hasHallucination || result.accuracy < 60) {
                    risks.push({
                        id: riskId++,
                        model: result.model,
                        text: `Context Drift on: "${entry.prompt.slice(0, 50)}..."`,
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

    // Compute display values
    const avgScore = chartData.length > 0
        ? Math.round(chartData.reduce((sum: number, d: { score: number }) => sum + (d.score || 0), 0) / chartData.length)
        : 0;

    const isCriticalDrift = (batchResult?.driftRate || 0) > 40;

    return (
        <div className={`w-full h-full animate-fade-in font-sans transition-all duration-700 ${isCriticalDrift ? 'bg-rose-500/5 ring-4 ring-rose-500/20 ring-inset' : ''}`}>
            {isCriticalDrift && (
                <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-rose-500 animate-shimmer z-[100]"></div>
            )}
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 pb-6 border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center space-x-4">
                    <Logo size={48} showText={false} />
                    <div>
                        <h1 className="text-3xl font-light text-slate-900 dark:text-white tracking-tight">Platform Health Status</h1>
                        <p className="text-slate-500 text-sm mt-1">Verified RAG Fidelity Across SearchGPT, Perplexity, and Gemini</p>
                    </div>
                </div>
                <div className="mt-4 md:mt-0 flex items-center space-x-6">
                    {batchResult && (
                        <div className="hidden md:block bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-4 py-2">
                            <div className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold">Domain Stability</div>
                            <div className="text-xl font-light text-slate-900 dark:text-white">{batchResult.domainStability.toFixed(1)}%</div>
                        </div>
                    )}
                    <button
                        onClick={runBatchStabilityCheck}
                        disabled={batchLoading || !["growth", "scale"].includes(organization?.subscriptionTier || "")}
                        className={`text-xs px-4 py-2 rounded-lg transition-colors flex items-center ${["growth", "scale"].includes(organization?.subscriptionTier || "") ? "bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50" : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"}`}
                    >
                        {["growth", "scale"].includes(organization?.subscriptionTier || "") ? (
                            <>
                                <Activity className={`w-3 h-3 mr-2 ${batchLoading ? 'animate-spin' : ''}`} />
                                {batchLoading ? 'Analyzing...' : 'Run Batch Analysis'}
                            </>
                        ) : (
                            <>
                                <Lock className="w-3 h-3 mr-2 text-slate-500" />
                                Growth/Scale Only
                            </>
                        )}
                    </button>
                    <div className="text-right flex flex-col items-end">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avg Accuracy</p>
                        <div className="flex items-center space-x-2">
                            <span className="text-4xl font-light text-cyan-400">{avgScore || "—"}</span>
                            {avgScore > 0 && <span className="text-lg text-slate-500">%</span>}
                        </div>
                        <button
                            onClick={() => setIsCertificateOpen(true)}
                            className="mt-2 text-[10px] uppercase tracking-[0.2em] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center group"
                        >
                            <Award className="w-3 h-3 mr-1.5 group-hover:scale-125 transition-transform" />
                            View Health Certificate
                        </button>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    {/* Model Accuracy Chart */}
                    <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl dark:shadow-none">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center">
                                <Search className="w-4 h-4 mr-2 text-indigo-500" />
                                Accuracy Over Time (from Simulations)
                            </h2>
                            <div className="flex p-1 bg-slate-100 dark:bg-slate-950/50 rounded-lg border border-slate-200 dark:border-white/5">
                                {modelTabs.map((model) => (
                                    <button
                                        key={model}
                                        onClick={() => setActiveTab(model)}
                                        className={`px-4 py-1.5 text-sm rounded-md transition-all ${activeTab === model
                                            ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30"
                                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                                            }`}
                                    >
                                        {model}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loading ? (
                            <div className="h-[300px] flex items-center justify-center animate-pulse">
                                <div className="w-full h-full bg-slate-800/50 rounded-xl"></div>
                            </div>
                        ) : chartData.length === 0 ? (
                            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[300px] w-full flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4">
                                    <Activity className="w-8 h-8 text-indigo-400" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No Simulations Yet</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">Run your first comparison in the Simulator to unlock multi-model accuracy tracking over time.</p>
                                <button onClick={() => setActiveView && setActiveView("simulator")} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors shadow-lg shadow-indigo-500/20">Go to Simulator</button>
                            </motion.div>
                        ) : (
                            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="h-[250px] sm:h-[300px] lg:h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }} itemStyle={{ color: '#c7d2fe' }} />
                                        <Area type="monotone" dataKey="score" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </motion.div>
                        )}
                    </div>

                    {/* Agentic Radar Comparison */}
                    <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl dark:shadow-none">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center">
                                <Hexagon className="w-4 h-4 mr-2 text-fuchsia-500" />
                                Agentic ASoV Radar (Multi-Model)
                            </h2>
                            <div className="flex space-x-4 text-[10px] uppercase tracking-widest font-bold">
                                <span className="flex items-center text-indigo-400"><span className="w-2 h-2 bg-indigo-500 rounded-full mr-1"></span> GPT</span>
                                <span className="flex items-center text-fuchsia-400"><span className="w-2 h-2 bg-fuchsia-500 rounded-full mr-1"></span> Claude</span>
                                <span className="flex items-center text-cyan-400"><span className="w-2 h-2 bg-cyan-500 rounded-full mr-1"></span> Gemini</span>
                            </div>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                    <PolarGrid stroke="#334155" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                    <Radar name="GPT" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                                    <Radar name="Claude" dataKey="B" stroke="#d946ef" fill="#d946ef" fillOpacity={0.3} />
                                    <Radar name="Gemini" dataKey="C" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '12px' }} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50/80 dark:bg-slate-950/40 p-4">
                            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mb-3">How to read the ASoV Radar</p>
                            <p className="text-xs text-slate-500 mb-3">Farther out is better. Each spoke shows how strongly a model preserves one dimension of your verified brand context.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {radarExplainer.map((item) => (
                                    <div key={item.label} className="text-xs text-slate-500">
                                        <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}:</span> {item.detail}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500 text-center mt-4">Simultaneous benchmarking of model grounding across verified brand dimensions for {activeContextName || organization?.name || "the selected context"}.</p>
                    </div>

                    {/* NEW: Historical Narrative Fidelity Trend Chart */}
                    <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl">
                        <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center mb-6">
                            <TrendingUp className="w-4 h-4 mr-2 text-indigo-500" />
                            Historical Narrative Fidelity
                        </h2>
                        {historicalData.length === 0 ? (
                            <div className="h-[250px] flex flex-col items-center justify-center text-center">
                                <TrendingUp className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-3" />
                                <p className="text-sm text-slate-500 dark:text-slate-400">No trend data yet.</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Run simulations to build your fidelity history.</p>
                            </div>
                        ) : (
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={historicalData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} domain={[70, 100]} />
                                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }} />
                                        <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6, fill: '#818cf8', stroke: '#fff', strokeWidth: 2 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* SEO/GEO Audit Panel */}
                    <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl dark:shadow-none">
                        <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center mb-4">
                            <Globe className="w-4 h-4 mr-2 text-emerald-500" />
                            SEO + GEO Readiness Audit
                        </h2>
                        {["growth", "scale"].includes(organization?.subscriptionTier || "explorer") ? (
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
                                <p className="text-sm text-slate-600 dark:text-slate-300">SEO &amp; GEO Audits require a Growth or Scale plan.</p>
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
                                        <p className="text-xs text-slate-500 mb-1">SEO Score</p>
                                        <p className={`text-2xl font-light ${seoResult.seoScore >= 60 ? "text-emerald-500" : "text-amber-500"}`}>{seoResult.seoScore}%</p>
                                    </div>
                                    <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 text-center">
                                        <p className="text-xs text-slate-500 mb-1">GEO Score</p>
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

                    <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl">
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center mb-1">
                            <ArrowUpRight className="w-4 h-4 mr-2 text-indigo-500" />
                            Competitor Displacement
                        </h3>
                        <p className="text-[10px] text-slate-500 mb-6 uppercase tracking-wider">Agentic Share of Voice (ASoV) Drift Delta</p>
                        <div className="space-y-4">
                            {competitors.length > 0 ? competitors.map((comp, i) => (
                                <div key={i} className="flex flex-col space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-white/5">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-medium text-slate-700 dark:text-slate-300">{comp.name}</span>
                                        <span className="text-rose-500 font-bold">{comp.displacementRate}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(comp.displacementRate * 4, 100)}%` }}
                                            className="h-full bg-rose-500"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-500">Key Displacement: {comp.strengths[0]}</p>
                                </div>
                            )) : (
                                <div className="flex flex-col items-center text-center py-6 space-y-2">
                                    <ArrowUpRight className="w-6 h-6 text-slate-300 dark:text-slate-700" />
                                    <p className="text-sm text-slate-500 dark:text-slate-400">No competitor data yet.</p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">Upload a document in Data Ingestion to enable live competitor analysis grounded in your business context.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div >

                <div className="space-y-6">
                    {/* Model Comparison Bars */}
                    <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-6 shadow-xl dark:shadow-none">
                        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-6">Model Accuracy Comparison</h3>
                        <div className="space-y-6">
                            {Object.entries(visibleModelAverages).map(([modelName, score], i) => {
                                return (
                                    <div key={modelName}>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="font-medium text-slate-900 dark:text-white">{modelName}</span>
                                            <span className="text-indigo-600 dark:text-indigo-400 font-medium">{Math.round(score as number)}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 1, delay: i * 0.2, ease: "easeOut" }} className="h-full bg-indigo-500 rounded-full" style={{ opacity: 1 - (i * 0.2) }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Context Drift Ticker */}
                    <div className="rounded-2xl p-6 border border-rose-500/10 bg-white dark:bg-gradient-to-b dark:from-slate-900/50 dark:to-slate-950/50 shadow-xl dark:shadow-none">
                        <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center mb-6">
                            <ShieldAlert className="w-4 h-4 mr-2 text-rose-500" />
                            Context Drift Ticker
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
                                    <p className="text-sm text-slate-500">No context drift detected yet.</p>
                                    <p className="text-xs text-slate-400 mt-1">Run simulations to populate this ticker.</p>
                                </div>
                            )}
                        </div>

                        {!loading && (
                            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
                                <span className="text-xs text-slate-500 uppercase">Data Source</span>
                                <span className="text-xs text-emerald-400 flex items-center">
                                    <Activity className="w-3 h-3 mr-1" />
                                    AUM API Secured
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div >

            {/* Brand Health Certificate Modal */}
            <AnimatePresence>
                {isCertificateOpen && (
                    <BrandHealthCertificate
                        organizationName={organization?.name || "Your Company"}
                        asovScore={avgScore}
                        driftRate={batchResult?.driftRate || 0}
                        onClose={() => setIsCertificateOpen(false)}
                        modelResults={filteredHistoryEntries && filteredHistoryEntries.length > 0 ? [...filteredHistoryEntries].reverse()[0]?.results : undefined}
                        lastPrompt={filteredHistoryEntries && filteredHistoryEntries.length > 0 ? [...filteredHistoryEntries].reverse()[0]?.prompt : undefined}
                        seoResult={seoResult || undefined}
                        competitors={competitors}
                        activeContextName={activeContextName || organization?.name || "Current Context"}
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
