"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Shield, Download, Globe, Cpu, CheckCircle2, XCircle, AlertTriangle, BookOpen, TrendingUp, X, FileText } from "lucide-react";
import { Logo } from "./Logo";
import { useOrganization } from "./OrganizationContext";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import { auth } from "@/lib/firebase";

interface ModelResult {
    model: string;
    accuracy: number;
    hasHallucination: boolean;
    claimScore?: string;
    answer?: string;
}

interface ScoringRecord {
    prompt: string;
    results: ModelResult[];
    timestamp: { toDate: () => Date } | null;
}

interface BrandHealthCertificateProps {
    organizationName: string;
    asovScore: number;
    driftRate: number;
    onClose: () => void;
    // Optional: passed directly from in-session simulation results
    modelResults?: ModelResult[];
    lastPrompt?: string;
    seoResult?: {
        seoScore: number;
        geoScore: number;
        overallScore: number;
        recommendation: string;
    };
    competitors?: { name: string; displacementRate: number; strengths: string[]; weaknesses: string[] }[];
    activeContextName?: string;
}

const CANONICAL_MODEL_ORDER = ["GPT-4o", "Gemini 3 Flash", "Claude 4.5 Sonnet"];

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
        "claude 3.5 haiku": "Claude 4.5 Sonnet",
        "claude 3.5 sonnet": "Claude 4.5 Sonnet",
        "claude 4.5": "Claude 4.5 Sonnet",
        "claude 4.5 sonnet": "Claude 4.5 Sonnet",
        "claude-3-5-haiku": "Claude 4.5 Sonnet",
        "claude-3-5-sonnet": "Claude 4.5 Sonnet",
        "claude-3-5-sonnet-20241022": "Claude 4.5 Sonnet",
        "claude-sonnet-4-20250514": "Claude 4.5 Sonnet",
        "claude-sonnet-4-5": "Claude 4.5 Sonnet",
    };
    return aliases[lowered] || raw;
}

export default function BrandHealthCertificate({
    organizationName: propOrgName,
    asovScore,
    driftRate,
    onClose,
    modelResults: propModelResults,
    lastPrompt: propPrompt,
    seoResult,
    competitors = [],
    activeContextName,
}: BrandHealthCertificateProps) {
    const organizationName = propOrgName;
    const { organization, refreshKey, activeManifestVersion } = useOrganization();
    const { models } = useModelCatalog();
    const certificateRef = useRef<HTMLDivElement>(null);
    const [issuedDate, setIssuedDate] = useState("");
    const [isoTimestamp, setIsoTimestamp] = useState("");
    const [isDownloading, setIsDownloading] = useState(false);
    const [showMethodology, setShowMethodology] = useState(false);
    const [latestRecord, setLatestRecord] = useState<ScoringRecord | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIssuedDate(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));
        setIsoTimestamp(new Date().toISOString());
    }, []);

    // Load latest scoring record from Firestore for data post-refresh
    useEffect(() => {
        if (propModelResults && propModelResults.length > 0) {
            setLatestRecord({ prompt: propPrompt || "", results: propModelResults, timestamp: null });
            setLoadingHistory(false);
            return;
        }
        if (!organization?.id) { setLoadingHistory(false); return; }
        const fetchHistory = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                let effectiveToken = token;
                if (!effectiveToken) {
                    const savedMockUser = typeof window !== 'undefined' ? localStorage.getItem("mock_auth_user") : null;
                    if (savedMockUser === "demo@demo.com") effectiveToken = "mock-demo-token";
                    else if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash") effectiveToken = "mock-dev-token";
                }

                if (!effectiveToken) {
                    setLoadingHistory(false);
                    return;
                }

                const response = await fetch(`/api/simulation/history/${organization.id}`, {
                    headers: { Authorization: `Bearer ${effectiveToken}` }
                });
                if (!response.ok) {
                    setError("Failed to load historical data. Please check your connection.");
                    return;
                }
                const data = await response.json();
                const matchingHistory = (data.history || []).filter((entry: { version?: string }) => {
                    if (!activeManifestVersion || activeManifestVersion === "latest") return true;
                    return entry.version === activeManifestVersion;
                });
                const record = matchingHistory[0];
                if (record) {
                    setLatestRecord({ prompt: record.prompt || "", results: record.results || [], timestamp: record.timestamp || null });
                }
            } catch (e) {
                console.warn("Could not load scoring history:", e);
                setError("Network error loading report history.");
            } finally {
                setLoadingHistory(false);
            }
        };
        fetchHistory();
    }, [organization, propModelResults, propPrompt, refreshKey, activeManifestVersion]);

    const results = (latestRecord?.results || [])
        .map((result) => ({ ...result, model: normalizeModelName(result.model) }))
        .sort((a, b) => CANONICAL_MODEL_ORDER.indexOf(a.model) - CANONICAL_MODEL_ORDER.indexOf(b.model));
    const avgLcrs = results.length > 0 ? Math.round(results.reduce((s: number, r: ModelResult) => s + r.accuracy, 0) / results.length) : asovScore;
    const hallucinationCount = results.filter((r: ModelResult) => r.hasHallucination).length;
    const fidelityPct = results.length > 0 ? Math.round((results.filter((r: ModelResult) => !r.hasHallucination).length / results.length) * 100) : (100 - driftRate);

    const scoreColor = (s: number) => s >= 85 ? "#10b981" : s >= 65 ? "#f59e0b" : s >= 40 ? "#fb923c" : "#ef4444";
    const gradeLabel = (s: number) => s >= 85 ? "HIGH FIDELITY" : s >= 65 ? "MINOR DRIFT" : s >= 40 ? "SEVERE DRIFT" : "CRITICAL DRIFT";

    const getExecutiveSummary = (score: number, orgName: string) => {
        const hCount = results.filter((r: ModelResult) => r.hasHallucination).length;
        const totalMod = results.length;

        if (score >= 85 && hCount === 0) {
            return `AUM Context Foundry certifies that ${orgName} maintains High Fidelity across LLM representations. AI agents accurately retrieve, synthesize, and present your core claims without introducing hallucinated artifacts. Your unstructured data assets are optimally RAG-ready.`;
        }
        if (score >= 65) {
            return `${orgName} exhibits Minor Data Drift across modern AI agents. While core capabilities are recognized, some nuances are either omitted or mildly conflated. We recommend injecting clearer Context Manifests to prevent further brand erosion.`;
        }
        if (score >= 40) {
            return `ALERT: ${orgName} is experiencing Severe Data Drift. ${hCount > 0 ? `Hallucinations detected in ${hCount}/${totalMod} tested models.` : "Material facts are being omitted or misattributed."} Generative engines are failing to recall specific product differentiators. Immediate semantic alignment is recommended.`;
        }
        return `WARNING: ${orgName} suffers from Critical Data Drift. Generative AI engines are currently hallucinating material facts${hCount > 0 ? ` across ${hCount}/${totalMod} models` : ""}, fabricating competitor displacements, or failing to retrieve your core offerings. Immediate remediation via structured Semantic Ingestion is required to protect brand integrity.`;
    };

    const handleDownload = async () => {
        if (!certificateRef.current) return;
        setIsDownloading(true);
        try {
            const canvas = await html2canvas(certificateRef.current, {
                backgroundColor: "#0f172a",
                scale: 2,
                useCORS: true,
                logging: false,
            });
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width / 2, canvas.height / 2]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
            pdf.save(`AUM-Brand-Health-${organizationName.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`);
        } catch (err) {
            console.error("Failed to generate certificate PDF", err);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <motion.div
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="w-full max-w-2xl h-[100dvh] overflow-y-auto bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-white/10 shadow-2xl relative flex flex-col"
            >
                {/* Close button inside the drawer header */}
                <div className="sticky top-0 z-[110] flex justify-between items-center px-8 py-4 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <Logo size={28} />
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Brand Health Report</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors bg-slate-100 dark:bg-slate-800/80 p-2 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 p-8 flex flex-col gap-8">
                    {/* THE CERTIFICATE TARGET FOR DOWNLOAD */}
                    <div
                        ref={certificateRef}
                        className="relative w-full bg-slate-50 dark:bg-slate-900/50 rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_0_80px_rgba(99,102,241,0.1)]"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                        {/* HEADER GRADIENT */}
                        <div className="absolute top-0 left-0 w-full h-56 bg-gradient-to-br from-indigo-500/10 dark:from-indigo-600/30 via-fuchsia-500/5 dark:via-fuchsia-600/15 to-transparent pointer-events-none" />
                        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-cyan-400/10 dark:from-cyan-500/10 to-transparent pointer-events-none rounded-full" />

                        <div className="relative p-8">
                            {/* HEADER ROW */}
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <Logo size={36} />
                                    <div>
                                        <p className="text-[9px] text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] font-bold">AUM Context Foundry</p>
                                        <p className="text-slate-900 dark:text-white font-semibold text-sm">Brand Health Certificate</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Issued</p>
                                    <p className="text-slate-700 dark:text-slate-300 text-xs font-medium">{issuedDate}</p>
                                </div>
                            </div>

                            {/* ORGANIZATION + OVERALL SCORE */}
                            <div className="flex items-center gap-6 mb-10 p-6 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none">
                                <div className="flex-1">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Organization</p>
                                    <p className="text-2xl font-semibold text-slate-900 dark:text-white">{organizationName}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">AI Contextual Representation Audit</p>
                                    {activeContextName && (
                                        <p className="text-[10px] text-indigo-600 dark:text-indigo-300 mt-1">Context: {activeContextName}</p>
                                    )}
                                </div>
                                <div className="text-center">
                                    <div className="relative w-28 h-28">
                                        <svg className="w-full h-full -rotate-90">
                                            <circle cx="56" cy="56" r="48" fill="none" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="7" />
                                            <motion.circle
                                                cx="56" cy="56" r="48" fill="none"
                                                stroke={scoreColor(avgLcrs)} strokeWidth="7"
                                                strokeDasharray={2 * Math.PI * 48}
                                                initial={{ strokeDashoffset: 2 * Math.PI * 48 }}
                                                animate={{ strokeDashoffset: (2 * Math.PI * 48) * (1 - avgLcrs / 100) }}
                                                transition={{ duration: 1.8, ease: "easeOut" }}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-2xl font-bold text-slate-900 dark:text-white">{avgLcrs}%</span>
                                            <span className="text-[8px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg LCRS</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* MODEL-BY-MODEL LCRS BREAKDOWN */}
                            <div className="mb-8">
                                <div className="flex items-center gap-2 mb-4">
                                    <Cpu className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                                    <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">Multi-Model LCRS Breakdown</p>
                                    <span className="ml-auto text-[9px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 px-2 py-0.5 rounded-full">Latent Contextual Rigor Score</span>
                                </div>
                                {loadingHistory ? (
                                    <div className="text-center text-slate-500 text-xs py-6">Loading simulation data...</div>
                                ) : error ? (
                                    <div className="text-center text-amber-500 text-xs py-6 border border-dashed border-amber-300 dark:border-amber-700/30 rounded-xl bg-amber-50/50 dark:bg-amber-500/5">
                                        <AlertTriangle className="w-4 h-4 mx-auto mb-2" />
                                        {error}
                                    </div>
                                ) : results.length === 0 ? (
                                    <div className="text-center text-slate-500 text-xs py-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                                        Run a simulation first to populate LCRS data.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {results.map((r: ModelResult, i: number) => (
                                            <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8 shadow-sm dark:shadow-none">
                                                <div className="w-32 shrink-0">
                                                    <p className="text-xs font-semibold text-slate-900 dark:text-white">{r.model}</p>
                                                    {r.claimScore && <p className="text-[9px] text-slate-500 mt-0.5">{r.claimScore}</p>}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <motion.div
                                                            className="h-full rounded-full"
                                                            style={{ backgroundColor: scoreColor(r.accuracy) }}
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${r.accuracy}%` }}
                                                            transition={{ duration: 1, delay: i * 0.15 }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="w-14 text-right">
                                                    <span className="text-sm font-bold" style={{ color: scoreColor(r.accuracy) }}>{r.accuracy}%</span>
                                                </div>
                                                <div className="w-6 shrink-0">
                                                    {r.hasHallucination
                                                        ? <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                                                        : <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                                    }
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* PROMPT TESTED */}
                            {latestRecord?.prompt && (
                                <div className="mb-8 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-500/20">
                                    <p className="text-[9px] text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1.5">Query Tested</p>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 italic">&ldquo;{latestRecord.prompt}&rdquo;</p>
                                </div>
                            )}

                            {/* EXECUTIVE INTERPRETATION */}
                            <div className="mb-8 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5">
                                <div className="flex items-center gap-2 mb-3">
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">Executive Interpretation</p>
                                </div>
                                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                    {getExecutiveSummary(avgLcrs, organizationName)}
                                </p>
                            </div>

                            <div className="mb-8 p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-500/10">
                                <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-3">How to read this report</p>
                                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                                    <p><span className="font-semibold text-slate-800 dark:text-slate-200">AI Visibility:</span> how strongly your brand shows up with the right narrative in model outputs.</p>
                                    <p><span className="font-semibold text-slate-800 dark:text-slate-200">Fidelity Rate:</span> the share of models that stayed grounded instead of drifting.</p>
                                    <p><span className="font-semibold text-slate-800 dark:text-slate-200">Hallucinations:</span> how many models invented, contradicted, or omitted material facts.</p>
                                    <p><span className="font-semibold text-slate-800 dark:text-slate-200">LCRS:</span> a blended score using semantic alignment plus claim recall against your verified context.</p>
                                </div>
                            </div>

                            {(seoResult || competitors.length > 0) && (
                                <div className="mb-8 grid grid-cols-1 gap-4">
                                    {seoResult && (
                                        <div className="p-5 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-3">Search Readiness Snapshot</p>
                                            <div className="grid grid-cols-3 gap-3 mb-3">
                                                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 text-center">
                                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">SEO</p>
                                                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{seoResult.seoScore}%</p>
                                                </div>
                                                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 text-center">
                                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">GEO</p>
                                                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{seoResult.geoScore}%</p>
                                                </div>
                                                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 text-center">
                                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Overall</p>
                                                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{seoResult.overallScore}%</p>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-400">{seoResult.recommendation}</p>
                                        </div>
                                    )}
                                    {competitors.length > 0 && (
                                        <div className="p-5 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-3">Competitor Displacement Summary</p>
                                            <div className="space-y-3">
                                                {competitors.slice(0, 3).map((competitor) => (
                                                    <div key={competitor.name} className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-sm font-medium text-slate-900 dark:text-white">{competitor.name}</span>
                                                            <span className="text-sm font-semibold text-rose-500">{competitor.displacementRate}%</span>
                                                        </div>
                                                        <p className="text-xs text-slate-500">
                                                            Strengths: {competitor.strengths.join(", ") || "N/A"} · Weaknesses: {competitor.weaknesses.join(", ") || "N/A"}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 3-TILE SUMMARY */}
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                <div className="p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8 text-center shadow-sm dark:shadow-none">
                                    <Globe className="w-5 h-5 mx-auto mb-2 text-indigo-500 dark:text-indigo-400" />
                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">AI Visibility</p>
                                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{asovScore}%</p>
                                    <p className="text-[9px] text-slate-500">ASoV Score</p>
                                </div>
                                <div className="p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8 text-center shadow-sm dark:shadow-none">
                                    <Shield className="w-5 h-5 mx-auto mb-2 text-emerald-500 dark:text-emerald-400" />
                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Fidelity Rate</p>
                                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{fidelityPct}%</p>
                                    <p className="text-[9px] text-slate-500">{fidelityPct >= 80 ? "High Fidelity" : fidelityPct >= 55 ? "Drift detected" : "Critical drift"}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8 text-center shadow-sm dark:shadow-none">
                                    {hallucinationCount === 0
                                        ? <CheckCircle2 className="w-5 h-5 mx-auto mb-2 text-emerald-500 dark:text-emerald-400" />
                                        : <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-amber-500 dark:text-amber-400" />
                                    }
                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Hallucinations</p>
                                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{hallucinationCount}/{results.length || "—"}</p>
                                    <p className="text-[9px] text-slate-500">models affected</p>
                                </div>
                            </div>

                            {/* GRADE BADGE */}
                            <div className="flex items-center justify-center mb-8">
                                <div className="flex items-center gap-3 px-6 py-3 rounded-full border bg-white dark:bg-transparent" style={{ borderColor: scoreColor(avgLcrs) + "40", backgroundColor: scoreColor(avgLcrs) + "0f" }}>
                                    <TrendingUp className="w-4 h-4" style={{ color: scoreColor(avgLcrs) }} />
                                    <span className="text-sm font-bold uppercase tracking-widest" style={{ color: scoreColor(avgLcrs) }}>
                                        {gradeLabel(avgLcrs)}
                                    </span>
                                </div>
                            </div>

                            {/* METHODOLOGY FOOTER */}
                            <div className="p-5 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 font-mono text-[9px] text-slate-500 dark:text-slate-400 leading-relaxed shadow-inner">
                                <div className="grid grid-cols-2 gap-4 mb-3">
                                    <div>
                                        <p className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest mb-1.5">LCRS Formula</p>
                                        <p className="text-indigo-600 dark:text-indigo-300 font-bold text-[10px]">LCRS = (0.4 × Semantic) + (0.6 × Claim Recall)</p>
                                        <p className="mt-1">Semantic = 1 − cosine_distance(manifest_vector, response_vector)</p>
                                        <p>Claim Recall = supported_claims / total_claims</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest mb-1.5">Inference Audit</p>
                                        {models.map((model) => (
                                            <p key={model.provider}>{model.provider}: {normalizeModelName(model.displayName)}</p>
                                        ))}
                                        <p className="mt-1">Embed: text-embedding-3-small</p>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-slate-300 dark:border-white/5 flex items-center justify-between">
                                    <span className="text-slate-500">Aligned to: ISO/IEC 42001 · NIST AI RMF · Zero-Retention Architecture</span>
                                    <span className="text-slate-400 dark:text-slate-600">{isoTimestamp}</span>
                                </div>
                            </div>
                        </div>

                        {/* BOTTOM TAGLINE */}
                        <div className="bg-slate-100 dark:bg-slate-950 py-3 text-center border-t border-slate-200 dark:border-white/5">
                            <p className="text-[9px] text-slate-500 dark:text-slate-600 uppercase tracking-[0.4em]">Precision Monitoring for the Agentic Era • AUM Context Foundry v1.2.0</p>
                        </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="flex gap-4 w-full">
                        <button
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-indigo-500/25"
                        >
                            <Download className="w-4 h-4" />
                            {isDownloading ? "Generating..." : "Download Report (PDF)"}
                        </button>
                        <button
                            onClick={() => setShowMethodology(!showMethodology)}
                            className="flex items-center justify-center flex-1 gap-2 py-4 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-2xl font-semibold border-slate-200 border dark:border-white/10 transition-all shadow-sm dark:shadow-none"
                        >
                            <BookOpen className="w-4 h-4" />
                            How We Score
                        </button>
                    </div>

                    {/* METHODOLOGY EXPLAINER PANEL */}
                    <AnimatePresence>
                        {showMethodology && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="w-full bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-6 overflow-hidden mt-4"
                            >
                                <h3 className="text-slate-900 dark:text-white font-bold mb-4 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-indigo-500 dark:text-indigo-400" /> LCRS Methodology
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                                    <div>
                                        <p className="text-indigo-600 dark:text-indigo-400 font-semibold mb-2">Formula</p>
                                        <code className="text-emerald-600 dark:text-emerald-400 font-mono text-xs bg-slate-200 dark:bg-black/30 px-3 py-2 rounded-lg block mb-3 overflow-x-auto">
                                            LCRS = (0.4 × Semantic) + (0.6 × Claim Recall)
                                        </code>
                                        <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                                            <strong className="text-slate-800 dark:text-slate-300">Semantic (40%):</strong> Cosine similarity between your verified manifest vector and the AI&apos;s response vector. Measures directional alignment.
                                        </p>
                                        <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed mt-2">
                                            <strong className="text-slate-800 dark:text-slate-300">Claim Recall (60%):</strong> Ratio of factual claims from your manifest that were correctly reproduced in the AI&apos;s answer.
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-indigo-600 dark:text-indigo-400 font-semibold mb-2">Score Bands</p>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex items-start gap-2"><span className="w-3 h-3 shrink-0 mt-0.5 rounded-full bg-emerald-500" /><span className="text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">&gt;80%</span><span className="text-slate-500">High Fidelity</span></div>
                                            <div className="flex items-start gap-2"><span className="w-3 h-3 shrink-0 mt-0.5 rounded-full bg-amber-500" /><span className="text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">55–80%</span><span className="text-slate-500">Minor Drift</span></div>
                                            <div className="flex items-start gap-2"><span className="w-3 h-3 shrink-0 mt-0.5 rounded-full bg-red-500" /><span className="text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">&lt;55%</span><span className="text-slate-500">Critical Drift</span></div>
                                        </div>
                                        <p className="text-indigo-600 dark:text-indigo-400 font-semibold mt-4 mb-2">Hallucinations</p>
                                        <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">Flagged if LCRS &lt;60% <em>or</em> any claim is &quot;contradicted&quot;.</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </motion.div>
    );
}
