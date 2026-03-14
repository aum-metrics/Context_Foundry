"use client";

import { useState } from "react";
import { Database, RadioReceiver } from "lucide-react";
import SemanticIngestion from "./SemanticIngestion";
import AgentManifest from "./AgentManifest";

// ContextStudio is now a lightweight tab-switcher only.
// Page-level headers and workflow narrative are provided by the parent (page.tsx).
type ContextStudioTab = "ingestion" | "manifest";

export default function ContextStudio({
  initialTab = "ingestion",
}: {
  initialTab?: ContextStudioTab;
  onReturnToInsights?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ContextStudioTab>(initialTab);

  return (
    <div className="w-full space-y-6 animate-fade-in font-sans">
      {/* Tab bar */}
      <div className="inline-flex rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100/80 dark:bg-slate-950/60 p-1">
        <button
          onClick={() => setActiveTab("ingestion")}
          className={`inline-flex items-center rounded-lg px-4 py-2 text-sm transition-all ${
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
          className={`inline-flex items-center rounded-lg px-4 py-2 text-sm transition-all ${
            activeTab === "manifest"
              ? "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-500/20"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <RadioReceiver className="mr-2 h-4 w-4" />
          Agent Manifest
        </button>
      </div>

      {activeTab === "ingestion" ? <SemanticIngestion /> : <AgentManifest />}
    </div>
  );
}
