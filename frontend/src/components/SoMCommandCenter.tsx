"use client";

import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, Brain, ArrowUpRight, Search, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { db } from "@/lib/firestorePaths";
import { collection, doc, getDocs, setDoc, query } from "firebase/firestore";
import { useOrganization } from "./OrganizationContext";

const mockData = {
    gemini: [
        { name: "Mon", score: 45 }, { name: "Tue", score: 52 }, { name: "Wed", score: 49 },
        { name: "Thu", score: 60 }, { name: "Fri", score: 65 }, { name: "Sat", score: 62 }, { name: "Sun", score: 70 }
    ],
    claude: [
        { name: "Mon", score: 60 }, { name: "Tue", score: 58 }, { name: "Wed", score: 63 },
        { name: "Thu", score: 68 }, { name: "Fri", score: 72 }, { name: "Sat", score: 69 }, { name: "Sun", score: 75 }
    ],
    gpt4: [
        { name: "Mon", score: 80 }, { name: "Tue", score: 82 }, { name: "Wed", score: 81 },
        { name: "Thu", score: 85 }, { name: "Fri", score: 89 }, { name: "Sat", score: 92 }, { name: "Sun", score: 95 }
    ]
};

const hallucinationRisks = [
    { id: 1, model: "GPT-4", text: "Citing outdated pricing ($49/mo instead of $99/mo).", severity: "high" },
    { id: 2, model: "Claude 3.5", text: "Missing 'Context Foundry' feature in summary.", severity: "medium" },
    { id: 3, model: "Gemini 1.5", text: "Incorrectly associating product with legacy 'Data Labs'.", severity: "high" },
];

export default function SoMCommandCenter() {
    const { organization } = useOrganization();
    const [activeTab, setActiveTab] = useState<"gemini" | "claude" | "gpt4">("gpt4");
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState<Record<string, unknown>[]>([]);

    useEffect(() => {
        if (!organization) return;
        setLoading(true);
        const fetchOrSeedData = async () => {
            try {
                // Check cache
                const globalLcrsData = (window as unknown as { __lcrsData?: Record<string, Record<string, unknown>[]> }).__lcrsData;
                if (globalLcrsData && globalLcrsData[activeTab]) {
                    setChartData(globalLcrsData[activeTab]);
                    setLoading(false);
                    return;
                }

                if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash") {
                    setChartData(mockData[activeTab]);
                    setLoading(false);
                    return;
                }

                const snapshot = await getDocs(query(collection(db, "organizations", organization.id, "lcrs_metrics")));

                const dbData: Record<string, Record<string, unknown>[]> = {};
                if (snapshot.empty) {
                    // Auto-seed initial Data
                    for (const model of ["gpt4", "claude", "gemini"]) {
                        await setDoc(doc(db, "organizations", organization.id, "lcrs_metrics", model), { points: mockData[model as keyof typeof mockData] });
                        dbData[model] = mockData[model as keyof typeof mockData];
                    }
                } else {
                    snapshot.forEach(docSnap => {
                        dbData[docSnap.id] = docSnap.data().points;
                    });
                }

                (window as unknown as { __lcrsData: Record<string, Record<string, unknown>[]> }).__lcrsData = dbData;
                setChartData(dbData[activeTab] || mockData[activeTab]);
            } catch (err) {
                console.error("Firestore Error:", err);
                setChartData(mockData[activeTab]); // Graceful fallback
            }
            setLoading(false);
        };
        fetchOrSeedData();
    }, [activeTab, organization]);

    return (
        <div className="w-full h-full animate-fade-in font-sans">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 pb-6 border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center space-x-4">
                    <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 backdrop-blur-md">
                        <Brain className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-light text-slate-900 dark:text-white tracking-tight">AUM Context Foundry</h1>
                        <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest">Generative Engine Optimization (GEO)</p>
                    </div>
                </div>
                <div className="mt-4 md:mt-0 flex items-center space-x-6">
                    <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Global ASoV Index</p>
                        <div className="flex items-center space-x-2">
                            <span className="text-4xl font-light text-cyan-400">84.2</span>
                            <span className="flex items-center text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                                <ArrowUpRight className="w-3 h-3 mr-1" />
                                2.4%
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl dark:shadow-none">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center">
                                <Search className="w-4 h-4 mr-2 text-indigo-500 dark:text-indigo-400" />
                                Recommendation Share (LCRS)
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
                                        {model === "gpt4" ? "GPT-4.5" : model === "claude" ? "Claude 3.7 Sonnet" : "Gemini 2.5 Pro"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loading ? (
                            <div className="h-[300px] flex items-center justify-center animate-pulse">
                                <div className="w-full h-full bg-slate-800/50 rounded-xl"></div>
                            </div>
                        ) : (
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4 }}
                                className="h-[300px] w-full"
                            >
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
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                                            itemStyle={{ color: '#c7d2fe' }}
                                        />
                                        <Area type="monotone" dataKey="score" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </motion.div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-8 flex flex-col justify-center items-center shadow-xl dark:shadow-none">
                        <div className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-4">Global ASoV Index</div>
                        <div className="text-6xl font-light text-slate-900 dark:text-white flex items-baseline">
                            84.2<span className="text-3xl text-slate-400 ml-1">%</span>
                        </div>
                        <div className="mt-4 text-emerald-500 text-sm font-medium bg-emerald-500/10 px-3 py-1 rounded-full flex items-center">
                            <ArrowUpRight className="w-4 h-4 mr-1" />
                            +12.4% vs Last Quarter
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-6 shadow-xl dark:shadow-none flex flex-col justify-center">
                        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-6">Recommendation Share by Frontier Model</h3>
                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="font-medium text-slate-900 dark:text-white">GPT-4.5</span>
                                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">95%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: "95%" }} transition={{ duration: 1, ease: "easeOut" }} className="h-full bg-indigo-500 rounded-full" />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="font-medium text-slate-900 dark:text-white">Claude 3.7 Sonnet</span>
                                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">88%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: "88%" }} transition={{ duration: 1, delay: 0.2, ease: "easeOut" }} className="h-full bg-indigo-500/80 rounded-full" />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="font-medium text-slate-900 dark:text-white">Gemini 2.5 Pro</span>
                                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">81%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: "81%" }} transition={{ duration: 1, delay: 0.4, ease: "easeOut" }} className="h-full bg-indigo-500/60 rounded-full" />
                                </div>
                            </div>
                        </div>
                    </div>
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
                            ) : (
                                hallucinationRisks.map((risk) => (
                                    <div key={risk.id} className="p-4 rounded-lg bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/30 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">{risk.model}</span>
                                            <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                                        </div>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{risk.text}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        {!loading && (
                            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
                                <span className="text-xs text-slate-500 uppercase">System Status</span>
                                <span className="text-xs text-emerald-400 flex items-center">
                                    <Activity className="w-3 h-3 mr-1" />
                                    Monitoring Active
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
