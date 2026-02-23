/**
 * Author: "Sambath Kumar Natarajan"
 * Date: "26-Dec-2025"
 * Org: " Start-up/AUM Data Labs"
 * Product: "Context Foundry"
 * Description: Multi-Model Co-Intelligence Simulator — tests across frontier models.
 */
"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Beaker, Send, AlertTriangle, Cpu, Zap, CheckCircle, XCircle, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOrganization } from "./OrganizationContext";
import { db } from "@/lib/firestorePaths";
import { doc, getDoc } from "firebase/firestore";

interface ModelResult {
    model: string;
    answer: string;
    accuracy: number;
    hasHallucination: boolean;
    error?: string;
}

export default function CoIntelligenceSimulator() {
    const { organization } = useOrganization();
    const [dynamicPrompts, setDynamicPrompts] = useState<string[]>([
        "What is the best enterprise solution for this category?",
        "How much does it cost?",
        "Does it have an AI integration?",
    ]);
    const [activePrompt, setActivePrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [manifestVersions, setManifestVersions] = useState<{ id: string, name: string }[]>([]);
    const [selectedVersion, setSelectedVersion] = useState("latest");
    const [modelResults, setModelResults] = useState<ModelResult[]>([]);
    const [lastPrompt, setLastPrompt] = useState("");

    useEffect(() => {
        if (!organization) return;
        setDynamicPrompts([
            `What is the core offering of ${organization.name}?`,
            `What is the pricing model for ${organization.name}?`,
            `Does ${organization.name} offer API integration?`,
            `Compare ${organization.name} against competitors.`
        ]);
        setActivePrompt(`What is the core offering of ${organization.name}?`);

        const fetchData = async () => {
            try {
                const orgRef = doc(db, "organizations", organization.id);
                const manifestDoc = await getDoc(doc(orgRef, "manifests", "default"));
                if (manifestDoc.exists() && manifestDoc.data().content) {
                    setManifestVersions([{ id: "latest", name: "Current Context" }, { id: "v1_baseline", name: "V1 Baseline (Earlier)" }]);
                } else {
                    setManifestVersions([{ id: "latest", name: "Current Context" }]);
                }
            } catch (e) {
                console.error("Manifest fetch error:", e);
                setManifestVersions([{ id: "latest", name: "Current Context" }]);
            }
        };
        fetchData();
    }, [organization]);

    const handleSimulate = async (promptText: string) => {
        if (!promptText || loading) return;
        setActivePrompt(promptText);
        setModelResults([]);
        setLastPrompt(promptText);
        setLoading(true);

        try {
            const response = await fetch('/api/simulation/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: promptText,
                    orgId: organization?.id,
                    manifestVersion: selectedVersion,
                }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ detail: "Simulation Engine Offline" }));
                throw new Error(err.detail || "Simulation Failed");
            }

            const data = await response.json();
            setModelResults(data.results || []);
        } catch (error) {
            console.error('Simulation Failed:', error);
            setModelResults([{
                model: "Error",
                answer: error instanceof Error ? error.message : "Unknown error",
                accuracy: 0,
                hasHallucination: true,
                error: error instanceof Error ? error.message : "Unknown error",
            }]);
        } finally {
            setLoading(false);
        }
    };

    const getAccuracyColor = (accuracy: number) => {
        if (accuracy >= 70) return "text-emerald-600 dark:text-emerald-400";
        if (accuracy >= 50) return "text-amber-600 dark:text-amber-400";
        return "text-rose-600 dark:text-rose-400";
    };

    const getAccuracyBg = (accuracy: number) => {
        if (accuracy >= 70) return "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20";
        if (accuracy >= 50) return "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20";
        return "bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20";
    };

    return (
        <div className="w-full h-full flex flex-col space-y-6 animate-fade-in font-sans">
            <header className="mb-2">
                <h2 className="text-2xl font-light text-slate-900 dark:text-white flex items-center">
                    <Beaker className="w-6 h-6 mr-3 text-amber-500" />
                    Co-Intelligence Simulator
                </h2>
                <p className="text-sm text-slate-500 mt-1">Test how accurately AI models represent your business. We run the same prompt across GPT-4o, Claude 3.5, and Gemini 2.0 Flash — then score each against your verified Context Document.</p>
            </header>

            <div className="flex-1 w-full flex flex-col lg:flex-row gap-6">

                {/* Left Panel: Prompts */}
                <div className="lg:w-1/3 flex flex-col space-y-4">
                    <div className="bg-white/50 dark:bg-slate-900/40 rounded-2xl p-5 border border-slate-200 dark:border-white/5 h-full flex flex-col shadow-xl dark:shadow-none backdrop-blur-xl">
                        <h3 className="text-sm font-medium text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-4 flex items-center">
                            <Zap className="w-4 h-4 mr-2 text-cyan-600 dark:text-cyan-400" /> Test Prompts
                        </h3>
                        <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                            {dynamicPrompts.map((p, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSimulate(p)}
                                    disabled={loading}
                                    className={`w-full text-left p-4 rounded-xl text-sm transition-all border ${activePrompt === p
                                        ? "bg-amber-50 text-amber-800 border-amber-200 shadow-sm dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200"
                                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-900 dark:border-white/5 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                        } ${loading ? "opacity-50 cursor-wait" : ""}`}
                                >
                                    &ldquo;{p}&rdquo;
                                </button>
                            ))}
                        </div>

                        <div className="mt-4 relative">
                            <input
                                type="text"
                                placeholder="Type a custom prompt..."
                                disabled={loading}
                                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl py-3 pl-4 pr-10 text-sm text-slate-900 dark:text-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors shadow-sm"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleSimulate((e.target as HTMLInputElement).value);
                                        (e.target as HTMLInputElement).value = "";
                                    }
                                }}
                            />
                            <button className="absolute right-3 top-3 text-slate-500 hover:text-amber-400 transition-colors">
                                <Send className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Version Selector */}
                        <div className="mt-4 flex items-center space-x-2">
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest">Context Version:</span>
                            <select
                                value={selectedVersion}
                                onChange={(e) => setSelectedVersion(e.target.value)}
                                className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/10 rounded px-2 py-1 outline-none text-slate-600 dark:text-slate-300"
                            >
                                {manifestVersions.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Multi-Model Results */}
                <div className="lg:w-2/3 flex flex-col rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50/80 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-xl dark:shadow-2xl">
                    <div className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-white/5 px-6 py-4">
                        <h3 className="text-sm font-medium text-slate-900 dark:text-white flex items-center">
                            <MessageSquare className="w-4 h-4 mr-2 text-amber-500" />
                            Multi-Model Accuracy Comparison
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Same prompt, different AI models. See who gets your business right.</p>
                    </div>

                    <div className="flex-1 p-6 overflow-y-auto space-y-4">

                        {/* Empty State */}
                        {modelResults.length === 0 && !loading && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-slate-500">
                                <Cpu className="w-12 h-12 mb-4 opacity-20" />
                                <p>Select a prompt to test how AI models describe your business.</p>
                                <p className="text-xs mt-2 max-w-md text-center opacity-60">We compare each AI response against your verified Context Document to detect inaccuracies and hallucinations.</p>
                            </motion.div>
                        )}

                        {/* Loading */}
                        {loading && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-slate-500">
                                <div className="w-10 h-10 rounded-full border-t-2 border-amber-500 animate-spin mb-4"></div>
                                <p className="text-sm">Running across frontier models...</p>
                                <p className="text-xs mt-1 opacity-60">Scoring each response against your Context Document</p>
                            </motion.div>
                        )}

                        {/* Prompt Display */}
                        {lastPrompt && modelResults.length > 0 && (
                            <div className="bg-amber-50 dark:bg-amber-600/10 text-amber-900 dark:text-amber-100 border border-amber-200 dark:border-amber-500/30 px-5 py-3 rounded-2xl text-sm">
                                <span className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider font-semibold">Prompt:</span>
                                <p className="mt-1">&ldquo;{lastPrompt}&rdquo;</p>
                            </div>
                        )}

                        {/* Score Summary Bar */}
                        {modelResults.length > 0 && !loading && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                            >
                                {modelResults.map((result, i) => (
                                    <div key={i} className={`rounded-xl border p-4 text-center ${getAccuracyBg(result.accuracy)}`}>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">{result.model}</p>
                                        <p className={`text-3xl font-light ${getAccuracyColor(result.accuracy)}`}>
                                            {result.error ? "—" : `${result.accuracy}%`}
                                        </p>
                                        <p className="text-[10px] mt-1 flex items-center justify-center space-x-1">
                                            {result.error ? (
                                                <span className="text-slate-400">Unavailable</span>
                                            ) : result.hasHallucination ? (
                                                <><XCircle className="w-3 h-3 text-rose-500" /><span className="text-rose-600 dark:text-rose-400">Hallucination Detected</span></>
                                            ) : (
                                                <><CheckCircle className="w-3 h-3 text-emerald-500" /><span className="text-emerald-600 dark:text-emerald-400">Faithful to Context</span></>
                                            )}
                                        </p>
                                    </div>
                                ))}

                                {/* Premium Model Upsell Locks for Starter Plan */}
                                {organization?.subscriptionTier === "starter" && modelResults.length === 1 && (
                                    <>
                                        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-slate-900 px-4 py-6 text-center flex flex-col items-center justify-center relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5" />
                                            <Lock className="w-5 h-5 text-slate-400 mb-2" />
                                            <p className="text-xs text-slate-500 font-medium mb-1">GPT-4o Mini</p>
                                            <p className="text-[10px] text-indigo-500 font-semibold cursor-pointer hover:underline relative z-10 transition-transform group-hover:scale-105">Upgrade to Growth to unlock</p>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-slate-900 px-4 py-6 text-center flex flex-col items-center justify-center relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5" />
                                            <Lock className="w-5 h-5 text-slate-400 mb-2" />
                                            <p className="text-xs text-slate-500 font-medium mb-1">Claude 3.5 Haiku</p>
                                            <p className="text-[10px] text-amber-600 font-semibold cursor-pointer hover:underline relative z-10 transition-transform group-hover:scale-105">Upgrade to Growth to unlock</p>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        )}

                        {/* Detailed Responses */}
                        <AnimatePresence>
                            {modelResults.filter(r => !r.error).map((result, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className={`rounded-2xl border p-5 ${result.hasHallucination
                                        ? "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-500/30"
                                        : "bg-white border-slate-200 dark:bg-slate-900 dark:border-white/5"
                                        }`}
                                >
                                    <div className="flex justify-between items-center mb-3 text-xs">
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center">
                                            <Cpu className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                                            {result.model}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded border flex items-center ${result.hasHallucination
                                            ? "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/50"
                                            : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                                            }`}>
                                            Accuracy: {result.accuracy}%
                                            {result.hasHallucination && <AlertTriangle className="w-3 h-3 ml-1" />}
                                        </span>
                                    </div>
                                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                                        {result.answer}
                                    </p>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}
