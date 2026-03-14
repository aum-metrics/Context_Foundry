"use client";

import { useState, useEffect } from "react";
import { Copy, Check, FileCode, RadioReceiver, FileDown, Lock } from "lucide-react";
import { useOrganization } from "./OrganizationContext";
import { UpgradeModal } from "./UpgradeModal";

export default function AgentManifest() {
    const { organization, refreshKey, activeManifestVersion } = useOrganization();
    const [activeTab, setActiveTab] = useState<"llms.txt" | "llms-full.txt">("llms.txt");
    const [copied, setCopied] = useState(false);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [manifestContent, setManifestContent] = useState<Record<"llms.txt" | "llms-full.txt", string>>({
        "llms.txt": "Connecting to Ground Truth Directory...\nVerifying semantic index availability...",
        "llms-full.txt": "Connecting to Ground Truth Directory...\nVerifying semantic index availability...",
    });

    useEffect(() => {
        const orgId = organization?.id;
        if (!orgId) return;

        async function fetchManifest(kind: "llms.txt" | "llms-full.txt") {
            try {
                const endpoint = kind === "llms-full.txt" ? "manifest-full" : "manifest";
                const res = await fetch(`/api/workspaces/${orgId}/${endpoint}?version=${encodeURIComponent(activeManifestVersion)}`);
                if (res.ok) {
                    const text = await res.text();
                    const nextValue = text.includes("<!DOCTYPE html>")
                        ? "Error loading manifest. Missing document ingestion."
                        : text;
                    setManifestContent(prev => ({ ...prev, [kind]: nextValue }));
                } else {
                    setManifestContent(prev => ({
                        ...prev,
                        [kind]: "No Agent Manifest found. Please ingest a source document first in the Semantic Ingestion Engine."
                    }));
                }
            } catch {
                setManifestContent(prev => ({ ...prev, [kind]: "Error fetching Edge manifest." }));
            }
        }

        fetchManifest("llms.txt");
        fetchManifest("llms-full.txt");
    }, [organization?.id, refreshKey, activeManifestVersion]);

    const content = manifestContent[activeTab];
    const isExplorer = organization?.subscriptionTier === "explorer";



    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadTxt = () => {
        if (isExplorer) {
            setIsUpgradeModalOpen(true);
            return;
        }
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = activeTab;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="w-full h-auto flex flex-col space-y-6 animate-fade-in font-sans">
            <header className="mb-4 flex flex-col md:flex-row items-start md:items-center justify-between">
                <div>
                    <h2 className="text-2xl font-light text-slate-900 dark:text-white flex items-center">
                        <RadioReceiver className="w-6 h-6 mr-3 text-fuchsia-600 dark:text-fuchsia-400" />
                        Agent Manifest Generator
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 uppercase tracking-widest">Protocol Deployment for Global LLMs</p>
                </div>

                <button
                    onClick={handleDownloadTxt}
                    className={`mt-4 md:mt-0 px-6 py-2.5 rounded-lg flex items-center font-medium transition-all ${
                        isExplorer
                            ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                            : "bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-[0_0_20px_rgba(192,38,211,0.3)] hover:scale-105"
                    }`}
                >
                    {isExplorer ? <Lock className="w-4 h-4 mr-2" /> : <FileDown className="w-4 h-4 mr-2" />}
                    {isExplorer ? "Unlock Manifest Download" : `Download ${activeTab}`}
                </button>
            </header>

            {/* Editor UI */}
            <div className="w-full min-h-[500px] flex flex-col rounded-2xl border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl overflow-hidden shadow-xl dark:shadow-2xl">
                <div className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-white/5 px-4 py-3 flex justify-between items-center">
                    <div className="flex space-x-2 bg-slate-200/50 dark:bg-slate-900/80 p-1 rounded-lg border border-slate-300/50 dark:border-white/5">
                        {(["llms.txt", "llms-full.txt"] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => {
                                    if (isExplorer && tab === "llms-full.txt") {
                                        setIsUpgradeModalOpen(true);
                                        return;
                                    }
                                    setActiveTab(tab);
                                }}
                                className={`px-4 py-1.5 text-sm rounded-md transition-all flex items-center ${activeTab === tab
                                    ? "bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 shadow-sm dark:bg-fuchsia-500/20 dark:text-fuchsia-300 dark:border-fuchsia-500/30 dark:shadow-none"
                                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                                    }`}
                            >
                                {isExplorer && tab === "llms-full.txt" ? <Lock className="w-3.5 h-3.5 mr-2" /> : <FileCode className="w-3.5 h-3.5 mr-2" />} {tab}
                            </button>
                        ))}
                    </div>

                    <div className="flex space-x-2">
                        <button
                            onClick={handleCopy}
                            disabled={isExplorer}
                            className="p-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 transition-colors"
                            title="Copy to Clipboard"
                        >
                            {copied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={() => {
                                if (isExplorer) {
                                    setIsUpgradeModalOpen(true);
                                    return;
                                }
                                const blob = new Blob([content], { type: 'text/markdown' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = activeTab;
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                            className="p-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 transition-colors"
                            title="Export to Markdown"
                        >
                            {isExplorer ? <Lock className="w-4 h-4" /> : <FileDown className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <div className="flex-1 relative bg-transparent overflow-hidden">
                    <pre className="p-6 overflow-auto text-sm font-mono text-slate-800 dark:text-slate-300 leading-relaxed max-h-[600px]">
                        {content.split("\n").map((line, i) => {
                            if (line.startsWith("#")) return <div key={i} className="text-fuchsia-600 dark:text-fuchsia-400 font-bold mt-4 mb-2">{line}</div>;
                            if (line.startsWith(">")) return <div key={i} className="text-slate-500 dark:text-slate-500 italic border-l-2 border-slate-300 dark:border-slate-700 pl-3 my-1">{line}</div>;
                            if (line.startsWith("-")) return <div key={i} className="text-cyan-700 dark:text-cyan-200 ml-4"><span className="text-fuchsia-500 mr-2">-</span>{line.substring(2)}</div>;
                            if (line.includes("DO NOT")) return <div key={i} className="text-rose-600 dark:text-rose-400 ml-4 bg-rose-50 dark:bg-rose-500/10 px-2 rounded"><span className="text-fuchsia-500 mr-2">-</span>{line.substring(2)}</div>;
                            return <div key={i} className="my-1 whitespace-pre">{line || ' '}</div>;
                        })}
                    </pre>
                </div>
            </div>
            <UpgradeModal
                isOpen={isUpgradeModalOpen}
                onClose={() => setIsUpgradeModalOpen(false)}
                featureHighlight="llms Manifest Export + Full Protocol View"
            />

        </div>
    );
}
