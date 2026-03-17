/**
 * Author: "Sambath Kumar Natarajan"
 * Date: "26-Dec-2025"
 * Org: " Start-up/AUM Context Foundry"
 * Product: "AUM Context Foundry"
 * Description: Multi-Model Co-Intelligence Simulator — tests across frontier models.
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { Zap, Shield, CheckCircle2, XCircle, AlertTriangle, Beaker, Send, MessageSquare, Cpu, CheckCircle, Lock, Download, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOrganization } from "./OrganizationContext";
import { auth } from "../lib/firebase";
import { useRazorpay } from "@/hooks/useRazorpay";
import { UpgradeModal } from "./UpgradeModal";
import { getLocalMockSession, isLocalMockMode } from "@/lib/localMockMode";

interface ModelResult {
    model: string;
    answer: string;
    accuracy: number;
    hasDisplacement: boolean;  // true when a competitor is recommended instead of this company
    hasHallucination: boolean; // backward-compat alias — same value as hasDisplacement
    status?: string;
    metrics?: {
        semantic_divergence: number;
        claim_recall: number;
    };
    error?: string;
}

export default function CoIntelligenceSimulator() {
    const { organization, refreshKey, activeManifestVersion, analysisContexts, setActiveManifestVersion } = useOrganization();
    useRazorpay();
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [upgradeFeatureName, setUpgradeFeatureName] = useState("");
    const [upgradeLimitReason, setUpgradeLimitReason] = useState<string | undefined>();
    const [dynamicPrompts, setDynamicPrompts] = useState<string[]>([
        "Who are the top enterprise analytics consulting firms for retail and CPG transformation?",
        "Which firms are strongest in Databricks, Snowflake, and Google Cloud data modernization?",
        "How does this company compare with Accenture, Fractal, and Mu Sigma?",
    ]);
    const [activePrompt, setActivePrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [manifestVersions, setManifestVersions] = useState<{ id: string, name: string }[]>([]);
    const [selectedVersion, setSelectedVersion] = useState("latest");
    const [modelResults, setModelResults] = useState<ModelResult[]>([]);
    const [adjudication, setAdjudication] = useState<{ master_verdict: string, winner: string, audit_notes: string } | null>(null);
    const [lockedModels, setLockedModels] = useState<string[]>([]);
    const [lastPrompt, setLastPrompt] = useState("");
    const [byokError, setByokError] = useState(false);
    const isExplorer = organization?.subscriptionTier === "explorer";
    const analysisSubject = organization ? (analysisContexts.find((context) => context.version === activeManifestVersion)?.name || organization.name) : "your company";
    const promptFetchKeyRef = useRef<string>("");

    const getEffectiveToken = async () => {
        const token = await auth.currentUser?.getIdToken();
        if (token) return token;
        if (isLocalMockMode()) {
            return getLocalMockSession().token;
        }
        return undefined;
    };

    useEffect(() => {
        if (!organization) return;
        const key = `${organization.id}|${activeManifestVersion}|${analysisSubject}|${refreshKey}`;
        if (promptFetchKeyRef.current === key) return;
        promptFetchKeyRef.current = key;
        let cancelled = false;

        const fetchData = async () => {
            try {
                const token = await getEffectiveToken();
                if (!token) throw new Error("Authentication required");
                const manifestResp = await fetch(`/api/workspaces/${organization.id}/manifest-data?version=${encodeURIComponent(activeManifestVersion)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (manifestResp.ok) {
                    const manifestData = await manifestResp.json();
                    const manifestContent: string = manifestData.content || "";
                    setManifestVersions([
                        { id: "latest", name: "Current Context" },
                        ...analysisContexts.map((context) => ({ id: context.version, name: context.name }))
                    ]);

                    // Generate context-aware prompts from the manifest
                    if (token && manifestContent) {
                        try {
                            const res = await fetch("/api/simulation/suggest-prompts", {
                                method: "POST",
                                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                                body: JSON.stringify({ orgId: organization.id, manifestSnippet: manifestContent.slice(0, 2000) }),
                            });
                            if (res.ok) {
                                const d = await res.json();
                                if (d.prompts && d.prompts.length > 0) {
                                    if (cancelled) return;
                                    setDynamicPrompts(d.prompts);
                                    setActivePrompt((prev) => (prev && d.prompts.includes(prev)) ? prev : d.prompts[0]);
                                    return;
                                }
                            }
                        } catch (e) {
                            console.warn("Prompt suggestion API failed, using manifest-derived fallback:", e);
                        }
                    }

                    // Fallback: derive prompts from manifest headings/content
                    const lines = manifestContent.split("\n").filter((l: string) => l.trim().startsWith("##") || l.trim().startsWith("-")).slice(0, 8);
                    const topics = lines.map((l: string) => l.replace(/^#+\s*/, "").replace(/^-\s*/, "").trim()).filter((l: string) => l.length > 5).slice(0, 3);
                    const fallbackPrompts = topics.length >= 2 ? [
                        `Which enterprise buyers would shortlist ${analysisSubject} based on ${topics[0]}?`,
                        `How does ${analysisSubject} compare against established competitors on ${topics[0]}?`,
                        topics.length > 1 ? `What proof does ${analysisSubject} present around ${topics[1]} for enterprise transformation buyers?` : `What enterprise differentiators does ${analysisSubject} assert most clearly?`,
                        `Which vendors have stronger domain expertise than ${analysisSubject}, and where does ${analysisSubject} still win?`
                    ] : [
                        `Which companies are leading AI-driven enterprise transformation, and how does ${analysisSubject} compare?`,
                        `What are the key criteria enterprise buyers use to shortlist a partner like ${analysisSubject}?`,
                        `How does ${analysisSubject} differentiate from other established players in its market category?`,
                        `What specific outcomes and proof points does ${analysisSubject} offer that enterprise buyers care most about?`
                    ];
                    if (cancelled) return;
                    setDynamicPrompts(fallbackPrompts);
                    setActivePrompt((prev) => (prev && fallbackPrompts.includes(prev)) ? prev : fallbackPrompts[0]);
                } else {
                    if (cancelled) return;
                    setManifestVersions([{ id: "latest", name: "Current Context" }, ...analysisContexts.map((context) => ({ id: context.version, name: context.name }))]);
                    // No manifest yet — show generic but sensible prompts
                    const genericPrompts = [
                        `Which companies are leading AI-driven enterprise transformation, and how does ${analysisSubject} compare?`,
                        `What are the key criteria enterprise buyers use to shortlist a partner like ${analysisSubject}?`,
                        `How does ${analysisSubject} differentiate from other established players in its market category?`,
                        `Which partner is best for large-scale enterprise transformation for Fortune 500 companies, and why would a buyer shortlist ${analysisSubject}?`
                    ];
                    setDynamicPrompts(genericPrompts);
                    setActivePrompt((prev) => (prev && genericPrompts.includes(prev)) ? prev : genericPrompts[0]);
                }
            } catch (e) {
                console.error("Manifest fetch error:", e);
                if (!cancelled) {
                    setManifestVersions([{ id: "latest", name: "Current Context" }, ...analysisContexts.map((context) => ({ id: context.version, name: context.name }))]);
                }
            }
        };
        fetchData();
        return () => {
            cancelled = true;
        };
    }, [organization, refreshKey, activeManifestVersion, analysisContexts, analysisSubject]);

    useEffect(() => {
        setSelectedVersion(activeManifestVersion || "latest");
    }, [activeManifestVersion]);

    const handleSimulate = async (promptText: string) => {
        if (!promptText || loading) return;
        setActivePrompt(promptText);
        setModelResults([]);
        setAdjudication(null);
        setLastPrompt(promptText);
        setByokError(false);
        setLoading(true);

        try {
            const token = await getEffectiveToken();

            if (!token) throw new Error("Authentication required to run simulations.");

            const response = await fetch('/api/simulation/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    prompt: promptText,
                    orgId: organization?.id,
                    manifestVersion: selectedVersion,
                }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ detail: "Simulation Engine Offline" }));
                if (err.detail && typeof err.detail === "object" && err.detail.code === "EXPLORER_LIMIT_REACHED") {
                    setUpgradeLimitReason("EXPLORER_LIMIT_REACHED");
                    setIsUpgradeModalOpen(true);
                    return;
                }
                throw new Error(typeof err.detail === "string" ? err.detail : "Simulation Failed");
            }

            const data = await response.json();
            setModelResults(data.results || []);
            setAdjudication(data.adjudication || null);
            setLockedModels(data.lockedModels || []);
        } catch (error) {
            console.error('Simulation Failed:', error);
            if (error instanceof Error && error.message.toLowerCase().includes("api key")) {
                setByokError(true);
            }
            setModelResults([{
                model: "Error",
                answer: error instanceof Error ? error.message : "Unknown error",
                accuracy: 0,
                hasDisplacement: true,
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

    const getExplorerPreview = (answer: string) => {
        if (answer.length <= 220) return answer;
        return `${answer.slice(0, 220).trim()}...`;
    };

    const handleExportCSV = async () => {
        if (!organization) return;
        if (organization.subscriptionTier === "explorer") {
            setUpgradeFeatureName("Audit CSV Export");
            setUpgradeLimitReason("EXPLORER_LIMIT_REACHED");
            setIsUpgradeModalOpen(true);
            return;
        }
        try {
            const token = await getEffectiveToken();
            const response = await fetch(`/api/simulation/export/${organization.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error("Export failed");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `som_audit_${organization.name.replace(/\s+/g, '_')}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("CSV Export Failed:", error);
        }
    };

    return (
        <div className="w-full h-full flex flex-col space-y-6 animate-fade-in font-sans">
            <header className="mb-2">
                <h2 className="text-2xl font-light text-slate-900 dark:text-white flex items-center">
                    <Beaker className="w-6 h-6 mr-3 text-amber-500" />
                    Enterprise Buyer Query Simulation
                </h2>
                <p className="text-sm text-slate-500 mt-1">Test how AI engines recommend your business versus competitors when enterprise buyers ask complex, vendor-agnostic questions.</p>
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
                                onChange={(e) => {
                                    setSelectedVersion(e.target.value);
                                    setActiveManifestVersion(e.target.value);
                                }}
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
                    <div className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-white/5 px-6 py-4 flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-medium text-slate-900 dark:text-white flex items-center">
                                <MessageSquare className="w-4 h-4 mr-2 text-amber-500" />
                                Multi-Model Accuracy Comparison
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">Same prompt, different AI models. See who gets your business right.</p>
                        </div>
                        <button
                            onClick={handleExportCSV}
                            className={`flex items-center space-x-2 text-xs font-medium border px-3 py-1.5 rounded-lg transition-colors ${
                                organization?.subscriptionTier === "explorer"
                                    ? "text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
                                    : "text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-700"
                            }`}
                        >
                            {organization?.subscriptionTier === "explorer" ? <Lock className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                            <span>{organization?.subscriptionTier === "explorer" ? "Unlock CSV Export" : "Export Audit CSV"}</span>
                        </button>
                    </div>

                    <div className="flex-1 p-6 overflow-y-auto space-y-4">

                        {/* Empty State */}
                        {modelResults.length === 0 && !loading && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-slate-500">
                                <Cpu className="w-12 h-12 mb-4 opacity-20" />
                                <p>Select a prompt to test how AI models describe your business.</p>
                                <p className="text-xs mt-2 max-w-md text-center opacity-60">We compare each AI response against your verified Context Document to detect inaccuracies and Context Drift.</p>
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

                        {/* API Error / Quota Exhausted */}
                        {byokError && !loading && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-500/30 p-8 rounded-2xl flex flex-col items-center text-center shadow-lg my-6">
                                <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/20 rounded-full flex items-center justify-center mb-4">
                                    <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
                                </div>
                                <h4 className="text-xl font-medium text-rose-900 dark:text-rose-100 mb-2">Simulation Engine Unavailable</h4>
                                <p className="text-sm text-rose-700 dark:text-rose-300 max-w-md leading-relaxed mb-4">
                                    {organization?.subscriptionTier === 'explorer'
                                        ? "Explorer plans do not include automated API key provisioning for enterprise simulations. Please upgrade to unlock Tri-Model Arbitration."
                                        : "Your organization's simulation engine credentials have not been automatically provisioned, or you have exceeded your demo allowance. Please contact support."}
                                </p>
                                {organization?.subscriptionTier === 'explorer' && (
                                    <button
                                        onClick={() => setIsUpgradeModalOpen(true)}
                                        className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-rose-500/20"
                                    >
                                        Upgrade to Growth
                                    </button>
                                )}
                            </motion.div>
                        )}

                        {/* Prompt Display */}
                        {lastPrompt && modelResults.length > 0 && !byokError && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-amber-50 dark:bg-amber-600/10 text-amber-900 dark:text-amber-100 border border-amber-200 dark:border-amber-500/30 px-5 py-3 rounded-2xl text-sm relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 dark:via-white/5 to-transparent animate-shimmer pointer-events-none"></div>
                                <span className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider font-semibold">Prompt:</span>
                                <p className="mt-1 relative z-10">&ldquo;{lastPrompt}&rdquo;</p>
                            </motion.div>
                        )}

                        {/* Score Summary Bar */}
                        {modelResults.length > 0 && !loading && !byokError && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="grid grid-cols-1 lg:grid-cols-3 gap-4"
                            >
                                {modelResults.map((result, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1, duration: 0.5 }}
                                        className={`rounded-xl border p-4 text-center ${getAccuracyBg(result.accuracy)} hover:scale-[1.02] transition-transform`}
                                    >
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">{result.model}</p>
                                        <p className={`text-3xl font-light ${getAccuracyColor(result.accuracy)}`}>
                                            {result.error ? "—" : `${result.accuracy}%`}
                                        </p>
                                        <p className={`text-[10px] mt-1 flex items-center justify-center space-x-1`}>
                                            {result.error ? (
                                                <span className="text-slate-400">Unavailable</span>
                                            ) : result.hasHallucination ? (
                                                <><XCircle className="w-3 h-3 text-rose-500" /><span className="text-rose-600 dark:text-rose-400">Displaced by Competitor</span></>
                                            ) : (
                                                <><CheckCircle className="w-3 h-3 text-emerald-500" /><span className="text-emerald-600 dark:text-emerald-400">Visible to Enterprise Buyers</span></>
                                            )}
                                        </p>
                                    </motion.div>
                                ))}

                                {/* Premium Model Upsell Locks (Dynamic) */}
                                {lockedModels.map((modelName, idx) => (
                                    <div key={`lock-${idx}`} className="rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-slate-900 px-4 py-6 text-center flex flex-col items-center justify-center relative overflow-hidden group">
                                        <div className={`absolute inset-0 bg-gradient-to-br ${idx % 2 === 0 ? 'from-indigo-500/5 to-purple-500/5' : 'from-amber-500/5 to-orange-500/5'}`} />
                                        <Lock className="w-5 h-5 text-slate-400 mb-2" />
                                        <p className="text-xs text-slate-500 font-medium mb-1">{modelName}</p>
                                        <button
                                            onClick={() => {
                                                setUpgradeFeatureName(`${modelName} Integration`);
                                                setIsUpgradeModalOpen(true);
                                            }}
                                            className="text-[10px] text-indigo-500 font-semibold cursor-pointer py-1 px-3 border border-indigo-200 dark:border-indigo-500/20 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors relative z-10"
                                        >
                                            Upgrade to Growth
                                        </button>
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        {/* Detailed Responses */}
                        <AnimatePresence>
                            {!byokError && modelResults.map((result, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className={`rounded-2xl border p-5 ${result.error
                                        ? "bg-rose-50/50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-500/30"
                                        : result.hasHallucination
                                            ? "bg-amber-50/30 border-amber-200 dark:bg-amber-950/10 dark:border-amber-500/20"
                                            : "bg-white border-slate-200 dark:bg-slate-900 dark:border-white/5"
                                        }`}
                                >
                                    <div className="flex justify-between items-center mb-3 text-xs">
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center">
                                            <Cpu className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                                            {result.model}
                                        </span>
                                        <div className="flex items-center space-x-2">
                                            {result.error ? (
                                                <span className="bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded flex items-center dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/50">
                                                    <XCircle className="w-3 h-3 mr-1" />
                                                    Failed
                                                </span>
                                            ) : (
                                                <span className={`px-2 py-0.5 rounded border flex items-center ${result.accuracy > 85
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                                                    : result.accuracy > 60
                                                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                                                        : "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/50"
                                                    }`}>
                                                    Accuracy: {result.accuracy}%
                                                    {result.hasHallucination && <AlertTriangle className="w-3 h-3 ml-1" />}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className={`leading-relaxed text-sm mb-4 ${result.error ? "text-rose-600 dark:text-rose-400 font-medium italic" : "text-slate-700 dark:text-slate-300"}`}>
                                        {result.error
                                            ? `Error: ${result.error}`
                                            : isExplorer
                                                ? getExplorerPreview(result.answer)
                                                : result.answer}
                                    </p>

                                    {isExplorer && !result.error && (
                                        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
                                            Explorer shows one scored answer preview only. Upgrade to unlock full response transcripts, claim verification detail, comparative audit history, and export artifacts.
                                        </div>
                                    )}

                                    {/* Transparency Footprint (Hardened Audit Check) */}
                                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 flex flex-wrap gap-x-4 gap-y-2">
                                        <div className="flex items-center text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-widest font-semibold">
                                            <Shield className="w-3 h-3 mr-1.5 text-indigo-400" />
                                            {result.model}
                                        </div>
                                        <div className="flex items-center text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-widest font-semibold">
                                            <Zap className="w-3 h-3 mr-1.5 text-amber-400" />
                                            temp=0.0
                                        </div>
                                        {!isExplorer && result.metrics && (
                                            <div className="text-[10px] text-slate-400 font-mono">
                                                div: {result.metrics.semantic_divergence} / rec: {result.metrics.claim_recall}
                                            </div>
                                        )}
                                        {!isExplorer && !result.error && (
                                            <button
                                                onClick={() => {
                                                    const md = `### Model: ${result.model}\n\n**Accuracy:** ${result.accuracy}%\n\n**Response:**\n${result.answer}\n\n---\n*Audit Log: ${new Date().toISOString()} | AI Search Presence v1.2.0*`;
                                                    navigator.clipboard.writeText(md);
                                                }}
                                                className="ml-auto flex items-center text-[10px] text-indigo-500 hover:text-indigo-400 font-semibold uppercase tracking-widest"
                                            >
                                                <Copy className="w-3 h-3 mr-1.5" />
                                                COPY
                                            </button>
                                        )}
                                        {isExplorer && !result.error && (
                                            <button
                                                onClick={() => {
                                                    setUpgradeFeatureName("Full Answer Transcript");
                                                    setUpgradeLimitReason("EXPLORER_LIMIT_REACHED");
                                                    setIsUpgradeModalOpen(true);
                                                }}
                                                className="ml-auto flex items-center text-[10px] text-indigo-500 hover:text-indigo-400 font-semibold uppercase tracking-widest"
                                            >
                                                <Lock className="w-3 h-3 mr-1.5" />
                                                Unlock Full Evidence
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Master Adjudication Verdict */}
                        {adjudication && !loading && !byokError && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="col-span-1 lg:col-span-3 bg-indigo-600 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Shield className="w-24 h-24" />
                                </div>
                                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] uppercase tracking-widest font-bold">Buyer Ranking Verdict</span>
                                            <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] uppercase tracking-widest font-bold border border-emerald-500/30">Verified</span>
                                        </div>
                                        <h4 className="text-xl font-medium mb-2 leading-tight">{adjudication.master_verdict}</h4>
                                        <p className="text-indigo-100 text-sm opacity-80 leading-relaxed italic">&ldquo;{adjudication.audit_notes}&rdquo;</p>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 min-w-[200px] text-center">
                                        <p className="text-[10px] uppercase tracking-widest opacity-60 mb-1 font-bold">Recommended Model</p>
                                        <div className="text-2xl font-light flex items-center justify-center">
                                            <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-400" />
                                            {adjudication.winner}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            <UpgradeModal
                isOpen={isUpgradeModalOpen}
                onClose={() => {
                    setIsUpgradeModalOpen(false);
                    setUpgradeLimitReason(undefined);
                }}
                featureHighlight={upgradeFeatureName}
                limitReason={upgradeLimitReason}
            />
        </div>
    );
}
