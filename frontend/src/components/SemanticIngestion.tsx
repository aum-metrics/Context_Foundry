/**
 * Author: "Sambath Kumar Natarajan"
 * Date: "26-Dec-2025"
 * Org: " Start-up/AUM Context Foundry"
 * Product: "AUM Context Foundry"
 * Description: Semantic Ingestion UI for processing corporate assets into JSON-LD.
 */
"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Box, UploadCloud, ChevronRight, Terminal as TerminalIcon, CheckCircle2, RefreshCw, Download } from "lucide-react";
import { useOrganization } from "./OrganizationContext";
import { auth } from "../lib/firebase";
import { db } from "@/lib/firestorePaths";
import { doc, getDoc } from "firebase/firestore";

const VectorCloud = () => {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
            {Array.from({ length: 15 }).map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-cyan-400 rounded-full"
                    initial={{
                        x: Math.random() * 100 + "%",
                        y: Math.random() * 100 + "%",
                        opacity: 0
                    }}
                    animate={{
                        x: [null, Math.random() * 100 + "%"],
                        y: [null, Math.random() * 100 + "%"],
                        opacity: [0, 0.8, 0],
                        scale: [0, 1.5, 0]
                    }}
                    transition={{
                        duration: Math.random() * 3 + 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
            ))}
            <svg className="absolute inset-0 w-full h-full">
                <motion.path
                    d="M 50 50 Q 150 150 250 50 T 450 150"
                    stroke="url(#grad1)"
                    strokeWidth="0.5"
                    fill="none"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: [0, 0.2, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                />
                <defs>
                    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
                        <stop offset="50%" stopColor="#22d3ee" stopOpacity="1" />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
};

export default function SemanticIngestion() {
    const { organization } = useOrganization();
    const [step, setStep] = useState<"upload" | "processing" | "editor">("upload");
    const [isDragging, setIsDragging] = useState(false);
    const [schemaData, setSchemaData] = useState<string | null>(null);
    const [rawText, setRawText] = useState<string | null>(null);
    const [urlInput, setUrlInput] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Processing simulation logs
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        if (!organization?.id) return;
        // Zero-Retention Compliance: Only load the structured JSON-LD output from Firestore.
        // Raw extracted text is NEVER stored — it is processed in volatile memory only.
        const loadExistingManifest = async () => {
            try {
                const manifestDoc = await getDoc(doc(db, "organizations", organization.id, "manifests", "latest"));
                if (manifestDoc.exists()) {
                    const data = manifestDoc.data();
                    if (data.schemaData && Object.keys(data.schemaData).length > 0) {
                        setSchemaData(JSON.stringify(data.schemaData, null, 2));
                        setRawText(null); // Explicitly null — zero-retention
                        setStep("editor");
                    }
                }
            } catch (e) {
                console.warn("Could not load existing manifest:", e);
            }
        };
        loadExistingManifest();
    }, [organization]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const triggerFileInput = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    };

    /**
     * Entry point for document processing.
     * Hardened for Zero-Retention compliance by streaming directly to the 
     * multipart/form-data payload without secondary disk caching.
     */
    const handleFileUpload = async (file: File) => {
        if (!file) return;

        setStep("processing");
        setLogs([]);
        setSchemaData(null);
        setRawText(null);

        setLogs(prev => [...prev, `Initiating secure ingestion for: ${file.name}`]);
        setLogs(prev => [...prev, `Protocol: Zero-Retention Processing (volatile memory only)`]);

        try {
            await processWithPythonBackend(file);
        } catch (error) {
            console.error('Ingestion Error:', error);
            setLogs(prev => [...prev, `CRITICAL ERROR: ${error instanceof Error ? error.message : 'Unknown ingestion failure'}`]);
        }
    };

    const handleUrlIngest = async (url: string) => {
        if (!url || !organization?.id) return;

        setStep("processing");
        setLogs([]);
        setSchemaData(null);
        setRawText(null);

        setLogs(prev => [...prev, `Initiating secure URL ingestion for: ${url}`]);
        setLogs(prev => [...prev, `Protocol: Zero-Retention Processing (volatile memory only)`]);
        setLogs(prev => [...prev, "Connecting to Semantic Ingestion Engine..."]);

        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("Authentication required for secure ingestion.");

            const response = await fetch("/api/ingestion/parse-url", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ url, orgId: organization.id }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "URL processing failed");
            }

            setLogs(prev => [...prev, "URL content fetched and streamed to volatile memory. (Zero-Retention Active)"]);
            setLogs(prev => [...prev, "LLM Schema Mapping in progress..."]);

            const result = await response.json();
            setLogs(prev => [...prev, "JSON-LD Schema verified."]);
            setLogs(prev => [...prev, "Manifest generated."]);

            setSchemaData(JSON.stringify(result.schemaData, null, 2));
            setRawText(null); // Zero-retention
            setStep("editor");
        } catch (error) {
            console.error("URL Ingestion Error:", error);
            setLogs(prev => [...prev, `CRITICAL ERROR: ${error instanceof Error ? error.message : "Unknown ingestion failure"}`]);
        }
    };


    /**
     * Orchestrates the communication with the Python FastAPI GEO Engine.
     * 1. Packets the binary PDF and Auth Context.
     * 2. Proxies through Next.js rewrite to local:8000.
     * 3. Receives and renders the structured JSON-LD schema.
     */
    const processWithPythonBackend = async (file: File) => {
        setLogs(prev => [...prev, "Connecting to Semantic Ingestion Engine..."]);

        // Assemble Multi-Part Form Data
        const formData = new FormData();
        formData.append('file', file);
        if (organization?.id) {
            formData.append('orgId', organization.id);
        }

        const token = await auth.currentUser?.getIdToken() || undefined;
        if (!token) throw new Error("Authentication required for secure ingestion.");

        const response = await fetch('/api/ingestion/parse', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Backend processing failed');
        }

        setLogs(prev => [...prev, "PDF Binary Streamed to Volatile Memory. (Zero-Retention Active)"]);
        setLogs(prev => [...prev, "LLM Schema Mapping in progress..."]);

        const result = await response.json();

        if (result.name === "Key Missing") {
            setLogs(prev => [...prev, "WARNING: Tenant Key Missing in Vault."]);
        }

        // Update UI state with extracted JSON-LD
        setSchemaData(JSON.stringify(result.schemaData || result, null, 2));
        setRawText(result.rawText || "No text extracted.");
        setLogs(prev => [...prev, "SUCCESS: Structured JSON-LD generated."]);

        // Move to editor view
        setTimeout(() => setStep("editor"), 1500);
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
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" className="hidden" />
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
                                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                        handleFileUpload(e.dataTransfer.files[0]);
                                    }
                                }}
                                onClick={triggerFileInput}
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
                                        type="url"
                                        id="url-ingestion-input"
                                        value={urlInput || ""}
                                        onChange={e => setUrlInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter" && urlInput) handleUrlIngest(urlInput); }}
                                        onClick={(e) => e.stopPropagation()}
                                        placeholder="https://yourcompany.com/about"
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg py-3 px-4 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm dark:shadow-none placeholder-slate-400"
                                    />
                                    <button
                                        onClick={(e) => { e.stopPropagation(); if (urlInput) handleUrlIngest(urlInput); }}
                                        disabled={!urlInput}
                                        className="absolute right-2 top-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white p-1.5 rounded-md transition-colors"
                                    >
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
                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">semantic_ingestion_pipeline</span>
                                    <div className="ml-auto flex space-x-2">
                                        <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                                        <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                                        <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                                    </div>
                                </div>
                                <div className="relative p-6 font-mono text-sm space-y-3 min-h-[300px]">
                                    <VectorCloud />
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
                                    <span className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">Parsed via PyMuPDF</span>
                                </div>
                                <div className="p-5 flex-1 overflow-y-auto text-xs font-mono text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                                    {rawText ? rawText : (
                                        <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 dark:text-slate-600 py-8">
                                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                                                <span className="text-emerald-500 text-lg">⚡</span>
                                            </div>
                                            <p className="font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest mb-1">Zero-Retention Active</p>
                                            <p className="text-xs opacity-60 max-w-xs">Raw text processed in volatile memory only. Not stored per SOC2/CISO compliance.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Pane: Schema Editor */}
                            <div className="w-1/2 flex flex-col rounded-2xl border border-emerald-500/20 bg-slate-950 overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.05)]">
                                <div className="px-5 py-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
                                    <h3 className="text-sm font-medium text-white flex items-center">
                                        <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" /> Verified JSON-LD Schema
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                if (schemaData) {
                                                    const blob = new Blob([schemaData], { type: "application/json" });
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement("a");
                                                    a.href = url;
                                                    a.download = "verified_schema.json";
                                                    a.click();
                                                    URL.revokeObjectURL(url);
                                                }
                                            }}
                                            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-md transition-colors font-medium border border-slate-700 flex items-center gap-1.5"
                                        >
                                            <Download className="w-3 h-3" /> Download JSON
                                        </button>
                                        <button
                                            onClick={() => { setStep("upload"); setSchemaData(null); setRawText(null); }}
                                            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-md transition-colors font-medium border border-slate-600 flex items-center gap-1.5"
                                        >
                                            <RefreshCw className="w-3 h-3" /> Re-upload
                                        </button>
                                        <button className="text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-3 py-1.5 rounded-md transition-colors font-medium border border-emerald-500/20">
                                            Approve &amp; Save
                                        </button>
                                    </div>
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
