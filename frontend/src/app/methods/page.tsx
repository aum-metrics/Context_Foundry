"use client";

import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { motion } from 'framer-motion';
import { Binary, Cpu, ShieldCheck, Zap, Activity, Terminal } from 'lucide-react';

export default function MethodsPage() {
    const [methodology, setMethodology] = useState<{ version: string, standards: string[], lastAudited: string } | null>(null);

    useEffect(() => {
        // Mocking or fetching actual scientific methodology metadata
        setMethodology({
            version: "1.2.0",
            standards: [],
            lastAudited: "2025-12-20"
        });
    }, []);

    // Helper text color to fix light mode
    const textMuted = "text-slate-600 dark:text-slate-400";

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 selection:bg-indigo-500/30 font-sans">
            <Navbar />

            <main className="max-w-7xl mx-auto px-6 py-32">
                <div className="mb-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center space-x-2 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-6"
                    >
                        <Binary className="w-3.5 h-3.5" />
                        <span>Technical Deep Dive</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-5xl md:text-7xl font-black tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-cyan-500 dark:from-indigo-400 dark:to-cyan-400 uppercase"
                    >
                        The Science of <br /> Contextual Rigor.
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className={`text-xl md:text-2xl leading-relaxed max-w-4xl font-light ${textMuted}`}
                    >
                        AUM Context Foundry replaces "proprietary magic" with auditable science.
                        We run enterprise buyer queries deterministically across AI models and measure how often your firm is shortlisted over competitors — your Share of Model (SoM).
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-32">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="p-10 rounded-[2.5rem] bg-white/60 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 backdrop-blur-2xl shadow-2xl dark:shadow-none"
                    >
                        <h2 className="text-2xl font-bold mb-8 flex items-center text-slate-900 dark:text-white">
                            <span className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mr-4 text-sm font-mono">01</span>
                            The SoM Formula
                        </h2>

                        <div className="bg-slate-900/90 dark:bg-black/40 p-10 rounded-[2rem] border border-slate-200 dark:border-white/5 font-mono text-2xl mb-8 text-center text-indigo-400 dark:text-indigo-300 shadow-inner">
                            SoM = visible<sub>assertions</sub> ÷ total<sub>assertions</sub>
                        </div>

                        <p className={`text-sm italic text-center mb-10 ${textMuted}`}>
                            Share of Model Score (v{methodology?.version || '1.2.0'})
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-6 rounded-[1.5rem] bg-white dark:bg-black/30 border border-slate-200 dark:border-white/5 leading-relaxed shadow-sm">
                                <span className="text-indigo-500 dark:text-indigo-400 font-bold block mb-2 text-xs uppercase tracking-widest">Semantic Alignment</span>
                                <p className="text-sm font-light leading-relaxed">Cosine distance across 1536-dim embeddings of the buyer query response vs. verified manifest — measures how close AI output is to your positioning.</p>
                            </div>
                            <div className="p-6 rounded-[1.5rem] bg-white dark:bg-black/30 border border-slate-200 dark:border-white/5 leading-relaxed shadow-sm">
                                <span className="text-cyan-500 dark:text-cyan-400 font-bold block mb-2 text-xs uppercase tracking-widest">Assertion Presence</span>
                                <p className="text-sm font-light leading-relaxed">Fraction of your positioning assertions that appear as "visible", "partial", or "absent" when an enterprise buyer asks an AI the equivalent of your RFP shortlist question.</p>
                            </div>
                        </div>
                    </motion.div>

                    <div className="flex flex-col justify-center space-y-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="p-8 rounded-[2rem] border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01] hover:bg-white/60 dark:hover:bg-white/[0.03] transition-all"
                        >
                            <h3 className="font-bold text-lg mb-3 flex items-center gap-3 text-slate-900 dark:text-white">
                                <Cpu className="w-5 h-5 text-indigo-500" />
                                Multi-Model Adjudication
                            </h3>
                            <p className={`text-sm leading-relaxed font-light ${textMuted}`}>
                                Every buyer query runs across GPT-4o, Gemini 3 Flash, and Claude 4.5 Sonnet simultaneously. The adjudication layer determines which model provides the most useful evidence for enterprise buyer shortlisting and identifies which competitor is most likely to be ranked above you on that query.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="p-8 rounded-[2rem] border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01] hover:bg-white/60 dark:hover:bg-white/[0.03] transition-all"
                        >
                            <h3 className="font-bold text-lg mb-3 flex items-center gap-3 text-slate-900 dark:text-white">
                                <Zap className="w-5 h-5 text-cyan-500" />
                                Zero-Temperature Inference
                            </h3>
                            <p className={`text-sm leading-relaxed font-light ${textMuted}`}>
                                All simulation probes are programmatically run at <code>temp=0.0</code> and <code>top_p=1.0</code> to eliminate stochastic noise and ensure maximum reproducibility across audit cycles.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="p-8 rounded-[2rem] border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01] hover:bg-white/60 dark:hover:bg-white/[0.03] transition-all"
                        >
                            <h3 className="font-bold text-lg mb-3 flex items-center gap-3 text-slate-900 dark:text-white">
                                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                Isolated Vector Tenancy
                            </h3>
                            <p className={`text-sm leading-relaxed font-light ${textMuted}`}>
                                Each enterprise workspace operates on a physically distinct vector subspace. We use cryptographic salt hashing on metadata to prevent cross-tenant inference leaks.
                            </p>
                        </motion.div>
                    </div>
                </div>

                {/* The worked example - Premium UI */}
                <section className="mb-32">
                    <h2 className="text-3xl font-black tracking-tighter mb-12 text-center uppercase">worked audit: Case #A102</h2>
                    <div className="rounded-[3rem] border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/40 overflow-hidden relative shadow-2xl backdrop-blur-xl">
                        <div className="absolute top-0 right-10 p-4 font-mono text-[10px] text-slate-400 uppercase tracking-widest bg-slate-100/50 dark:bg-white/5 rounded-b-xl border border-t-0 border-slate-200 dark:border-white/5">Audit Registry v2.4</div>

                        <div className="p-12 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></div>
                                Ground Truth (AUM Manifest)
                            </h4>
                            <p className="text-2xl font-light text-slate-900 dark:text-slate-200">
                                "AUM Context Foundry provides a <strong className="font-medium text-emerald-600 dark:text-emerald-400 underline decoration-emerald-500/30 underline-offset-4">zero-retention</strong> pipeline for enterprise brand data."
                            </p>
                        </div>

                        <div className="p-12 grid grid-cols-1 lg:grid-cols-2 gap-16 bg-white/40 dark:bg-black/20">
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-6 flex items-center gap-2">
                                    <Terminal className="w-4 h-4" />
                                    Model Response (Simulation)
                                </h4>
                                <div className="p-8 rounded-2xl bg-indigo-500/[0.03] border border-indigo-500/10 font-mono text-sm mb-6 text-slate-600 dark:text-indigo-300/80 leading-relaxed italic shadow-inner">
                                    "AUM is a marketing tool that <strong className="text-rose-500 dark:text-rose-400 line-through">stores</strong> brand files and helps with SEO monitoring."
                                </div>
                                <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                                    <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-white/5">Engine: Anthropic Claude (configured frontier model)</span>
                                    <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-white/5">Temp: 0.0</span>
                                </div>
                            </div>

                            <div className="space-y-8">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-rose-500 mb-6 flex items-center gap-2">
                                    <Activity className="w-4 h-4" />
                                    The Audit Matrix
                                </h4>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center py-3 border-b border-slate-200 dark:border-white/5">
                                        <span className="text-sm font-light">Assertion: "Enterprise transformation depth"</span>
                                        <span className="text-rose-500 text-[10px] font-bold px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 uppercase tracking-widest">ABSENT</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3 border-b border-slate-200 dark:border-white/5">
                                        <span className="text-sm font-light text-slate-500">Semantic Alignment</span>
                                        <span className="font-mono text-sm text-indigo-500">0.68</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3 border-b border-slate-200 dark:border-white/5">
                                        <span className="text-sm font-light text-slate-500">Assertion Presence</span>
                                        <span className="font-mono text-sm text-rose-500">0.00</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-6">
                                        <span className="font-black text-xl uppercase tracking-tighter">Final SoM Score</span>
                                        <div className="flex items-baseline space-x-1">
                                            <span className="text-5xl font-black text-rose-500 tracking-tighter">18%</span>
                                            <span className="text-xs font-bold text-rose-500/50 uppercase">Displaced</span>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 mt-6">
                                        <p className="text-[10px] text-slate-500 leading-relaxed font-mono">
                                            RESULT: COMPETITIVE DISPLACEMENT DETECTED. <br />
                                            Accenture ranked first on 2/3 models for this buyer query.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 border-t border-slate-200 dark:border-white/10 pt-20">
                    <div>
                        <h4 className="font-black text-lg mb-4 text-slate-900 dark:text-white uppercase tracking-tight">Zero-Retention Buffer</h4>
                        <p className={`text-sm leading-relaxed font-light ${textMuted}`}>
                            Vectors are stored in multi-tenant isolated Firestore. Raw binary PDF memory buffers are flushed via explicit <code>GC.Collect()</code> calls immediately after distillation.
                        </p>
                    </div>
                    <div>
                        <h4 className="font-black text-lg mb-4 text-slate-900 dark:text-white uppercase tracking-tight">SoM Run Logging</h4>
                        <p className={`text-sm leading-relaxed font-light ${textMuted}`}>
                            Every SoM run includes a unique audit-footprint of the exact Model ID, buyer query, and assertion verdicts used — for reproducibility and compliance documentation.
                        </p>
                    </div>
                    <div>
                        <h4 className="font-black text-lg mb-4 text-slate-900 dark:text-white uppercase tracking-tight">ISO Compliance</h4>
                        <p className={`text-sm leading-relaxed font-light ${textMuted}`}>
                            The Context Foundry framework is designed with enterprise compliance requirements in mind. We maintain audit trails and zero-retention processing to support regulatory needs.
                        </p>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
