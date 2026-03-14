"use client";

import { useEffect, useState } from "react";
import { Database, RadioReceiver, ArrowRight, CircleCheckBig } from "lucide-react";
import SemanticIngestion from "./SemanticIngestion";
import AgentManifest from "./AgentManifest";

type ContextStudioTab = "ingestion" | "manifest";

export default function ContextStudio({
  initialTab = "ingestion",
  onReturnToInsights,
}: {
  initialTab?: ContextStudioTab;
  onReturnToInsights?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ContextStudioTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const steps = [
    {
      label: "1. Ingest source material",
      detail: "Upload a source asset or URL to regenerate verified company context.",
      complete: activeTab === "manifest",
    },
    {
      label: "2. Review AI manifest",
      detail: "Check llms.txt and llms-full.txt before running market-facing simulations.",
      complete: activeTab === "manifest",
    },
    {
      label: "3. Return to command center",
      detail: "Use the updated context in competitor ranking, GEO, and executive reports.",
      complete: false,
    },
  ];

  return (
    <div className="w-full h-full space-y-6 animate-fade-in font-sans">
      <header className="rounded-3xl border border-slate-200 dark:border-white/5 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-6 shadow-xl dark:shadow-none">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-3xl font-light text-slate-900 dark:text-white tracking-tight">Context Studio</h1>
            <p className="text-sm text-slate-500 mt-2 max-w-3xl">
              Keep ingestion and manifest review in one place. This is the preparation layer before you run competitor-ranked prompts and export the executive report.
            </p>
          </div>
          {onReturnToInsights && (
            <button
              onClick={onReturnToInsights}
              className="inline-flex items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-500/20 dark:text-indigo-300"
            >
              Return to Command Center
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.label}
              className="rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/40 p-4"
            >
              <div className="flex items-center gap-2">
                <CircleCheckBig className={`h-4 w-4 ${step.complete ? "text-emerald-500" : "text-slate-300 dark:text-slate-600"}`} />
                <p className="text-sm font-medium text-slate-900 dark:text-white">{step.label}</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{step.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 inline-flex rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-100/80 p-1 dark:bg-slate-950/60">
          <button
            onClick={() => setActiveTab("ingestion")}
            className={`inline-flex items-center rounded-xl px-4 py-2 text-sm transition-all ${
              activeTab === "ingestion"
                ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Database className="mr-2 h-4 w-4" />
            Semantic Ingestion
          </button>
          <button
            onClick={() => setActiveTab("manifest")}
            className={`inline-flex items-center rounded-xl px-4 py-2 text-sm transition-all ${
              activeTab === "manifest"
                ? "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-500/20"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <RadioReceiver className="mr-2 h-4 w-4" />
            Agent Manifest
          </button>
        </div>
      </header>

      {activeTab === "ingestion" ? <SemanticIngestion /> : <AgentManifest />}
    </div>
  );
}
