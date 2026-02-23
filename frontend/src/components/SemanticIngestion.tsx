"use client";

import { useState } from "react";
import { UploadCloud, FileText, CheckCircle2, ChevronRight, Terminal as TerminalIcon, Box } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function SemanticIngestion() {
    const [step, setStep] = useState<"upload" | "processing" | "editor">("upload");
    const [isDragging, setIsDragging] = useState(false);
    const [schemaData, setSchemaData] = useState<string | null>(null);

    // Processing simulation logs
    const [logs, setLogs] = useState<string[]>([]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const simulateExtraction = async () => {
        setStep("processing");
        const stages = [
            "[SYS] Initializing Adversarial Logic Extraction...",
            "[DATA] Parsing unstructured PDF data...",
            "[AI] Fetching via /api/ingest...",
            "[VERIFY] Cross-referencing claims against active product DB...",
            "[SCHEMA] Generating SEO-optimized JSON-LD Schema (Organization, Product)..."
        ];
        let currentLog = 0;
        const interval = setInterval(() => {
            if (currentLog < stages.length) {
                setLogs((prev) => [...prev, stages[currentLog]]);
                currentLog++;
            }
        }, 800);

        try {
            const res = await fetch("/api/ingest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ unstructuredData: "Acme Enterprise CRM is a comprehensive suite designed to optimize sales workflows. Pricing starts at $99/user/month for the professional tier." })
            });
            const data = await res.json();

            clearInterval(interval);
            setLogs((prev) => [...prev, "[SUCCESS] Extraction complete. Ready for Schema Editor."]);

            if (data.schema) {
                setSchemaData(JSON.stringify(data.schema, null, 2));
            } else {
                setSchemaData(JSON.stringify({ error: data.error || "Failed API" }, null, 2));
            }

            setTimeout(() => setStep("editor"), 1500);
        } catch (err) {
            clearInterval(interval);
            setLogs((prev) => [...prev, "[ERROR] Extraction failed."]);
        }
    };

    return (
        <div className="w-full h-full flex flex-col space-y-6 animate-fade-in font-sans">
            <header className="mb-4">
                <h2 className="text-2xl font-light text-slate-900 dark:text-white flex items-center">
                    <Box className="w-6 h-6 mr-3 text-cyan-600 dark:text-cyan-400" />
                    Semantic Ingestion Engine
                </h2>
                <p className="text-sm text-slate-500 mt-1 uppercase tracking-widest">Unstructured Data → Verified Agent Context</p>
            </header>

            <div className="flex-1 w-full flex flex-col items-center justify-center">
                <AnimatePresence mode="wait">
                    {step === "upload" && (
                        <motion.div
                            key="upload"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-2xl"
                        >
                            <div
                                className={`relative group rounded-3xl border-2 border-dashed transition-all duration-300 ${isDragging
                                    ? "border-cyan-500 bg-cyan-50 dark:border-cyan-400 dark:bg-cyan-400/10"
                                    : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-500 dark:hover:bg-slate-800/50"
                                    } backdrop-blur-xl p-16 flex flex-col items-center justify-center cursor-pointer shadow-sm dark:shadow-none`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragging(false);
                                    simulateExtraction();
                                }}
                                onClick={simulateExtraction}
                            >
                                <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform shadow-sm dark:shadow-none">
                                    <UploadCloud className={`w-10 h-10 ${isDragging ? "text-cyan-500 dark:text-cyan-400" : "text-slate-400 group-hover:text-cyan-500 dark:group-hover:text-cyan-400"}`} />
                                </div>
                                <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-2">Drag & Drop Corporate Assets</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-center mb-8 max-w-md">
                                    Upload raw marketing PDFs, documentation, or enter URLs to translate them into machine-readable JSON-LD.
                                </p>

                                <div className="flex items-center space-x-4 w-full max-w-md">
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest">OR</span>
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                                </div>

                                <div className="mt-8 w-full max-w-md relative">
                                    <input
                                        type="text"
                                        placeholder="https://acme.com/products/enterprise-crm"
                                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-cyan-500 dark:focus:border-cyan-500/50 rounded-lg py-3 px-4 text-sm text-slate-900 dark:text-slate-200 outline-none transition-colors shadow-sm dark:shadow-none"
                                    />
                                    <button className="absolute right-2 top-2 bg-slate-100 dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-500/20 text-slate-500 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 p-1.5 rounded-md transition-colors">
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === "processing" && (
                        <motion.div
                            key="processing"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="w-full max-w-4xl"
                        >
                            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/20 bg-white dark:bg-slate-950 overflow-hidden shadow-xl dark:shadow-[0_0_40px_rgba(99,102,241,0.1)]">
                                <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center">
                                    <TerminalIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mr-2" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">adversarial_extraction.sh</span>
                                    <div className="ml-auto flex space-x-2">
                                        <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                                        <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                                        <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                                    </div>
                                </div>
                                <div className="p-6 font-mono text-sm space-y-3 min-h-[300px]">
                                    {logs.map((log, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className={`flex ${log.includes("SUCCESS") ? "text-emerald-600 dark:text-emerald-400" : log.includes("SYS") || log.includes("DATA") ? "text-slate-600 dark:text-slate-300" : "text-indigo-600 dark:text-indigo-400"}`}
                                        >
                                            <span className="mr-3 text-slate-400 dark:text-slate-600">❯</span> {log}
                                        </motion.div>
                                    ))}
                                    <div className="flex animate-pulse">
                                        <span className="mr-3 text-slate-400 dark:text-slate-600">❯</span> <div className="w-2.5 h-4 bg-slate-400 dark:bg-white/50 inline-block"></div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === "editor" && (
                        <motion.div
                            key="editor"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="w-full h-full min-h-[600px] flex gap-6"
                        >
                            {/* Left Pane: Extracted Text */}
                            <div className="w-1/2 flex flex-col rounded-2xl border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md overflow-hidden shadow-xl dark:shadow-none">
                                <div className="px-5 py-4 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                                    <h3 className="text-sm font-medium text-slate-900 dark:text-white flex items-center">
                                        <FileText className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400" /> Raw Extracted Text
                                    </h3>
                                    <span className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">1,042 words</span>
                                </div>
                                <div className="p-5 flex-1 overflow-y-auto text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-serif">
                                    <p className="mb-4">
                                        The Acme Enterprise CRM is a comprehensive suite designed to optimize sales workflows. Unlike previous versions, the V5 rollout integrates perfectly with LLM ecosystems...
                                    </p>
                                    <p className="mb-4 bg-rose-500/10 border-l-2 border-rose-500 pl-3">
                                        <span className="text-rose-400 block text-xs font-sans uppercase mb-1">Adversarial Flag: Marketing Fluff Detected</span>
                                        "It is simply the best product on the market and guarantees 100% ROI in the first day."
                                    </p>
                                    <p>
                                        Pricing starts at $99/user/month for the professional tier, and offers real-time pipeline forecasting via our proprietary ML models.
                                    </p>
                                </div>
                            </div>

                            {/* Right Pane: Schema Editor */}
                            <div className="w-1/2 flex flex-col rounded-2xl border border-emerald-500/20 bg-slate-950 overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.05)]">
                                <div className="px-5 py-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
                                    <h3 className="text-sm font-medium text-white flex items-center">
                                        <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" /> Verified JSON-LD Schema
                                    </h3>
                                    <button className="text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-3 py-1.5 rounded-md transition-colors font-medium border border-emerald-500/20">
                                        Approve & Deploy
                                    </button>
                                </div>
                                <div className="p-5 flex-1 overflow-y-auto font-mono text-xs md:text-sm bg-slate-950 text-slate-300">
                                    <pre className="text-blue-300">
                                        {schemaData || "Loading..."}
                                    </pre>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
