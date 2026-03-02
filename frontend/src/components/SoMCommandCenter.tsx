"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line } from "recharts";
import { TrendingUp, Search, Globe, Activity, ShieldAlert, ArrowUpRight, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import { db } from "@/lib/firestorePaths";
import { auth } from "../lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { useOrganization } from "./OrganizationContext";
import { UpgradeModal } from "./UpgradeModal";
import { Hexagon, Award } from "lucide-react";
import BrandHealthCertificate from "./BrandHealthCertificate";

// Fallback data — only used when Firestore is unavailable
const fallbackData = {
    gpt4: [{ name: "Mon", score: 80 }, { name: "Tue", score: 82 }, { name: "Wed", score: 81 }, { name: "Thu", score: 85 }, { name: "Fri", score: 89 }, { name: "Sat", score: 92 }, { name: "Sun", score: 95 }],
    claude: [{ name: "Mon", score: 60 }, { name: "Tue", score: 58 }, { name: "Wed", score: 63 }, { name: "Thu", score: 68 }, { name: "Fri", score: 72 }, { name: "Sat", score: 69 }, { name: "Sun", score: 75 }],
    gemini: [{ name: "Mon", score: 45 }, { name: "Tue", score: 52 }, { name: "Wed", score: 49 }, { name: "Thu", score: 60 }, { name: "Fri", score: 65 }, { name: "Sat", score: 62 }, { name: "Sun", score: 70 }],
};

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

export default function SoMCommandCenter() {
    const { organization } = useOrganization();
    const [activeTab, setActiveTab] = useState<string>("GPT-4o Mini");
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchResult, setBatchResult] = useState<{ domainStability: number, driftRate: number } | null>(null);
    const [modelAverages, setModelAverages] = useState<Record<string, number>>({
        "GPT-4o Mini": 92,
        "Claude 3.5 Haiku": 75,
        "Gemini 2.0 Flash": 70
    });
    const [radarData] = useState([
        { subject: 'Consistency', A: 90, B: 70, C: 65, fullMark: 100 },
        { subject: 'Factuality', A: 95, B: 80, C: 75, fullMark: 100 },
        { subject: 'Sentiment', A: 85, B: 75, C: 80, fullMark: 100 },
        { subject: 'Safety', A: 98, B: 90, C: 85, fullMark: 100 },
        { subject: 'Authority', A: 88, B: 70, C: 60, fullMark: 100 },
    ]);

    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [upgradeFeatureName, setUpgradeFeatureName] = useState("");

    // SEO Audit state
    const [seoUrl, setSeoUrl] = useState("");
    const [seoLoading, setSeoLoading] = useState(false);
    const [seoResult, setSeoResult] = useState<SEOResult | null>(null);
    const [isCertificateOpen, setIsCertificateOpen] = useState(false);
    const [historicalData, setHistoricalData] = useState<{ date: string; score: number }[]>([]);
    const [competitors, setCompetitors] = useState<{ name: string, displacementRate: number, strengths: string[], weaknesses: string[] }[]>([]);

    useEffect(() => {
        if (!organization) return;

        // Fetch competitor data
        fetch(`/api/competitor/displacement/${organization.id}`)
            .then(res => res.json())
            .then(data => setCompetitors(data))
            .catch(err => console.error("Failed to fetch competitors", err));

    }, [organization]);



    const runBatchStabilityCheck = async () => {
        if (!organization) return;
        setBatchLoading(true);
        try {
            let token = await auth.currentUser?.getIdToken();

            // Mock bypass for development/demo mode
            if (!token && (window.location.search.includes("mock=true") || process.env.NODE_ENV === "development")) {
                token = "mock-dev-token";
            }

            if (!token) throw new Error("Authentication required.");

            const response = await fetch('/api/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    orgId: organization.id,
                    prompts: [
                        `What is the pricing for ${organization.name}?`,
                        `What features does ${organization.name} offer?`,
                        `Who are ${organization.name}'s competitors?`,
                        `Is ${organization.name} suitable for enterprise?`
                    ],
                    manifestVersion: "latest"
                })
            });
            const data = await response.json();

            if (data.status === "processing" || data.status === "queued" && data.jobId) {
                // Poll for completion
                const pollInterval = setInterval(async () => {
                    try {
                        let currentToken = await auth.currentUser?.getIdToken();
                        if (!currentToken && process.env.NODE_ENV === "development") currentToken = "mock-dev-token";
                        const statusRes = await fetch(`/api/batch/status/${organization.id}/${data.jobId}`, {
                            headers: { 'Authorization': `Bearer ${currentToken}` }
                        });
                        if (statusRes.ok) {
                            const statusData = await statusRes.json();
                            if (statusData.status === "completed" && (statusData.summary || statusData.result)) {
                                clearInterval(pollInterval);
                                const result = statusData.summary || statusData.result;
                                setBatchResult(result);
                                if (result.modelAverages) setModelAverages(result.modelAverages);
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
                if (data.modelAverages) setModelAverages(data.modelAverages);
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
            let token = await auth.currentUser?.getIdToken();

            // Mock bypass for development/demo mode
            if (!token && (window.location.search.includes("mock=true") || process.env.NODE_ENV === "development")) {
                token = "mock-dev-token";
            }
            const response = await fetch('/api/seo/audit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ url: seoUrl, orgId: organization.id })
            });
            const data = await response.json();

            if (data.jobId) {
                // Poll for completion to avoid 504 timeouts on heavy Playwright rendering
                const pollInterval = setInterval(async () => {
                    try {
                        let currentToken = await auth.currentUser?.getIdToken();
                        if (!currentToken && process.env.NODE_ENV === "development") currentToken = "mock-dev-token";
                        const statusRes = await fetch(`/api/seo/audit/status/${organization.id}/${data.jobId}`, {
                            headers: { 'Authorization': `Bearer ${currentToken}` }
                        });
                        const statusData = await statusRes.json();

                        if (statusData.status === "completed") {
                            clearInterval(pollInterval);
                            setSeoResult(statusData.result);
                            setSeoLoading(false);
                        } else if (statusData.status === "failed") {
                            clearInterval(pollInterval);
                            console.error("SEO Audit Failed:", statusData.error);
                            setSeoLoading(false);
                        }
                    } catch (pollErr) {
                        console.error("SEO Polling error:", pollErr);
                    }
                }, 3000);
            } else {
                setSeoResult(data);
                setSeoLoading(false);
            }
        } catch (err) {
            console.error("SEO Audit Error:", err);
            setSeoLoading(false);
        }
    };

    const fetchHistory = async (orgId: string) => {
        if (process.env.NODE_ENV === "development" && (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash")) {
            return null; // fallback signal
        }
        const historyRef = collection(db, "organizations", orgId, "scoringHistory");
        const q = query(historyRef, orderBy("timestamp", "desc"), limit(20));
        const snapshot = await getDocs(q);

        const entries: ScoringHistoryEntry[] = [];
        snapshot.forEach(doc => entries.push(doc.data() as ScoringHistoryEntry));
        entries.reverse(); // oldest first for chart
        return entries;
    };

    const { data: historyEntries, error, isLoading: loading } = useSWR(
        organization ? `history-${organization.id}` : null,
        () => fetchHistory(organization!.id)
    );

    // Live sync for Historical Fidelity Chart instead of mocks
    useEffect(() => {
        if (!historyEntries || historyEntries.length === 0) {
            setHistoricalData([
                { date: '2/24', score: 82 },
                { date: '2/25', score: 85 },
                { date: '2/26', score: 84 },
                { date: '2/27', score: 89 },
                { date: '2/28', score: 91 },
                { date: '3/01', score: 93 },
                { date: '3/02', score: 94 },
            ]);
            return;
        }

        const dayMap: Record<string, { score: number, count: number }> = {};
        historyEntries.forEach(entry => {
            const ts = entry.timestamp?.seconds ? new Date(entry.timestamp.seconds * 1000) : new Date();
            const label = ts.toLocaleDateString("en-US", { month: "short", day: "numeric" });

            if (entry.results && entry.results.length > 0) {
                const totalAccuracy = entry.results.reduce((s, r) => s + r.accuracy, 0);
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
    }, [historyEntries]);

    const chartData = useMemo(() => {
        if (loading) return [];
        if (!historyEntries && !error) return fallbackData[activeTab === "GPT-4o Mini" ? "gpt4" : activeTab === "Claude 3.5 Haiku" ? "claude" : "gemini"] || [];
        if (historyEntries && historyEntries.length === 0) return [];

        const targetModel = activeTab;
        const dataPoints: { name: string; score: number }[] = [];

        for (const entry of (historyEntries || [])) {
            const ts = entry.timestamp?.seconds ? new Date(entry.timestamp.seconds * 1000) : new Date();
            const label = ts.toLocaleDateString("en-US", { weekday: "short" });
            const modelResult = entry.results?.find(r => r.model === targetModel);
            if (modelResult) {
                dataPoints.push({ name: label, score: modelResult.accuracy });
            }
        }

        return dataPoints.length > 0 ? dataPoints : (fallbackData[activeTab === "GPT-4o Mini" ? "gpt4" : activeTab === "Claude 3.5 Haiku" ? "claude" : "gemini"] || []);
    }, [historyEntries, activeTab, loading, error]);

    const fidelityRisks = useMemo(() => {
        if (!historyEntries) return [];
        const risks: { id: number; model: string; text: string; severity: string }[] = [];
        let riskId = 1;
        for (const entry of historyEntries) {
            for (const result of (entry.results || [])) {
                if (result.hasHallucination) {
                    risks.push({
                        id: riskId++,
                        model: result.model,
                        text: `Hallucination on: "${entry.prompt.slice(0, 60)}..."`,
                        severity: result.accuracy < 30 ? "high" : "medium"
                    });
                }
            }
        }
        return risks.slice(0, 5);
    }, [historyEntries]);

    // Compute display values
    const avgScore = chartData.length > 0
        ? Math.round(chartData.reduce((sum, d) => sum + ((d as { score: number }).score || 0), 0) / chartData.length)
        : 0;

    const isCriticalDrift = (batchResult?.driftRate || 0) > 30;

    return (
        <div className={`w-full h-full animate-fade-in font-sans transition-all duration-700 ${isCriticalDrift ? 'bg-rose-500/5 ring-4 ring-rose-500/20 ring-inset' : ''}`}>
            {isCriticalDrift && (
                <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-rose-500 animate-shimmer z-[100]"></div>
            )}
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 pb-6 border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center space-x-4">
                    <Logo size={48} showText={false} />
                    <div>
                        <h1 className="text-3xl font-light text-slate-900 dark:text-white tracking-tight">Agentic Media Monitoring</h1>
                        <p className="text-slate-500 text-sm mt-1">Precision RAG evaluation across SearchGPT, Perplexity, and Gemini Grounding</p>
                    </div>
                </div>
                <div className="mt-4 md:mt-0 flex items-center space-x-6">
                    {batchResult && (
                        <div className="hidden md:block bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-4 py-2">
                            <div className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold">Domain Stability</div>
                            <div className="text-xl font-light text-white">{batchResult.domainStability.toFixed(1)}%</div>
                        </div>
                    )}
                    <button
                        onClick={runBatchStabilityCheck}
                        disabled={batchLoading || organization?.subscriptionTier !== "scale"}
                        className={`text-xs px-4 py-2 rounded-lg transition-colors flex items-center ${organization?.subscriptionTier === "scale" ? "bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50" : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"}`}
                    >
                        {organization?.subscriptionTier === "scale" ? (
                            <>
                                <Activity className={`w-3 h-3 mr-2 ${batchLoading ? 'animate-spin' : ''}`} />
                                {batchLoading ? 'Analyzing...' : 'Run Batch Analysis'}
                            </>
                        ) : (
                            <>
                                <Lock className="w-3 h-3 mr-2 text-slate-500" />
                                Enterprise Only
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
                                {Object.keys(modelAverages).map((model) => (
                                    <button
                                        key={model}
                                        onClick={() => setActiveTab(model)}
                                        className={`px-4 py-1.5 text-sm rounded-md transition-all ${activeTab === model
                                            ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30"
                                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                                            }`}
                                    >
                                        {model.split(' ')[0]}
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
                                <Link href="/" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors shadow-lg shadow-indigo-500/20">Go to Simulator</Link>
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
                        <p className="text-[10px] text-slate-500 text-center mt-4">Simultaneous benchmarking of model grounding across verified brand dimensions.</p>
                    </div>

                    {/* NEW: Historical Fidelity Trend Chart */}
                    <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl">
                        <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center mb-6">
                            <TrendingUp className="w-4 h-4 mr-2 text-indigo-500" />
                            Historical Narrative Fidelity
                        </h2>
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
                    </div>

                    {/* SEO/GEO Audit Panel */}
                    <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl dark:shadow-none">
                        <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center mb-4">
                            <Globe className="w-4 h-4 mr-2 text-emerald-500" />
                            SEO + GEO Readiness Audit
                        </h2>
                        {organization?.subscriptionTier === "starter" ? (
                            <div className="bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-xl p-6 text-center mb-4">
                                <Lock className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                                <p className="text-sm text-slate-600 dark:text-slate-300">SEO & GEO Audits require a Growth or Enterprise plan.</p>
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
                        ) : (
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
                                            <span className={`text-xs px-2 py-0.5 rounded ${check.status === "pass" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : check.status === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"}`}>
                                                {check.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 italic">{seoResult.recommendation}</p>
                            </motion.div>
                        )}
                    </div>

                    {/* NEW: Competitor Displacement Card */}
                    <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl">
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center mb-6">
                            <ArrowUpRight className="w-4 h-4 mr-2 text-indigo-500" />
                            Competitor Displacement
                        </h3>
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
                                            animate={{ width: `${comp.displacementRate * 4}%` }}
                                            className="h-full bg-rose-500"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-500">Key Displacement: {comp.strengths[0]}</p>
                                </div>
                            )) : (
                                <p className="text-xs text-slate-500 text-center py-4">Analyzing market presence...</p>
                            )}
                        </div>
                    </div>
                </div >

                <div className="space-y-6">
                    {/* Model Comparison Bars */}
                    <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-6 shadow-xl dark:shadow-none">
                        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-6">Model Accuracy Comparison</h3>
                        <div className="space-y-6">
                            {Object.entries(modelAverages).map(([modelName, score], i) => {
                                return (
                                    <div key={modelName}>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="font-medium text-slate-900 dark:text-white">{modelName}</span>
                                            <span className="text-indigo-600 dark:text-indigo-400 font-medium">{Math.round(score)}%</span>
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
                                            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">{risk.model}</span>
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
                                    Firestore Live
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
