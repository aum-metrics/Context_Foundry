"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, ArrowUpRight, Search, ShieldAlert, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { db } from "@/lib/firestorePaths";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { useOrganization } from "./OrganizationContext";

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
    const [activeTab, setActiveTab] = useState<"gpt4" | "claude" | "gemini">("gpt4");
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState<Record<string, unknown>[]>([]);
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchResult, setBatchResult] = useState<{ domainStability: number, hallucinationRate: number } | null>(null);
    const [modelAverages, setModelAverages] = useState<Record<string, number>>({});
    const [hallucinationRisks, setHallucinationRisks] = useState<{ id: number; model: string; text: string; severity: string }[]>([]);

    // SEO Audit state
    const [seoUrl, setSeoUrl] = useState("");
    const [seoLoading, setSeoLoading] = useState(false);
    const [seoResult, setSeoResult] = useState<SEOResult | null>(null);

    const runBatchStabilityCheck = async () => {
        if (!organization) return;
        setBatchLoading(true);
        try {
            const response = await fetch('/api/batch/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            setBatchResult(data);
            if (data.modelAverages) setModelAverages(data.modelAverages);
        } catch (err) {
            console.error("Batch Error:", err);
        } finally {
            setBatchLoading(false);
        }
    };

    const runSEOAudit = async () => {
        if (!seoUrl || !organization) return;
        setSeoLoading(true);
        try {
            const response = await fetch('/api/seo/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: seoUrl, orgId: organization.id })
            });
            const data = await response.json();
            setSeoResult(data);
        } catch (err) {
            console.error("SEO Audit Error:", err);
        } finally {
            setSeoLoading(false);
        }
    };

    useEffect(() => {
        if (!organization) return;
        setLoading(true);
        const fetchScoringHistory = async () => {
            try {
                if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash") {
                    setChartData(fallbackData[activeTab]);
                    setLoading(false);
                    return;
                }

                // Fetch real scoring history from Firestore
                const historyRef = collection(db, "organizations", organization.id, "scoringHistory");
                const q = query(historyRef, orderBy("timestamp", "desc"), limit(20));
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    setChartData(fallbackData[activeTab]);
                    setLoading(false);
                    return;
                }

                // Transform scoring history into chart data per model
                const modelMap: Record<string, string> = { gpt4: "GPT-4o Mini", claude: "Claude 3.5 Haiku", gemini: "Gemini 2.0 Flash" };
                const targetModel = modelMap[activeTab];
                const dataPoints: { name: string; score: number }[] = [];
                const risks: { id: number; model: string; text: string; severity: string }[] = [];
                let riskId = 1;

                const entries: ScoringHistoryEntry[] = [];
                snapshot.forEach(doc => entries.push(doc.data() as ScoringHistoryEntry));
                entries.reverse(); // oldest first for chart

                for (const entry of entries) {
                    const ts = entry.timestamp?.seconds ? new Date(entry.timestamp.seconds * 1000) : new Date();
                    const label = ts.toLocaleDateString("en-US", { weekday: "short" });
                    const modelResult = entry.results?.find(r => r.model === targetModel);
                    if (modelResult) {
                        dataPoints.push({ name: label, score: modelResult.accuracy });
                    }

                    // Collect hallucination risks
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

                if (dataPoints.length > 0) {
                    setChartData(dataPoints);
                } else {
                    setChartData(fallbackData[activeTab]);
                }

                setHallucinationRisks(risks.slice(0, 5));
            } catch (err) {
                console.error("Scoring history fetch error:", err);
                setChartData(fallbackData[activeTab]);
            }
            setLoading(false);
        };
        fetchScoringHistory();
    }, [activeTab, organization]);

    // Compute display values
    const avgScore = chartData.length > 0
        ? Math.round(chartData.reduce((sum, d) => sum + ((d as { score: number }).score || 0), 0) / chartData.length)
        : 0;

    return (
        <div className="w-full h-full animate-fade-in font-sans">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 pb-6 border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 relative p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 backdrop-blur-md flex items-center justify-center">
                        <Image src="/favicon.ico" alt="AUM Logo" width={32} height={32} className="object-contain drop-shadow-lg" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-light text-slate-900 dark:text-white tracking-tight">SoM Command Center</h1>
                        <p className="text-slate-500 text-sm mt-1">Live scoring across GPT-4, Gemini, and Claude</p>
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
                        disabled={batchLoading}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs px-4 py-2 rounded-lg transition-colors flex items-center"
                    >
                        <Activity className={`w-3 h-3 mr-2 ${batchLoading ? 'animate-spin' : ''}`} />
                        {batchLoading ? 'Analyzing...' : 'Run Batch Analysis'}
                    </button>
                    <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avg Accuracy</p>
                        <div className="flex items-center space-x-2">
                            <span className="text-4xl font-light text-cyan-400">{avgScore || "—"}</span>
                            {avgScore > 0 && <span className="text-lg text-slate-500">%</span>}
                        </div>
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
                                {(["gpt4", "claude", "gemini"] as const).map((model) => (
                                    <button
                                        key={model}
                                        onClick={() => setActiveTab(model)}
                                        className={`px-4 py-1.5 text-sm rounded-md transition-all ${activeTab === model
                                            ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30"
                                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                                            }`}
                                    >
                                        {model === "gpt4" ? "GPT-4o" : model === "claude" ? "Claude" : "Gemini"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loading ? (
                            <div className="h-[300px] flex items-center justify-center animate-pulse">
                                <div className="w-full h-full bg-slate-800/50 rounded-xl"></div>
                            </div>
                        ) : (
                            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="h-[300px] w-full">
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

                    {/* SEO/GEO Audit Panel */}
                    <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl dark:shadow-none">
                        <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center mb-4">
                            <Globe className="w-4 h-4 mr-2 text-emerald-500" />
                            SEO + GEO Readiness Audit
                        </h2>
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
                </div>

                <div className="space-y-6">
                    {/* Model Comparison Bars */}
                    <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-6 shadow-xl dark:shadow-none">
                        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-6">Model Accuracy Comparison</h3>
                        <div className="space-y-6">
                            {[
                                { name: "GPT-4o Mini", key: "GPT-4o Mini", fallback: 92 },
                                { name: "Claude 3.5 Haiku", key: "Claude 3.5 Haiku", fallback: 75 },
                                { name: "Gemini 2.0 Flash", key: "Gemini 2.0 Flash", fallback: 70 },
                            ].map((model, i) => {
                                const score = modelAverages[model.key] || model.fallback;
                                return (
                                    <div key={model.name}>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="font-medium text-slate-900 dark:text-white">{model.name}</span>
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

                    {/* Hallucination Risk Ticker */}
                    <div className="rounded-2xl p-6 border border-rose-500/10 bg-white dark:bg-gradient-to-b dark:from-slate-900/50 dark:to-slate-950/50 shadow-xl dark:shadow-none">
                        <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center mb-6">
                            <ShieldAlert className="w-4 h-4 mr-2 text-rose-500" />
                            Hallucination Risk Ticker
                        </h2>
                        <div className="space-y-4">
                            {loading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <div key={i} className="animate-pulse bg-slate-800/40 h-16 rounded-lg w-full"></div>
                                ))
                            ) : hallucinationRisks.length > 0 ? (
                                hallucinationRisks.map((risk) => (
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
                                    <p className="text-sm text-slate-500">No hallucinations detected yet.</p>
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
            </div>
        </div>
    );
}
