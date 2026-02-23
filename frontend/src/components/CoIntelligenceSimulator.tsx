/**
 * Author: "Sambath Kumar Natarajan"
 * Date: "26-Dec-2025"
 * Org: " Start-up/AUM Data Labs"
 * Product: "Context Foundry"
 * Description: Co-Intelligence Simulator UI for mathematical hallucination detection.
 */
"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Beaker, Send, AlertTriangle, Cpu, Share2, Activity, Zap, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOrganization } from "./OrganizationContext";
import { db } from "@/lib/firestorePaths";
import { doc, getDoc } from "firebase/firestore";

export default function CoIntelligenceSimulator() {
    const { organization } = useOrganization();
    const [dynamicPrompts, setDynamicPrompts] = useState<string[]>([
        "What is the best enterprise solution for this category?",
        "How much does it cost?",
        "Does it have an AI integration?",
    ]);
    const [activePrompt, setActivePrompt] = useState("");
    const [chatLog, setChatLog] = useState<{ role: "system" | "user" | "ai", text: string, hasHallucination?: boolean, score?: number, version?: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [manifestVersions, setManifestVersions] = useState<{ id: string, name: string }[]>([]);
    const [selectedVersion, setSelectedVersion] = useState("latest");
    const [manifestCache, setManifestCache] = useState("No semantic document uploaded yet.");

    useEffect(() => {
        if (!organization) return;
        setDynamicPrompts([
            `What is the core offering of ${organization.name}?`,
            `What is the pricing model for ${organization.name}?`,
            `Does ${organization.name} offer API integration?`,
            `Compare ${organization.name} against previous legacy tools.`
        ]);
        setActivePrompt(`What is the core offering of ${organization.name}?`);

        const fetchData = async () => {
            try {
                // Fetch available manifest versions for 'Earlier vs Reload' comparison
                const orgRef = doc(db, "organizations", organization.id);
                const manifestDoc = await getDoc(doc(orgRef, "manifests", "default"));
                if (manifestDoc.exists() && manifestDoc.data().content) {
                    setManifestCache(manifestDoc.data().content);
                    setManifestVersions([{ id: "latest", name: "Current Context" }, { id: "v1_baseline", name: "V1 Baseline (Earlier)" }]);
                } else {
                    setManifestCache(`Default verified Context Document for ${organization.name}. Pricing: Contact Sales.`);
                    setManifestVersions([{ id: "latest", name: "Current Context" }]);
                }
            } catch (err) { }
        };
        fetchData();
    }, [organization]);

    const handleSimulate = async (promptText: string) => {
        if (!promptText) return;
        setActivePrompt(promptText);
        setChatLog([{ role: "user", text: promptText }]);
        setLoading(true);

        setChatLog(prev => [...prev, { role: "system", text: "Retrieving /llms.txt from edge..." }]);
        try {
            const response = await fetch('/api/simulation/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: promptText,
                    orgId: organization?.id,
                    manifestVersion: selectedVersion,
                    useGemini: false
                }),
            });

            if (!response.ok) throw new Error('Simulation Engine Offline');

            const data = await response.json();

            // MATH LOGIC:
            // Backend returns d (divergence). Higher 'd' = Higher Hallucination.
            // If d > epsilon_div, the AI flagged a hallucination.
            setChatLog(prev => [...prev, {
                role: "ai",
                text: data.answer || "No response generated.",
                hasHallucination: data.hasHallucination || false,
                score: data.score || 0.01,
                version: data.version
            }]);
        } catch (error) {
            console.error('Simulation Failed:', error);
            setChatLog(prev => [...prev, { role: "system", text: "Error connecting to AI backend." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col space-y-6 animate-fade-in font-sans">
            <header className="mb-4">
                <h2 className="text-2xl font-light text-slate-900 dark:text-white flex items-center">
                    <Beaker className="w-6 h-6 mr-3 text-amber-500" />
                    Co-Intelligence Simulator
                </h2>
                <p className="text-sm text-slate-500 mt-1 uppercase tracking-widest">Live Agentic Prompt Testing Sandbox</p>
            </header>

            <div className="flex-1 w-full flex flex-col lg:flex-row gap-6 h-[600px]">

                {/* Left Panel: Synthetic Prompts */}
                <div className="lg:w-1/3 flex flex-col space-y-4">
                    <div className="bg-white/50 dark:bg-slate-900/40 rounded-2xl p-5 border border-slate-200 dark:border-white/5 h-full flex flex-col shadow-xl dark:shadow-none backdrop-blur-xl">
                        <h3 className="text-sm font-medium text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-4 flex items-center">
                            <Zap className="w-4 h-4 mr-2 text-cyan-600 dark:text-cyan-400" /> Synthetic Prompts
                        </h3>
                        <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                            {dynamicPrompts.map((p, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSimulate(p)}
                                    className={`w-full text-left p-4 rounded-xl text-sm transition-all border ${activePrompt === p
                                        ? "bg-amber-50 text-amber-800 border-amber-200 shadow-sm dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200 dark:shadow-none"
                                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-900 dark:border-white/5 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                        }`}
                                >
                                    "{p}"
                                </button>
                            ))}
                        </div>

                        <div className="mt-4 relative">
                            <input
                                type="text"
                                placeholder="Custom synthetic prompt..."
                                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl py-3 pl-4 pr-10 text-sm text-slate-900 dark:text-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:focus:border-amber-500/50 outline-none transition-colors shadow-sm dark:shadow-none"
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
                    </div>
                </div>

                {/* Right Panel: Simulated Chat */}
                <div className="lg:w-2/3 flex flex-col rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50/80 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden relative shadow-xl dark:shadow-2xl">
                    <div className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-white/5 px-6 py-4 flex justify-between items-center z-10">
                        <h3 className="text-sm font-medium text-slate-900 dark:text-white flex items-center">
                            <MessageSquare className="w-4 h-4 mr-2 text-amber-500 cursor-auto" /> Agent Response Sandbox
                        </h3>

                        <div className="flex items-center space-x-2">
                            <select
                                value={selectedVersion}
                                onChange={(e) => setSelectedVersion(e.target.value)}
                                className="text-[10px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/10 rounded px-2 py-1 outline-none text-slate-600 dark:text-slate-300 uppercase tracking-widest font-semibold"
                            >
                                {manifestVersions.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 p-6 overflow-y-auto space-y-6 scroll-smooth bg-white/50 dark:bg-gradient-to-b dark:from-slate-900/50 dark:to-slate-950">
                        <AnimatePresence>
                            {chatLog.length === 0 && !loading && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-slate-500">
                                    <Cpu className="w-12 h-12 mb-4 opacity-20" />
                                    <p>Select a synthetic prompt to begin LCRS testing.</p>
                                </motion.div>
                            )}

                            {chatLog.map((log, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${log.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    {log.role === "system" ? (
                                        <div className="bg-slate-200 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-xs px-4 py-2 rounded-lg font-mono flex items-center">
                                            <Activity className="w-3 h-3 mr-2 text-cyan-500 animate-pulse" /> {log.text}
                                        </div>
                                    ) : log.role === "user" ? (
                                        <div className="bg-amber-100 dark:bg-amber-600/20 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-500/30 px-5 py-3 rounded-2xl max-w-lg shadow-sm dark:shadow-lg">
                                            {log.text}
                                        </div>
                                    ) : (
                                        <div className="w-full flex space-x-4">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700 shadow-sm dark:shadow-none">
                                                <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            </div>
                                            <div className={`flex-1 rounded-2xl p-5 border shadow-sm dark:shadow-lg ${log.hasHallucination ? "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-500/30" : "bg-white border-slate-200 dark:bg-slate-900 dark:border-white/5"
                                                }`}>

                                                <div className="mb-3 flex justify-between items-center text-xs">
                                                    <span className={log.hasHallucination ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-emerald-700 dark:text-emerald-400 font-semibold"}>
                                                        Synthesized Output
                                                    </span>
                                                    <span className="flex items-center space-x-2">
                                                        <span className="text-slate-500 font-mono">d &gt; ε_div = </span>
                                                        <span className={`px-2 py-0.5 rounded flex items-center ${log.hasHallucination ? "bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/50" : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                                                            }`}>
                                                            {log.score?.toFixed(3)}
                                                            {log.hasHallucination && <AlertTriangle className="w-3 h-3 ml-1" />}
                                                        </span>
                                                    </span>
                                                </div>

                                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                                                    {log.hasHallucination ? (
                                                        <span>
                                                            {log.text.split(/(\$49\/user\/month|free tier)/).map((part, idx) =>
                                                                part.match(/(\$49\/user\/month|free tier)/)
                                                                    ? <span key={idx} className="bg-rose-500/20 text-rose-300 border-b border-rose-500/50 px-1 font-semibold">{part}</span>
                                                                    : part
                                                            )}
                                                        </span>
                                                    ) : log.text}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}

                            {loading && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700 mr-4 shadow-sm dark:shadow-none">
                                        <Cpu className="w-4 h-4 text-slate-500" />
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 rounded-full px-4 py-2 border border-slate-200 dark:border-white/5 flex items-center space-x-2 shadow-sm dark:shadow-none">
                                        <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce"></div>
                                        <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                        <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <div className="h-4"></div> {/* spacer */}
                    </div>
                </div>
            </div>
        </div>
    );
}
