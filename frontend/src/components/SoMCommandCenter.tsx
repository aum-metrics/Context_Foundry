"use client";
/**
 * SoMCommandCenter.tsx
 *
 * FIXES (2026-03-18):
 * - runAutoPilot + runBatchStabilityCheck merged into single runBatch(prompts?)
 * - filteredHistoryEntries: version filter falls back to unfiltered when no entry has .version
 *   (prevents auto-trigger loop on legacy data)
 * - autoPilotKeyRef now resets when version changes to allow re-run after new ingestion
 * - Removed manual competitorRankingRef — plain useMemo is sufficient
 * - isCriticalDrift only fires when there IS data and score is genuinely low (not on zero)
 * - isAuthError is now imported from apiClient (single source)
 * - executiveSummary no longer references non-existent .remediationRecommendation
 * - Empty state designs for KPI strip and radar chart
 * - "Run Full Market Audit" and "Re-Run Audit" consolidated — only one button visible at a time
 * - useSWR uses shared swrFetcher from apiClient
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis,
} from "recharts";
import {
  Zap, Activity, Globe, ShieldAlert, Sparkles, TrendingUp, Award,
  BriefcaseBusiness, FilePenLine, FileText, Lock, RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import { useOrganization } from "./OrganizationContext";
import { UpgradeModal } from "./UpgradeModal";
import BrandHealthCertificate from "./BrandHealthCertificate";
import AuthErrorCard from "./AuthErrorCard";
import QueryClusterInsights from "./QueryClusterInsights";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useRemediation } from "@/hooks/useRemediation";
import { apiFetch, pollJob, isAuthError, swrFetcher } from "@/lib/apiClient";
import { normalizeModelName } from "@/lib/somUtils";
import type {
  BatchResult, CompetitorInsight, ManifestSnapshot,
  PromptRun, ScoringHistoryEntry, SEOResult,
  CompetitorResponse, ManifestDataResponse,
} from "@/types/som";

// ─── Component ────────────────────────────────────────────────────────────────

export default function SoMCommandCenter({
  setActiveView: _setActiveView,
  view = "all",
  showReport = false,
  onReportClose,
}: {
  setActiveView?: (view: string) => void;
  view?: "all" | "analyze" | "intelligence" | "action";
  showReport?: boolean;
  onReportClose?: () => void;
}) {
  const { organization, refreshKey, activeManifestVersion, activeContextName } = useOrganization();
  const { models } = useModelCatalog();

  const [activeTab, setActiveTab] = useState<string>("GPT-4o");
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeFeatureName, setUpgradeFeatureName] = useState("");
  const [seoUrl, setSeoUrl] = useState("");
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoResult, setSeoResult] = useState<SEOResult | null>(null);
  const [isCertificateOpen, setIsCertificateOpen] = useState(false);
  // Per-run batch progress (0–100)
  const [batchProgress, setBatchProgress] = useState(0);

  useEffect(() => { if (showReport) setIsCertificateOpen(true); }, [showReport]);

  const handleCloseCertificate = useCallback(() => {
    setIsCertificateOpen(false);
    onReportClose?.();
  }, [onReportClose]);

  const autoPilotKeyRef = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const analysisSubject = activeContextName || organization?.name || "your company";
  const isDemoOrg = organization?.id === "demo_org_id";

  // ── SWR keys ───────────────────────────────────────────────────────────────
  const competitorsKey = organization
    ? `/api/competitor/displacement/${organization.id}?version=${encodeURIComponent(activeManifestVersion)}`
    : null;
  const manifestKey = organization
    ? `/api/workspaces/${organization.id}/manifest-data?version=${encodeURIComponent(activeManifestVersion)}`
    : null;

  const { data: competitorsData, error: competitorsError, mutate: mutateCompetitors } =
    useSWR<CompetitorResponse>(competitorsKey, swrFetcher);
  const { data: manifestData, error: manifestError, mutate: mutateManifest } =
    useSWR<ManifestDataResponse>(manifestKey, swrFetcher);

  const competitors = useMemo<CompetitorInsight[]>(() => competitorsData?.competitors ?? [], [competitorsData]);

  const manifestSnapshot: ManifestSnapshot | null = useMemo(() => manifestData ? {
    sourceUrl: manifestData.sourceUrl,
    name: manifestData.name,
    schemaData: manifestData.schemaData || {},
    industryTaxonomy: manifestData.industryTaxonomy || null,
    industryTags: manifestData.industryTags || [],
  } : null, [manifestData]);

  const currentManifestVersion: string | null = manifestData?.version ?? null;

  // ── History ────────────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async (orgId: string): Promise<ScoringHistoryEntry[]> => {
    const data = await apiFetch<{ history: ScoringHistoryEntry[] }>(`/api/simulation/history/${orgId}`);
    return (data.history ?? [])
      .map((e) => ({
        ...e,
        timestamp:
          typeof e.timestamp === "string"
            ? { seconds: Math.floor(new Date(e.timestamp).getTime() / 1000) }
            : e.timestamp,
      }))
      .reverse();
  }, []);

  const historyKey = useMemo(
    () => (organization?.id ? ([organization.id, activeManifestVersion] as const) : null),
    [organization?.id, activeManifestVersion],
  );
  const {
    data: historyEntries,
    error: historyError,
    isLoading: loading,
    mutate: mutateHistory,
  } = useSWR(historyKey, ([orgId]) => fetchHistory(orgId));

  /**
   * filteredHistoryEntries:
   * - If currentManifestVersion is known AND at least one entry has a matching .version → filter
   * - If no entry has .version (legacy data) → return all entries (avoid empty-state loop)
   * - If historyEntries is null/undefined → preserve undefined (SWR loading state)
   */
  const filteredHistoryEntries = useMemo<ScoringHistoryEntry[] | null | undefined>(() => {
    if (!historyEntries) return historyEntries;
    if (!currentManifestVersion) return historyEntries;
    const hasVersioned = historyEntries.some((e: ScoringHistoryEntry) => !!e.version);
    if (!hasVersioned) return historyEntries; // legacy data — don't filter
    return historyEntries.filter((e: ScoringHistoryEntry) => e.version === currentManifestVersion);
  }, [historyEntries, currentManifestVersion]);

  // ── Prompt suggestion ──────────────────────────────────────────────────────
  const getSuggestedPrompts = useCallback(async (): Promise<string[]> => {
    const generic = [
      `Which companies are leading in this space, and how does ${analysisSubject} compare?`,
      `What are the key criteria enterprise buyers use to shortlist a partner like ${analysisSubject}?`,
      `How does ${analysisSubject} differentiate from its established competitors?`,
      `What specific outcomes and proof points does ${analysisSubject} offer enterprise buyers?`,
      `Who would an enterprise buyer choose over ${analysisSubject}, and why?`,
    ];
    try {
      const data = await apiFetch<{ prompts?: string[] }>("/api/simulation/suggest-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: organization?.id }),
      });
      return Array.isArray(data.prompts) && data.prompts.length >= 3 ? data.prompts : generic;
    } catch {
      return generic;
    }
  }, [organization?.id, analysisSubject]);

  // ── Unified batch runner ───────────────────────────────────────────────────
  const runBatch = useCallback(async (explicitPrompts?: string[]) => {
    if (!organization?.id || batchLoading) return;
    setBatchLoading(true);
    setBatchProgress(0);

    try {
      const prompts = explicitPrompts ?? await getSuggestedPrompts();
      const manifestVersion = currentManifestVersion ?? activeManifestVersion;

      const initial = await apiFetch<{ status?: string; jobId?: string } & BatchResult>("/api/batch/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: organization.id, prompts, manifestVersion }),
      });

      let result: BatchResult;

      if ((initial.status === "processing" || initial.status === "queued") && initial.jobId) {
        const statusUrl = `/api/batch/batch/status/${organization.id}/${initial.jobId}`;

        result = await pollJob<BatchResult>(statusUrl, {
          maxAttempts: 60,
          intervalMs: 3000,
          onProgress: (attempt, max) => {
            if (mounted.current) setBatchProgress(Math.min(Math.round((attempt / max) * 95), 94));
          },
        });
      } else {
        result = initial as BatchResult;
      }

      if (mounted.current) {
        setBatchProgress(100);
        setBatchResult(result);
        await mutateHistory(); // refresh history in background
      }
    } catch (err) {
      if (mounted.current && !isAuthError(err)) {
        console.error("Batch error:", err instanceof Error ? err.message : err);
      }
    } finally {
      if (mounted.current) {
        setBatchLoading(false);
        setTimeout(() => setBatchProgress(0), 1200);
      }
    }
  }, [organization, batchLoading, getSuggestedPrompts, activeManifestVersion, currentManifestVersion, mutateHistory]);

  // ── Auth error detection ───────────────────────────────────────────────────
  const authError = [competitorsError, manifestError, historyError].find(isAuthError);

  // ── Auto-pilot: fire once per (org, manifestVersion) when no history ───────
  useEffect(() => {
    if (authError || !organization?.id || batchLoading || loading) return;
    if (!currentManifestVersion) return;
    if (filteredHistoryEntries === undefined) return; // still loading
    if (filteredHistoryEntries !== null && filteredHistoryEntries.length > 0) return;

    const key = `${organization.id}|${currentManifestVersion}`;
    if (autoPilotKeyRef.current === key) return;
    autoPilotKeyRef.current = key;
    runBatch();
  }, [filteredHistoryEntries, loading, organization?.id, batchLoading, runBatch, authError, currentManifestVersion]);

  // Reset batch result and auto-pilot guard when org/version changes
  useEffect(() => {
    setBatchResult(null);
    setBatchLoading(false);
    setSeoLoading(false);
    setBatchProgress(0);
    autoPilotKeyRef.current = null; // allow re-run for new version
  }, [organization?.id, activeManifestVersion]);

  // Revalidate SWR on refreshKey
  useEffect(() => {
    if (!refreshKey) return;
    if (competitorsKey) mutateCompetitors();
    if (manifestKey) mutateManifest();
    if (historyKey) mutateHistory();
  }, [refreshKey, competitorsKey, manifestKey, historyKey, mutateCompetitors, mutateManifest, mutateHistory]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const promptRuns = useMemo<PromptRun[]>(() => {
    const source = batchResult?.results?.length
      ? batchResult.results.filter((e) => e.prompt && e.results?.length && !e.error)
      : (filteredHistoryEntries ?? []).filter((e: ScoringHistoryEntry) => e.prompt && e.results?.length);

    return source.map((e) => ({
      prompt: (e as { prompt?: string }).prompt ?? "",
      results: ((e as { results?: Array<{
        model?: string;
        accuracy?: number;
        hasDisplacement?: boolean;
        hasHallucination?: boolean;
        claimScore?: string;
        answer?: string;
      }> }).results ?? []).map((r) => ({
        model: normalizeModelName(r.model ?? ""),
        accuracy: typeof r.accuracy === "number" ? r.accuracy : 0,
        hasDisplacement: r.hasDisplacement ?? r.hasHallucination ?? false,
        hasHallucination: r.hasHallucination ?? r.hasDisplacement ?? false,
        claimScore: r.claimScore,
        answer: r.answer,
      })),
    }));
  }, [batchResult, filteredHistoryEntries]);

  const competitorRanking = useMemo(
    () => [...competitors].sort((a, b) => (b.displacementRate ?? 0) - (a.displacementRate ?? 0)),
    [competitors],
  );

  const { queryClusterInsights, winningClusters, weakClusters, remediationSnapshot, remediationRecommendations } =
    useRemediation({ promptRuns, competitorRanking, manifestSnapshot, analysisSubject, seoResult, filteredHistoryEntries, isDemoOrg });

  const { modelTabs, radarData, chartData, fidelityRisks, dashboardKpis } =
    useDashboardMetrics({ filteredHistoryEntries, batchResult, models, activeTab, seoResult, competitorRanking, winningClusters, weakClusters });

  useEffect(() => {
    if (modelTabs.length > 0 && !modelTabs.includes(activeTab)) setActiveTab(modelTabs[0]);
  }, [activeTab, modelTabs]);

  // ── SEO Audit ──────────────────────────────────────────────────────────────
  const runSEOAudit = async () => {
    if (!seoUrl.trim() || !organization?.id) return;
    setSeoLoading(true);
    const normalizedUrl = /^https?:\/\//i.test(seoUrl.trim()) ? seoUrl.trim() : `https://${seoUrl.trim()}`;
    setSeoUrl(normalizedUrl);

    try {
      const endpoint = isDemoOrg ? "/api/seo/audit/mock" : "/api/seo/audit";
      const data = await apiFetch<{ seoScore?: number; jobId?: string } & SEOResult>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl, orgId: organization.id, manifestVersion: activeManifestVersion }),
      });

      if (data.seoScore !== undefined) {
        setSeoResult(data);
      } else if (data.jobId) {
        const result = await pollJob<SEOResult>(
          `/api/seo/audit/status/${organization.id}/${data.jobId}`,
          { maxAttempts: 20, intervalMs: 3000 },
        );
        if (mounted.current) setSeoResult(result);
      }
    } catch (err) {
      console.error("SEO audit error:", err);
    } finally {
      if (mounted.current) setSeoLoading(false);
    }
  };

  // ── Derived UI flags ───────────────────────────────────────────────────────
  const hasData = promptRuns.length > 0;
  const avgScore = dashboardKpis.somAverage;
  // Only show critical drift ring when there IS real data and score is genuinely low
  const isCriticalDrift = hasData && (batchResult?.driftRate ?? 0) > 40 || (hasData && avgScore < 55);

  // ── Executive summary (fully derived from live data, no hardcoding) ────────
  const executiveSummary = useMemo(() => {
    const top = competitorRanking[0];
    const strong = winningClusters[0];
    const weak = weakClusters[0];
    return [
      strong
        ? `${analysisSubject} is strongest on ${strong.category.toLowerCase()} prompts, led by ${strong.winnerModel}.`
        : `${analysisSubject} does not yet have enough scored prompts to identify a winning cluster.`,
      weak
        ? `The clearest gap is ${weak.category.toLowerCase()}, where claims around ${weak.missingClaims.slice(0, 2).join(" and ")} are absent.`
        : "Run the audit to reveal which buyer-intent clusters need the most attention.",
      top
        ? `${top.name} is winning on ${top.winningCategory ?? "key buyer queries"} with ${top.displacementRate}% AI Recommendation Frequency.`
        : "No competitor displacement detected from the current manifest yet.",
      seoResult
        ? `AI Search Readiness is ${seoResult.geoScore}% — public site copy needs stronger manifest-aligned proof.`
        : "Run the AI Search Readiness audit to validate public site alignment.",
    ].join(" ");
  }, [analysisSubject, competitorRanking, winningClusters, weakClusters, seoResult]);

  if (authError) return <AuthErrorCard />;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`w-full animate-fade-in font-sans transition-all duration-700 ${isCriticalDrift ? "ring-2 ring-rose-500/20 ring-inset rounded-2xl p-1" : ""}`}>

      {/* ══ STEP 1: AI OUTCOME ══════════════════════════════════════════════ */}
      <div className="mb-12 space-y-8">

        {/* Header row */}
        <div className="flex flex-col xl:flex-row items-start justify-between gap-8 mb-6">
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-widest">
              <Zap className="w-3 h-3" /> Step 1: AI Outcome
            </div>
            <h1 className="text-4xl xl:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1]">
              {analysisSubject}<br />
              <span className="text-indigo-500">Market Intelligence Pulse</span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              AI Recommendation Share (Share of Model) across GPT-4o, Claude 4.5, and Gemini 3 — identifying where you lose buyer intent to{" "}
              <span className="font-bold text-slate-900 dark:text-white">{dashboardKpis.topCompetitorName}</span>.
            </p>
          </div>

          {/* Batch progress indicator (while running) */}
          {batchLoading && (
            <div className="w-full xl:w-80 p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-3">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-indigo-500 animate-spin shrink-0" />
                <p className="text-sm font-bold text-slate-900 dark:text-white">Generating Market Pulse…</p>
              </div>
              <div className="w-full h-1 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full"
                  animate={{ width: `${Math.max(batchProgress, 2)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <p className="text-[10px] text-slate-500 font-bold">{batchProgress}% complete</p>
            </div>
          )}

          {/* CTA: only show when NOT loading */}
          {!batchLoading && (
            <div className="xl:w-64">
              <motion.button
                onClick={() => runBatch()}
                disabled={batchLoading}
                whileTap={{ scale: 0.97 }}
                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-4 rounded-2xl font-black shadow-2xl hover:shadow-indigo-500/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3 group"
              >
                <Sparkles className="w-5 h-5 text-indigo-400 group-hover:rotate-12 transition-transform" />
                {hasData ? "Re-Run Audit" : "Run Market Audit"}
              </motion.button>
              <p className="text-center text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-widest">
                One-click competitive intelligence
              </p>
            </div>
          )}
        </div>

        {/* KPI STRIP */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading && !hasData ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="animate-pulse h-32 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 backdrop-blur-xl" />
            ))
          ) : (
            <>
              {[
                {
                  label: "AI Recommendation Share",
                  value: hasData ? `${avgScore}%` : "–",
                  sub: hasData ? "Narrative share across LLM families" : "Run audit to measure",
                  icon: <Globe className="w-4 h-4" />,
                  colorClass: "bg-indigo-500/10 text-indigo-500",
                  delta: hasData && remediationSnapshot && !remediationSnapshot.isDemoBypass ? remediationSnapshot.deltaSom : null,
                },
                {
                  label: "AI Rec. Frequency (ARF)",
                  value: hasData ? `${dashboardKpis.topCompetitorPressure}%` : "–",
                  sub: hasData ? `Preference toward ${dashboardKpis.topCompetitorName}` : "No competitor data yet",
                  icon: <ShieldAlert className="w-4 h-4" />,
                  colorClass: "bg-rose-500/10 text-rose-500",
                },
                {
                  label: "Winning Narrative",
                  value: queryClusterInsights[0]?.category ?? (hasData ? "None" : "–"),
                  sub: hasData ? "Highest brand authority cluster" : "Run audit to identify",
                  icon: <Award className="w-4 h-4" />,
                  colorClass: "bg-emerald-500/10 text-emerald-500",
                  truncate: true,
                },
                {
                  label: "Visibility Gaps",
                  value: hasData ? `${weakClusters.length}` : "–",
                  sub: hasData ? "Buyer intent clusters needing action" : "Run audit to detect",
                  icon: <TrendingUp className="w-4 h-4 rotate-180" />,
                  colorClass: "bg-amber-500/10 text-amber-500",
                },
              ].map(({ label, value, sub, icon, colorClass, delta, truncate }) => (
                <div key={label} className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</p>
                    <div className={`p-2 rounded-lg ${colorClass}`}>{icon}</div>
                  </div>
                  <div className="flex items-end gap-2 mb-1">
                    <h3 className={`font-bold text-slate-900 dark:text-white ${truncate ? "text-xl truncate max-w-[160px]" : "text-4xl"}`}>
                      {value}
                    </h3>
                    {delta != null && (
                      <span className={`text-xs font-medium mb-1 ${delta >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        {delta >= 0 ? `+${delta}` : delta}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{sub}</p>
                </div>
              ))}
            </>
          )}
        </div>

        {/* EXECUTIVE NARRATIVE CARD */}
        <div className="rounded-3xl p-10 border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-bl-[120px] pointer-events-none" />
          <div className="flex items-center gap-2 mb-6 text-indigo-600 dark:text-indigo-400">
            <BriefcaseBusiness className="w-5 h-5" />
            <h2 className="text-xs font-extrabold uppercase tracking-[0.3em]">Strategy Insight</h2>
          </div>

          {!hasData && !batchLoading ? (
            <div className="py-6 text-center">
              <p className="text-xl font-medium text-slate-400 dark:text-slate-600">
                No audit data yet — click <strong className="text-indigo-500">Run Market Audit</strong> above to generate your first competitive intelligence report.
              </p>
            </div>
          ) : (
            <p className="text-2xl md:text-3xl font-medium text-slate-800 dark:text-slate-100 leading-relaxed first-letter:text-6xl first-letter:font-bold first-letter:text-indigo-600 first-letter:mr-3 first-letter:float-left first-letter:leading-none">
              {executiveSummary}
            </p>
          )}

          {hasData && (
            <div className="mt-10 pt-8 border-t border-slate-100 dark:border-white/5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {[
                  { label: "Observed Outcome", text: weakClusters[0]?.observedOutcome ?? "Narrative drift detected in core categories.", accent: false },
                  { label: "Winning Competitor", text: weakClusters[0]?.winningCompetitor ?? dashboardKpis.topCompetitorName, accent: false },
                  { label: "Priority Remediation", text: weakClusters[0]?.missingClaims[0] ?? "Inject missing capability assertions.", accent: true },
                ].map(({ label, text, accent }) => (
                  <div key={label} className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">{label}</p>
                    <p className={`text-sm font-medium ${accent ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-slate-200"}`}>{text}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setIsCertificateOpen(true)}
                  className="px-7 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition-all active:scale-95"
                >
                  <FilePenLine className="w-4 h-4" /> Brand Health Report
                </button>
                <button
                  onClick={() => runBatch()}
                  disabled={batchLoading}
                  className="px-7 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-bold text-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${batchLoading ? "animate-spin" : ""}`} />
                  {batchLoading ? "Processing…" : "Re-Run Audit"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ STEP 2: INTELLIGENCE ════════════════════════════════════════════ */}
      {(view === "all" || view === "intelligence") && (
        <div className="space-y-12 mb-12">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Step 2: Competitive Intelligence</h2>
              <p className="text-sm text-slate-500">Where you win vs lose in the Generative Search ecosystem.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <QueryClusterInsights loading={loading && !hasData} insights={queryClusterInsights} />

              {/* Trend chart */}
              <div className="rounded-2xl p-8 border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-400">Positioning Stability Trend</h3>
                  <div className="flex gap-2">
                    {modelTabs.map((m) => (
                      <button key={m} onClick={() => setActiveTab(m)}
                        className={`px-3 py-1 rounded-lg text-[10px] uppercase font-bold tracking-widest transition-all ${activeTab === m ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}
                      >{m}</button>
                    ))}
                  </div>
                </div>
                <div className="h-[280px]">
                  {!hasData ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/20">
                      <Activity className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                      <p className="text-xs text-slate-400 font-medium">Run the audit to populate trend data</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} strokeOpacity={0.1} />
                        <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700 }} domain={[0, 100]} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "none", borderRadius: "12px", color: "#fff" }} />
                        <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} fill="url(#trendGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {/* Market displacement */}
              <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 shadow-xl">
                <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-400 mb-6">Market Displacement</h3>
                {competitorRanking.length === 0 ? (
                  <p className="text-xs text-slate-500 font-bold text-center py-6 uppercase tracking-widest">
                    {hasData ? "No competitor displacement detected" : "Run audit to detect rivals"}
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-rose-500 uppercase tracking-widest">Top Competitive Risk</p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">{dashboardKpis.topCompetitorName}</h3>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-slate-100 dark:bg-white/5 h-2 rounded-full overflow-hidden">
                        <motion.div
                          className="bg-rose-500 h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${dashboardKpis.topCompetitorPressure}%` }}
                          transition={{ duration: 1.2, ease: "easeOut" }}
                        />
                      </div>
                      <span className="text-sm font-black text-rose-500">{dashboardKpis.topCompetitorPressure}%</span>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">* AI Recommendation Frequency vs your brand.</p>
                  </div>
                )}
              </div>

              {/* Radar */}
              <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 shadow-xl">
                <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-400 mb-4">Context Radar</h3>
                {!hasData || radarData.every((d) => !d.A) ? (
                  <div className="h-[220px] flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/20">
                    <Sparkles className="w-6 h-6 text-slate-300 dark:text-slate-700" />
                    <p className="text-xs text-slate-400">Radar populates after first audit</p>
                  </div>
                ) : (
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748b", fontSize: 9, fontWeight: 700 }} />
                        <Radar name="Brand" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.55} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Search Readiness + Displacement Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* AI Search Readiness */}
            <div className="rounded-2xl p-8 border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 shadow-xl">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3 mb-6">
                <Globe className="w-5 h-5 text-emerald-500" /> AI Search Readiness
              </h2>
              {["growth", "scale", "enterprise"].includes(organization?.subscriptionTier ?? "explorer") ? (
                <div className="space-y-5">
                  <div className="flex gap-2">
                    <input
                      type="url" value={seoUrl}
                      onChange={(e) => setSeoUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && runSEOAudit()}
                      placeholder="https://yourbusiness.com"
                      className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                    <button
                      onClick={runSEOAudit}
                      disabled={seoLoading || !seoUrl.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                    >
                      {seoLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Audit"}
                    </button>
                  </div>
                  <AnimatePresence>
                    {seoResult && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                          {[["SEO", seoResult.seoScore], ["AI Search", seoResult.geoScore], ["Overall", seoResult.overallScore]].map(([label, score]) => (
                            <div key={label as string} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 text-center">
                              <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">{label}</p>
                              <p className={`text-2xl font-black ${(score as number) >= 70 ? "text-emerald-500" : "text-amber-500"}`}>{score}%</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 leading-relaxed">
                          <Sparkles className="w-3 h-3 inline mr-1.5 text-indigo-400" />
                          {seoResult.recommendation}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="py-10 text-center bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                  <Lock className="w-8 h-8 mx-auto text-slate-400 mb-4" />
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Upgrade to unlock AI Search Readiness audits.</p>
                  <button
                    onClick={() => { setUpgradeFeatureName("AI Search Readiness"); setIsUpgradeModalOpen(true); }}
                    className="text-xs font-bold text-indigo-500 hover:underline"
                  >View Plans</button>
                </div>
              )}
            </div>

            {/* Displacement Alerts */}
            <div className="rounded-2xl p-8 border border-rose-500/10 bg-white dark:bg-slate-900 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 pointer-events-none">
                <ShieldAlert className="w-12 h-12 text-rose-500/8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3 mb-6">
                <Activity className="w-5 h-5 text-rose-500" /> Active Displacement Alerts
              </h2>
              <div className="space-y-4">
                {(loading && !hasData) ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="animate-pulse bg-slate-100 dark:bg-slate-800/40 h-16 rounded-xl" />
                  ))
                ) : fidelityRisks.length > 0 ? (
                  fidelityRisks.map((risk) => (
                    <div key={risk.id} className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex items-center justify-between hover:border-rose-500/30 transition-all">
                      <div>
                        <p className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-1">{normalizeModelName(risk.model)}</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{risk.text}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ml-3 ${risk.severity === "high" ? "bg-rose-500 text-white" : "bg-amber-500 text-white"}`}>
                        {risk.severity}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-400">
                    <p className="text-sm font-medium">{hasData ? "Monitoring complete — no displacement detected." : "Run audit to start monitoring."}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ STEP 3: ACTION ══════════════════════════════════════════════════ */}
      {(view === "all" || view === "action") && (
        <div className="space-y-6">
          <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <FilePenLine className="w-4 h-4 text-fuchsia-500" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Step 3: Action Center</h2>
              </div>
              {hasData && (
                <button
                  onClick={() => setIsCertificateOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-all flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" /> Full Report
                </button>
              )}
            </div>

            {remediationRecommendations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center space-y-3">
                <Sparkles className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {hasData
                    ? "No significant gaps detected — all buyer-intent clusters are well-covered."
                    : "Remediation guidance will appear after the first audit run."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {remediationRecommendations.map((rec) => (
                  <div key={`${rec.category}-${rec.title}`} className="rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/30 p-5">
                    <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3 mb-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-1">{rec.category}</p>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{rec.title}</h3>
                      </div>
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-slate-300 shrink-0">
                        Winning competitor: {rec.winningCompetitor}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-sm mb-4">
                      <div className="rounded-xl bg-white dark:bg-black/10 border border-slate-200 dark:border-white/5 p-4">
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Observed outcome</p>
                        <p className="text-slate-700 dark:text-slate-300">{rec.observedOutcome}</p>
                      </div>
                      <div className="rounded-xl bg-white dark:bg-black/10 border border-slate-200 dark:border-white/5 p-4">
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Missing claims</p>
                        <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                          {rec.missingClaims.map((c) => <li key={c}>• {c}</li>)}
                        </ul>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 text-xs">
                      {[["Schema", rec.schemaSuggestion], ["FAQ", rec.faqSuggestion], ["llms.txt", rec.llmsSuggestion]].map(([label, text]) => (
                        <div key={label as string} className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-500/10 p-4">
                          <p className="uppercase tracking-widest text-indigo-500 mb-2 text-[10px]">{label}</p>
                          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Brand Health Certificate */}
      <AnimatePresence>
        {isCertificateOpen && (
          <BrandHealthCertificate
            organizationName={analysisSubject}
            asovScore={avgScore}
            driftRate={batchResult?.driftRate ?? 0}
            onClose={handleCloseCertificate}
            modelResults={filteredHistoryEntries?.length ? [...filteredHistoryEntries].reverse()[0]?.results : undefined}
            lastPrompt={filteredHistoryEntries?.length ? [...filteredHistoryEntries].reverse()[0]?.prompt : undefined}
            seoResult={seoResult ?? undefined}
            competitors={competitors.map((c: CompetitorInsight) => ({
              ...c,
              missingAssertions: (c.missingAssertions ?? [])
                .map((a) => (typeof a === "string" ? a : (a as { assertion?: string }).assertion ?? ""))
                .filter(Boolean),
            }))}
            activeContextName={analysisSubject}
            clusterInsights={queryClusterInsights}
            remediationRecommendations={remediationRecommendations}
            allowPdfDownload={organization?.subscriptionTier !== "explorer"}
            onUpgradeRequired={() => { setUpgradeFeatureName("Brand Health PDF Report"); setIsUpgradeModalOpen(true); }}
          />
        )}
      </AnimatePresence>

      <UpgradeModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} featureHighlight={upgradeFeatureName} />
    </div>
  );
}
