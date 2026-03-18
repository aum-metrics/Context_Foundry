/**
 * Author: "Sambath Kumar Natarajan"
 * Product: "AUM Context Foundry"
 * Description: Semantic Ingestion Engine — URL/PDF → Verified JSON-LD manifest.
 *
 * FIXES (2026-03-18):
 * - File upload now handles async jobId responses (same as URL ingestion)
 * - Unified pollJob() for both upload and URL paths via shared apiClient
 * - Editable schema textarea (was read-only <pre>)
 * - Auto-scrolling terminal log with progress bar + ETA hint
 * - URL ingestion sets rawText when available from backend
 * - Immediate sync response (no jobId) now correctly dispatches manifest update
 * - Logs cleared on re-ingest; file input reset (same-file re-upload works)
 * - Inline error banner (not only terminal log)
 * - useCallback on addLog to prevent stale closure in polling
 */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Box, UploadCloud, ChevronRight,
  Terminal as TerminalIcon, CheckCircle2, RefreshCw, Download,
  AlertCircle, Globe, Sparkles,
} from "lucide-react";
import { useOrganization } from "./OrganizationContext";
import { apiFetch, pollJob, isAuthError, ApiError, sleep } from "@/lib/apiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IngestionResult {
  name?: string;
  schemaData?: Record<string, unknown>;
  rawText?: string;
  version?: string;
  jobId?: string;
  status?: string;
  [key: string]: unknown;
}

interface LogEntry {
  id: number;
  text: string;
  type: "info" | "success" | "error" | "system";
}

// ─── VectorCloud ambient decoration ──────────────────────────────────────────

const VectorCloud = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-25">
    {Array.from({ length: 10 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1 h-1 bg-cyan-400 rounded-full"
        initial={{ x: `${Math.random() * 100}%`, y: `${Math.random() * 100}%`, opacity: 0 }}
        animate={{
          x: [`${Math.random() * 100}%`, `${Math.random() * 100}%`],
          y: [`${Math.random() * 100}%`, `${Math.random() * 100}%`],
          opacity: [0, 0.6, 0],
          scale: [0, 1.5, 0],
        }}
        transition={{ duration: Math.random() * 3 + 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
      />
    ))}
    <svg className="absolute inset-0 w-full h-full">
      <motion.path
        d="M 50 80 Q 200 20 350 80 T 650 60"
        stroke="url(#vg1)" strokeWidth="0.5" fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: [0, 0.12, 0] }}
        transition={{ duration: 5, repeat: Infinity }}
      />
      <defs>
        <linearGradient id="vg1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
          <stop offset="50%" stopColor="#22d3ee" stopOpacity="1" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function SemanticIngestion() {
  const {
    organization, refreshKey,
    activeManifestVersion, setActiveManifestVersion,
    loadingOrg,
  } = useOrganization();

  const [step, setStep] = useState<"upload" | "processing" | "editor">("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [schemaData, setSchemaData] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [schemaEdited, setSchemaEdited] = useState(false);
  const [copyLabel, setCopyLabel] = useState<"Copy" | "Copied!">("Copy");
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const logIdRef = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = useCallback((text: string, type: LogEntry["type"] = "info") => {
    if (!mounted.current) return;
    setLogs((prev) => [...prev, { id: logIdRef.current++, text, type }]);
  }, []);

  // ── Load existing manifest on org change ───────────────────────────────────
  useEffect(() => {
    if (!organization?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<IngestionResult>(
          `/api/workspaces/${organization.id}/manifest-data?version=${encodeURIComponent(activeManifestVersion)}`,
        );
        if (cancelled || !mounted.current) return;
        if (data.schemaData && Object.keys(data.schemaData).length > 0) {
          setSchemaData(JSON.stringify(data.schemaData, null, 2));
          setRawText(null);
          setSchemaEdited(false);
          setStep("editor");
        }
      } catch (e) {
        if (!cancelled && !isAuthError(e)) console.warn("Manifest load:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [organization?.id, refreshKey, activeManifestVersion]);

  // ── Manifest dispatch helper ────────────────────────────────────────────────
  const dispatchManifestUpdate = useCallback(async (orgId: string, version?: string) => {
    if (version) setActiveManifestVersion(version);
    await sleep(600); // let Firestore propagate
    if (mounted.current) {
      window.dispatchEvent(new CustomEvent("aum_manifest_updated", { detail: { orgId, version } }));
    }
  }, [setActiveManifestVersion]);

  // ── Core ingestion — unified for file and URL ──────────────────────────────
  const runIngestion = useCallback(async (mode: "file" | "url", payload: File | string) => {
    if (!organization?.id || loadingOrg) {
      setInlineError("Workspace still initializing. Please wait a moment and retry.");
      return;
    }
    if (isIngesting) return;

    setIsIngesting(true);
    setStep("processing");
    setLogs([]);
    setSchemaData(null);
    setRawText(null);
    setInlineError(null);
    setProgress(0);
    setSchemaEdited(false);
    logIdRef.current = 0;

    try {
      // ── Step 1: Submit job ────────────────────────────────────────────────
      let initialResult: IngestionResult;

      if (mode === "file") {
        const file = payload as File;
        addLog(`Secure ingestion: ${file.name}`, "system");
        addLog("Protocol: Zero-Retention (volatile memory only)", "system");
        addLog("Connecting to Semantic Ingestion Engine…", "info");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("orgId", organization.id);

        initialResult = await apiFetch<IngestionResult>("/api/ingestion/parse", {
          method: "POST",
          body: formData,
        });
        addLog("PDF streamed to volatile memory — LLM schema mapping…", "info");
      } else {
        const rawUrl = payload as string;
        const normalizedUrl = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
        addLog(`URL ingestion: ${normalizedUrl}`, "system");
        addLog("Protocol: Zero-Retention (volatile memory only)", "system");
        addLog("Connecting to Semantic Ingestion Engine…", "info");

        initialResult = await apiFetch<IngestionResult>("/api/ingestion/parse-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: normalizedUrl, orgId: organization.id }),
        });
        addLog("URL queued — monitoring extraction pipeline…", "info");
      }

      setProgress(15);

      // ── Step 2: Handle async vs sync response ─────────────────────────────
      let result: IngestionResult;

      if (initialResult.jobId) {
        addLog("Job queued successfully. Monitoring progress…", "info");

        result = await pollJob<IngestionResult>(
          `/api/ingestion/job/${initialResult.jobId}?orgId=${encodeURIComponent(organization.id)}`,
          {
            maxAttempts: 60,
            intervalMs: 3000,
            onProgress: (attempt, max, msg) => {
              if (!mounted.current) return;
              setProgress(Math.min(15 + Math.round((attempt / max) * 74), 89));
              if (attempt % 5 === 0 || msg) {
                addLog(msg ?? `LLM extraction in progress… (${attempt}/${max})`, "info");
              }
            },
          },
        );
      } else {
        // Synchronous response — already complete
        result = initialResult;
        setProgress(82);
      }

      setProgress(96);
      addLog("SUCCESS: Structured JSON-LD generated.", "success");

      // ── Step 3: Apply result ──────────────────────────────────────────────
      const schema = result.schemaData ?? (result as Record<string, unknown>);
      setSchemaData(JSON.stringify(schema, null, 2));
      if (result.rawText) setRawText(result.rawText as string);

      setProgress(100);
      await dispatchManifestUpdate(organization.id, result.version as string | undefined);
      await sleep(700);
      if (mounted.current) setStep("editor");

    } catch (err) {
      const msg = err instanceof ApiError ? err.message
        : err instanceof Error ? err.message
        : "Unknown ingestion failure.";
      addLog(`CRITICAL ERROR: ${msg}`, "error");
      setInlineError(msg);
      if (mounted.current) setProgress(0);
    } finally {
      if (mounted.current) setIsIngesting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [organization, loadingOrg, isIngesting, addLog, dispatchManifestUpdate]);

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const handleReset = () => {
    setStep("upload");
    setSchemaData(null);
    setRawText(null);
    setLogs([]);
    setInlineError(null);
    setProgress(0);
    setSchemaEdited(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = () => {
    if (!schemaData) return;
    const blob = new Blob([schemaData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(organization?.name ?? "schema").replace(/\s+/g, "_")}_schema.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!schemaData) return;
    await navigator.clipboard.writeText(schemaData).catch(() => null);
    setCopyLabel("Copied!");
    setTimeout(() => setCopyLabel("Copy"), 2000);
  };

  const isReady = !loadingOrg && !!organization?.id;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full flex flex-col space-y-6 animate-fade-in font-sans">

      <header className="mb-2 shrink-0">
        <h2 className="text-2xl font-light text-slate-900 dark:text-white flex items-center gap-3">
          <Box className="w-6 h-6 text-cyan-600 dark:text-cyan-400 shrink-0" />
          Semantic Ingestion Engine
        </h2>
        <p className="text-sm text-slate-500 mt-1 uppercase tracking-widest">
          Unstructured Data → Verified Agent Context
        </p>
      </header>

      <div className="flex-1 w-full flex flex-col items-center justify-center min-h-0">
        <AnimatePresence mode="wait">

          {/* ══ UPLOAD ════════════════════════════════════════════════════════ */}
          {step === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl space-y-4"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) runIngestion("file", f); }}
                accept="application/pdf"
                className="hidden"
              />

              {/* Drop zone */}
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload file or drag and drop"
                className={[
                  "relative group rounded-3xl border-2 border-dashed transition-all duration-300 backdrop-blur-xl p-12 flex flex-col items-center justify-center shadow-sm dark:shadow-none select-none",
                  isDragging ? "border-cyan-500 bg-cyan-50 dark:border-cyan-400 dark:bg-cyan-400/10"
                    : "border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-indigo-500 dark:hover:bg-slate-800/50",
                  !isReady ? "opacity-50 cursor-not-allowed pointer-events-none" : "cursor-pointer",
                ].join(" ")}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault(); setIsDragging(false);
                  const f = e.dataTransfer.files?.[0]; if (f) runIngestion("file", f);
                }}
                onClick={() => isReady && fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && isReady && fileInputRef.current?.click()}
              >
                <motion.div
                  className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-6 shadow-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <UploadCloud className={`w-10 h-10 transition-colors ${isDragging ? "text-cyan-500" : "text-slate-400 group-hover:text-indigo-500"}`} />
                </motion.div>

                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                  {loadingOrg ? "Initializing workspace…" : "Drop Corporate Assets Here"}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-center mb-5 max-w-sm text-sm leading-relaxed">
                  PDFs, pitch decks, or documentation → machine-readable JSON-LD.
                </p>

                <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-600">
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF, DOCX</span>
                  <span className="opacity-40">·</span>
                  <Globe className="w-3.5 h-3.5" />
                  <span>Any public URL</span>
                </div>
              </div>

              {/* Inline error */}
              <AnimatePresence>
                {inlineError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-start gap-3 p-4 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{inlineError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Divider */}
              <div className="flex items-center gap-3 px-1">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">or ingest a URL</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              </div>

              {/* URL input */}
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUrlGo()}
                  placeholder="yourcompany.com"
                  disabled={!isReady}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-11 pr-14 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm placeholder-slate-400 disabled:opacity-50"
                />
                <motion.button
                  type="button"
                  onClick={handleUrlGo}
                  disabled={!urlInput.trim() || !isReady}
                  whileTap={{ scale: 0.88 }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white p-2 rounded-xl transition-all shadow-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ══ PROCESSING ════════════════════════════════════════════════════ */}
          {step === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-3xl space-y-4"
            >
              {/* Progress bar header */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                    LLM Extraction Pipeline
                  </span>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {progress}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 rounded-full"
                    animate={{ width: `${Math.max(progress, 2)}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Terminal */}
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/20 bg-white dark:bg-slate-950 overflow-hidden shadow-xl dark:shadow-[0_0_40px_rgba(99,102,241,0.07)]">
                {/* Chrome bar */}
                <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-rose-400/50" />
                    <div className="w-3 h-3 rounded-full bg-amber-400/50" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400/50" />
                  </div>
                  <TerminalIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 ml-2" />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">semantic_ingestion_pipeline</span>
                </div>

                {/* Log stream */}
                <div className="relative h-72 overflow-y-auto p-5 font-mono text-sm space-y-2">
                  <VectorCloud />
                  {logs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.12 }}
                      className={`flex gap-3 relative z-10 ${
                        log.type === "success" ? "text-emerald-500 dark:text-emerald-400"
                          : log.type === "error" ? "text-rose-500 dark:text-rose-400"
                          : log.type === "system" ? "text-slate-500 dark:text-slate-400"
                          : "text-indigo-600 dark:text-indigo-400"
                      }`}
                    >
                      <span className="shrink-0 text-slate-400 dark:text-slate-600 select-none">›</span>
                      <span>{log.text}</span>
                    </motion.div>
                  ))}
                  {isIngesting && (
                    <div className="flex gap-3 text-slate-400 dark:text-slate-600 relative z-10">
                      <span className="select-none">›</span>
                      <motion.div
                        className="w-2 h-4 bg-current rounded-sm"
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.9, repeat: Infinity }}
                      />
                    </div>
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>

              <p className="text-center text-xs text-slate-400 dark:text-slate-600">
                LLM pipelines typically complete in 30–90 seconds. Cold starts may take up to 3 minutes.
              </p>
            </motion.div>
          )}

          {/* ══ EDITOR ════════════════════════════════════════════════════════ */}
          {step === "editor" && (
            <motion.div
              key="editor"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="w-full min-h-[600px] flex gap-5"
            >
              {/* Left: Raw extracted text */}
              <div className="w-1/2 flex flex-col rounded-2xl border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md overflow-hidden shadow-lg dark:shadow-none">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900 flex justify-between items-center shrink-0">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                    Raw Extracted Content
                  </h3>
                  <span className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md font-medium">
                    {rawText ? "Source text" : "Zero-Retention"}
                  </span>
                </div>
                <div className="p-5 flex-1 overflow-y-auto text-xs font-mono text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words min-h-0">
                  {rawText ? rawText : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-10 gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 text-lg select-none">⚡</div>
                      <p className="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">Zero-Retention Active</p>
                      <p className="text-xs text-slate-400 dark:text-slate-600 opacity-70 max-w-[200px] leading-relaxed">
                        Raw content processed in volatile memory only and not persisted.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Editable schema */}
              <div className="w-1/2 flex flex-col rounded-2xl border border-emerald-500/20 bg-slate-950 overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.05)]">
                <div className="px-5 py-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center shrink-0">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    Verified JSON-LD Schema
                    {schemaEdited && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold uppercase tracking-widest">
                        Edited
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button onClick={handleCopy} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-colors border border-slate-700">
                      {copyLabel}
                    </button>
                    <button onClick={handleDownload} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-colors border border-slate-700 flex items-center gap-1.5">
                      <Download className="w-3 h-3" /> JSON
                    </button>
                    <button onClick={handleReset} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2.5 py-1.5 rounded-lg transition-colors border border-slate-600 flex items-center gap-1.5">
                      <RefreshCw className="w-3 h-3" /> Re-ingest
                    </button>
                    <button
                      onClick={() => dispatchManifestUpdate(organization?.id ?? "", activeManifestVersion)}
                      className="text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded-lg transition-colors border border-emerald-500/20"
                    >
                      Sync ↺
                    </button>
                  </div>
                </div>
                {/* Editable textarea */}
                <div className="flex-1 relative min-h-0">
                  <textarea
                    value={schemaData ?? ""}
                    onChange={(e) => { setSchemaData(e.target.value); setSchemaEdited(true); }}
                    spellCheck={false}
                    className="absolute inset-0 w-full h-full p-5 bg-slate-950 text-blue-300 font-mono text-xs md:text-sm resize-none outline-none focus:ring-1 focus:ring-emerald-500/30 leading-relaxed"
                    placeholder="Schema will appear here after ingestion…"
                  />
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );

  function handleUrlGo() {
    if (urlInput.trim() && !isIngesting && isReady) runIngestion("url", urlInput.trim());
  }
}
