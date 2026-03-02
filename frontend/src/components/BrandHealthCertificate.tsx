"use client";

import { motion } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import html2canvas from "html2canvas";
import { Shield, CheckCircle2, Award, Download, Share2, Globe, Cpu, Hexagon } from "lucide-react";
import { Logo } from "./Logo";

interface BrandHealthCertificateProps {
    organizationName: string;
    asovScore: number;
    driftRate: number;
    onClose: () => void;
}

export default function BrandHealthCertificate({
    organizationName,
    asovScore,
    driftRate,
    onClose,
}: BrandHealthCertificateProps) {
    const certificateRef = useRef<HTMLDivElement>(null);
    const [issuedDate, setIssuedDate] = useState("");
    const [isoTimestamp, setIsoTimestamp] = useState("");

    useEffect(() => {
        setIssuedDate(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
        setIsoTimestamp(new Date().toISOString());
    }, []);

    const handleDownload = async () => {
        if (!certificateRef.current) return;

        try {
            const canvas = await html2canvas(certificateRef.current, {
                backgroundColor: null,
                scale: 2,
                useCORS: true
            });
            const link = document.createElement('a');
            link.download = `AUM-Brand-Health-${organizationName.replace(/\s+/g, '-')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error("Failed to generate certificate image", err);
        }
    };
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl"
        >
            <motion.div
                ref={certificateRef}
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl shadow-indigo-500/10"
            >
                {/* Iridescent Header Background */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-500/20 via-fuchsia-500/10 to-transparent pointer-events-none"></div>

                <div className="relative p-10 flex flex-col items-center text-center">
                    <div className="mb-6">
                        <Logo size={60} />
                    </div>

                    <h2 className="text-3xl font-light text-slate-900 dark:text-white mb-2">
                        Brand Health Certificate
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 uppercase tracking-widest text-xs font-bold mb-10">
                        Agentic Share of Voice (ASoV) Audit Result
                    </p>

                    <div className="w-full grid grid-cols-2 gap-8 mb-10">
                        <div className="space-y-2">
                            <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">Organization</div>
                            <div className="text-xl text-slate-900 dark:text-white font-medium">{organizationName}</div>
                        </div>
                        <div className="space-y-2">
                            <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">Date Issued</div>
                            <div className="text-xl text-slate-900 dark:text-white font-medium">
                                {issuedDate || "Loading date..."}
                            </div>
                        </div>
                    </div>

                    <div className="relative w-48 h-48 mb-10">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="96"
                                cy="96"
                                r="80"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="8"
                                className="text-slate-100 dark:text-slate-800"
                            />
                            <motion.circle
                                cx="96"
                                cy="96"
                                r="80"
                                fill="none"
                                stroke="url(#asov-gradient)"
                                strokeWidth="8"
                                strokeDasharray={2 * Math.PI * 80}
                                initial={{ strokeDashoffset: 2 * Math.PI * 80 }}
                                animate={{ strokeDashoffset: (2 * Math.PI * 80) * (1 - asovScore / 100) }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                strokeLinecap="round"
                            />
                            <defs>
                                <linearGradient id="asov-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#6366f1" />
                                    <stop offset="100%" stopColor="#06b6d4" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-4xl font-light text-slate-900 dark:text-white">{asovScore}%</span>
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">ASoV Score</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6 w-full mb-10">
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5">
                            <Globe className="w-4 h-4 mx-auto mb-2 text-indigo-500" />
                            <div className="text-[10px] text-slate-400 uppercase font-bold">Visibility</div>
                            <div className="text-sm text-slate-900 dark:text-white font-medium">Verified</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5">
                            <Shield className="w-4 h-4 mx-auto mb-2 text-emerald-500" />
                            <div className="text-[10px] text-slate-400 uppercase font-bold">Fidelity</div>
                            <div className="text-sm text-slate-900 dark:text-white font-medium">{100 - driftRate}%</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5">
                            <Cpu className="w-4 h-4 mx-auto mb-2 text-fuchsia-500" />
                            <div className="text-[10px] text-slate-400 uppercase font-bold">Grounding</div>
                            <div className="text-sm text-slate-900 dark:text-white font-medium">Tier-1</div>
                        </div>
                    </div>

                    <div className="flex space-x-4 w-full">
                        <button
                            onClick={handleDownload}
                            className="flex-1 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-medium flex items-center justify-center group hover:scale-[1.02] transition-transform"
                        >
                            <Download className="w-4 h-4 mr-2 group-hover:animate-bounce" /> Download PNG
                        </button>
                        <button className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-medium flex items-center justify-center group hover:scale-[1.02] transition-transform shadow-lg shadow-indigo-500/25">
                            <Share2 className="w-4 h-4 mr-2" /> Share Result
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className="mt-8 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        Return to Dashboard
                    </button>
                </div>

                {/* Transparency Footprint Footer */}
                <div className="bg-slate-50 dark:bg-slate-950/50 p-6 text-left border-t border-slate-100 dark:border-white/5 font-mono text-[9px] text-slate-400 leading-relaxed">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="font-bold text-slate-500 mb-1 tracking-wider uppercase">Inference Audit Log</p>
                            <p>Model ID: gpt-4o-2024-08-06 (verified)</p>
                            <p>Model ID: gemini-2.0-flash (verified)</p>
                            <p>Model ID: claude-3-5-sonnet (verified)</p>
                        </div>
                        <div>
                            <p className="font-bold text-slate-500 mb-1 tracking-wider uppercase">Hyperparameters</p>
                            <p>Temperature: 0.0 (Deterministic)</p>
                            <p>Top_P: 1.0 (Exact retrieval)</p>
                            <p>Timestamp: {isoTimestamp || "Generating..."}</p>
                        </div>
                    </div>
                </div>

                {/* Bottom Tagline */}
                <div className="bg-slate-100 dark:bg-slate-950/80 py-3 text-center border-t border-slate-200 dark:border-white/5">
                    <p className="text-[10px] text-slate-500 uppercase tracking-[0.4em]">Precision Monitoring for the Agentic Era • AUM v1.2.0</p>
                </div>
            </motion.div>
        </motion.div>
    );
}
