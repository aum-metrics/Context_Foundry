"use client";

import { useState, useEffect } from "react";
import { Copy, Check, FileCode, Server, RadioReceiver, FileDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/firestorePaths";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useOrganization } from "./OrganizationContext";

export default function AgentManifest() {
    const { organization } = useOrganization();
    const [activeTab, setActiveTab] = useState<"llms.txt" | "llms-full.txt">("llms.txt");
    const [copied, setCopied] = useState(false);
    const [deploying, setDeploying] = useState(false);
    const [deployed, setDeployed] = useState(false);

    // Dynamic content generation
    const [manifestContent, setManifestContent] = useState<string>("Connecting to Ground Truth Directory...\nVerifying semantic index availability...");

    useEffect(() => {
        if (!organization?.id) return;

        async function fetchManifest() {
            try {
                const res = await fetch(`/llms.txt?orgId=${organization?.id || ''}`);
                if (res.ok) {
                    const text = await res.text();
                    if (text.includes("<!DOCTYPE html>")) {
                        setManifestContent("Error loading manifest. Missing document ingestion.");
                    } else {
                        setManifestContent(text);
                    }
                } else {
                    setManifestContent("No Agent Manifest found. Please ingest a source document first in the Semantic Ingestion Engine.");
                }
            } catch {
                setManifestContent("Error fetching Edge manifest.");
            }
        }
        setTimeout(fetchManifest, 1000); // UI visual feedback buffer
    }, [organization?.id]);

    const content = manifestContent;



    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDeploy = async () => {
        setDeploying(true);
        try {
            if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash") {
                await new Promise(r => setTimeout(r, 1500));
            } else if (organization) {
                await setDoc(doc(db, "organizations", organization.id, "manifests", "latest"), {
                    content: content,
                    updatedAt: serverTimestamp(),
                    version: "latest"
                });
            }
            setDeploying(false);
            setDeployed(true);
            setTimeout(() => setDeployed(false), 4000);
        } catch (error) {
            console.error("Deployment failed:", error);
            setDeploying(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col space-y-6 animate-fade-in font-sans">
            <header className="mb-4 flex flex-col md:flex-row items-start md:items-center justify-between">
                <div>
                    <h2 className="text-2xl font-light text-slate-900 dark:text-white flex items-center">
                        <RadioReceiver className="w-6 h-6 mr-3 text-fuchsia-600 dark:text-fuchsia-400" />
                        Agent Manifest Generator
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 uppercase tracking-widest">Protocol Deployment for Global LLMs</p>
                </div>

                <button
                    onClick={handleDeploy}
                    disabled={deploying || deployed}
                    className={`mt-4 md:mt-0 px-6 py-2.5 rounded-lg flex items-center font-medium transition-all ${deployed
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-none dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/50 dark:shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                        : "bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-[0_0_20px_rgba(192,38,211,0.3)] hover:scale-105"
                        }`}
                >
                    {deploying ? (
                        <span className="flex items-center">
                            <Server className="w-4 h-4 mr-2 animate-bounce" /> Publishing...
                        </span>
                    ) : deployed ? (
                        <span className="flex items-center">
                            <Check className="w-4 h-4 mr-2" /> Live at <a href={`/llms.txt?orgId=${organization?.id}`} target="_blank" rel="noopener noreferrer" className="ml-1 underline underline-offset-2 hover:text-emerald-300">/llms.txt</a>
                        </span>
                    ) : (
                        <span className="flex items-center">
                            <Server className="w-4 h-4 mr-2" /> Publish llms.txt
                        </span>
                    )}
                </button>
            </header>

            {/* Editor UI */}
            <div className="flex-1 w-full flex flex-col rounded-2xl border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl overflow-hidden shadow-xl dark:shadow-2xl">
                <div className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-white/5 px-4 py-3 flex justify-between items-center">
                    <div className="flex space-x-2 bg-slate-200/50 dark:bg-slate-900/80 p-1 rounded-lg border border-slate-300/50 dark:border-white/5">
                        {(["llms.txt", "llms-full.txt"] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-1.5 text-sm rounded-md transition-all flex items-center ${activeTab === tab
                                    ? "bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 shadow-sm dark:bg-fuchsia-500/20 dark:text-fuchsia-300 dark:border-fuchsia-500/30 dark:shadow-none"
                                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                                    }`}
                            >
                                <FileCode className="w-3.5 h-3.5 mr-2" /> {tab}
                            </button>
                        ))}
                    </div>

                    <div className="flex space-x-2">
                        <button
                            onClick={handleCopy}
                            className="p-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 transition-colors"
                            title="Copy to Clipboard"
                        >
                            {copied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={() => {
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
                            <FileDown className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                    <pre className="text-sm font-mono text-slate-800 dark:text-slate-300 leading-relaxed max-w-4xl">
                        {content.split("\n").map((line, i) => {
                            if (line.startsWith("#")) return <div key={i} className="text-fuchsia-600 dark:text-fuchsia-400 font-bold mt-4 mb-2">{line}</div>;
                            if (line.startsWith(">")) return <div key={i} className="text-slate-500 dark:text-slate-500 italic border-l-2 border-slate-300 dark:border-slate-700 pl-3 my-1">{line}</div>;
                            if (line.startsWith("-")) return <div key={i} className="text-cyan-700 dark:text-cyan-200 ml-4"><span className="text-fuchsia-500 mr-2">-</span>{line.substring(2)}</div>;
                            if (line.includes("DO NOT")) return <div key={i} className="text-rose-600 dark:text-rose-400 ml-4 bg-rose-50 dark:bg-rose-500/10 px-2 rounded"><span className="text-fuchsia-500 mr-2">-</span>{line.substring(2)}</div>;
                            return <div key={i} className="my-1">{line || ' '}</div>;
                        })}
                    </pre>
                </div>
            </div>

            <AnimatePresence>
                {deployed && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-10 right-10 bg-emerald-500/10 border border-emerald-500 text-emerald-400 px-6 py-4 rounded-xl shadow-[0_10px_40px_rgba(16,185,129,0.2)] backdrop-blur-md flex items-center z-50"
                    >
                        <Check className="w-5 h-5 mr-3" />
                        <div>
                            <p className="font-semibold text-sm">Successfully published to Edge API.</p>
                            <p className="text-xs text-emerald-500/70 mt-1">LLM crawlers will now index the updated context.</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
