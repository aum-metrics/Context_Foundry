"use client";
// frontend/src/components/QuickScan.tsx
//
// THE CONVERSION FIX.
// Collapses 5-step onboarding into a single "aha moment" on the landing page.
// User types company name → sees real score in ~15s → hits upgrade gate → signs up.
//
// HOW TO EMBED IN page.tsx hero section:
//   import QuickScan from "@/components/QuickScan";
//   ...
//   <section className="flex flex-col items-center px-4 py-24">
//     <h1>...</h1>
//     <QuickScan />
//   </section>
//
// DEPENDENCIES: lucide-react (already in project), framer-motion (already in project)

import { useState, useRef, useCallback, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    Search, Loader2, ArrowRight, Lock,
    AlertTriangle, Sparkles, TrendingUp, TrendingDown, Minus
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScanResult {
    company_name: string;
    score: number;
    score_label: string;
    low_visibility: boolean;
    top_competitor: string;
    key_gap: string;
    winning_category: string;
    summary: string;
    scanned_at: string;
    cached?: boolean;
    demo?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
    if (score >= 70) return "#10b981"; // emerald-500
    if (score >= 45) return "#f59e0b"; // amber-500
    return "#ef4444";                   // red-500
}

function scoreBg(score: number): string {
    if (score >= 70) return "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20";
    if (score >= 45) return "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20";
    return "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20";
}

function ScoreIcon({ score }: { score: number }) {
    if (score >= 70) return <TrendingUp className="w-3.5 h-3.5" />;
    if (score >= 45) return <Minus className="w-3.5 h-3.5" />;
    return <TrendingDown className="w-3.5 h-3.5" />;
}

// Circular progress ring
function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
    const r = size * 0.42;
    const circ = 2 * Math.PI * r;
    const dash = circ * (1 - score / 100);
    const color = scoreColor(score);

    return (
        <svg width={size} height={size} className="-rotate-90 shrink-0">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                strokeWidth={size * 0.08} className="stroke-slate-100 dark:stroke-slate-800" />
            <motion.circle
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={color} strokeWidth={size * 0.08} strokeLinecap="round"
                strokeDasharray={circ}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: dash }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
            />
            {/* Centred score text — rotated back to normal */}
            <g transform={`rotate(90, ${size / 2}, ${size / 2})`}>
                <text x={size / 2} y={size / 2 - 4}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={size * 0.26} fontWeight="800"
                    fill={color}>
                    {score}
                </text>
                <text x={size / 2} y={size / 2 + size * 0.2}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={size * 0.1} fill="var(--color-text-secondary, #94a3b8)">
                    / 100
                </text>
            </g>
        </svg>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function QuickScan() {
    const [company, setCompany] = useState("");
    const [domain, setDomain] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleScan = useCallback(async (e?: FormEvent) => {
        e?.preventDefault();
        const trimmed = company.trim();
        if (!trimmed || loading) return;

        setLoading(true);
        setErrorMsg(null);
        setResult(null);

        try {
            const resp = await fetch("/api/quick-scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    company_name: trimmed,
                    domain: domain.trim() || undefined,
                }),
            });

            if (resp.status === 429) {
                const body = await resp.json().catch(() => ({}));
                setErrorMsg(body?.detail?.message ?? "Rate limit reached. Sign up for unlimited scans.");
                return;
            }

            if (!resp.ok) {
                const body = await resp.json().catch(() => ({}));
                setErrorMsg(
                    body?.detail?.message
                        ?? body?.detail
                        ?? body?.message
                        ?? "Scan failed — please try again."
                );
                return;
            }

            const data: Partial<ScanResult> = await resp.json();
            if (typeof data.score !== "number" || !data.company_name) {
                setErrorMsg("Scan failed — please try again.");
                return;
            }

            // Normalize fields defensively
            const normalized: ScanResult = {
                company_name: data.company_name ?? trimmed,
                score: Number.isFinite(data.score) ? data.score : 0,
                score_label: data.score_label ?? "AI Visibility",
                low_visibility: Boolean(data.low_visibility),
                top_competitor: data.top_competitor ?? "Not identified",
                key_gap: data.key_gap ?? "Insufficient public proof points",
                winning_category: data.winning_category ?? "General enterprise",
                summary: data.summary ?? "",
                scanned_at: data.scanned_at ?? new Date().toISOString(),
                cached: data.cached,
                demo: data.demo,
            };
            setResult(normalized);

            // Scroll result into view on mobile
            setTimeout(() => {
                document.getElementById("qs-result")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }, 100);
        } catch {
            setErrorMsg("Connection error — please try again.");
        } finally {
            setLoading(false);
        }
    }, [company, domain, loading]);

    return (
        <div className="w-full max-w-xl mx-auto select-none">

            {/* ── Input row ── */}
            <form onSubmit={handleScan} className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={company}
                        onChange={e => setCompany(e.target.value)}
                        placeholder="Your company name"
                        autoComplete="organization"
                        maxLength={100}
                        className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 shadow-sm transition"
                    />
                </div>
                <button
                    type="submit"
                    disabled={!company.trim() || loading}
                    className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all shrink-0"
                >
                    {loading
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Sparkles className="w-4 h-4" />
                    }
                    {loading ? "Scanning…" : "Scan free"}
                </button>
            </form>

            <p className="text-center text-[11px] text-slate-400 mt-2">
                No sign-up required · Powered by GPT-4o · ~15 seconds
            </p>

            {/* ── Optional domain hint (shown after first interaction) ── */}
            <AnimatePresence>
                {company.length > 1 && !result && !loading && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <input
                            type="text"
                            value={domain}
                            onChange={e => setDomain(e.target.value)}
                            placeholder="yoursite.com (optional — improves accuracy)"
                            className="w-full mt-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 shadow-sm transition"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Error ── */}
            <AnimatePresence>
                {errorMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-sm text-rose-700 dark:text-rose-300"
                    >
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{errorMsg}</span>
                        {errorMsg.toLowerCase().includes("sign up") && (
                            <Link href="/login" className="ml-auto shrink-0 font-semibold underline underline-offset-2">
                                Sign up →
                            </Link>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Loading skeleton ── */}
            <AnimatePresence>
                {loading && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-6"
                    >
                        <div className="flex items-center gap-4 mb-5">
                            <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
                            <div className="flex-1 space-y-2">
                                <div className="h-5 w-40 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                                <div className="h-3.5 w-56 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse [animation-delay:100ms]" />
                                <div className="h-3.5 w-44 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse [animation-delay:200ms]" />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {[0, 1, 2].map(i => (
                                <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"
                                    style={{ animationDelay: `${i * 120}ms` }} />
                            ))}
                        </div>
                        <p className="text-center text-xs text-slate-400 mt-5 animate-pulse">
                            Asking GPT-4o about {company}…
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Result card ── */}
            <AnimatePresence>
                {result && !loading && (
                    <motion.div
                        id="qs-result"
                        initial={{ opacity: 0, y: 14, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "spring", stiffness: 280, damping: 28 }}
                        className="mt-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
                    >
                        {/* Demo banner */}
                        {result.demo && (
                            <div className="px-5 py-2 text-[11px] text-center bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300">
                                Demo result — sign up to scan your actual company with full accuracy
                            </div>
                        )}

                        <div className="p-6">
                            {/* Score + headline */}
                            <div className="flex items-start gap-5 mb-5">
                                <ScoreRing score={result.score} size={88} />
                                <div className="flex-1 min-w-0 pt-1">
                                    <div
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2 border ${scoreBg(result.score)}`}
                                        style={{ color: scoreColor(result.score) }}
                                    >
                                        <ScoreIcon score={result.score} />
                                        {result.score_label}
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                                        {result.company_name}
                                    </h3>
                                    {result.summary && (
                                        <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1 leading-snug line-clamp-2">
                                            {result.summary}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Three insight tiles */}
                            <div className="grid grid-cols-3 gap-2.5 mb-5">
                                {(() => {
                                    const competitorLabel =
                                        result.score >= 70 ? "Closest competitor" :
                                        result.score >= 45 ? "AI also suggests" :
                                        "AI prefers instead";
                                    return (
                                <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-1">
                                        {competitorLabel}
                                    </p>
                                    <p className="text-[12px] font-semibold text-rose-700 dark:text-rose-300 leading-snug">
                                        {result.top_competitor === "Not identified"
                                            ? "No dominant rival found"
                                            : result.top_competitor}
                                    </p>
                                </div>
                                    );
                                })()}
                                <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-1">
                                        Key gap to fix
                                    </p>
                                    <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-300 leading-snug">
                                        {result.key_gap}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-1">
                                        Strongest in
                                    </p>
                                    <p className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300 leading-snug">
                                        {result.winning_category}
                                    </p>
                                </div>
                            </div>

                            {/* Locked full-report CTA */}
                            <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]">
                                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                                        Full report: Claude + Gemini, claim-level scoring, remediation copy
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                        Includes llms.txt generation + competitor-by-competitor breakdown
                                    </p>
                                </div>
                                <Link
                                    href={`/login?prefill=${encodeURIComponent(result.company_name)}`}
                                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold shadow-md shadow-indigo-600/20 transition-all"
                                >
                                    Get full report
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>

                            {/* Footer metadata */}
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    GPT-4o · temperature 0
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    {result.cached ? "Cached · " : ""}
                                    {Number.isFinite(Date.parse(result.scanned_at))
                                        ? new Date(result.scanned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                        : "Just now"}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
