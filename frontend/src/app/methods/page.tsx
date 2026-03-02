"use client";

import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

export default function MethodsPage() {
    const [methodology, setMethodology] = useState<any>(null);

    useEffect(() => {
        fetch('/api/methods')
            .then(res => res.json())
            .then(data => setMethodology(data))
            .catch(err => console.error("Failed to load methodology:", err));
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 selection:bg-purple-500/30">
            <Navbar />

            <main className="max-w-5xl mx-auto px-6 py-24">
                <div className="mb-16">
                    <h1 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
                        The Science of Contextual Rigor
                    </h1>
                    <p className="text-xl text-gray-400 leading-relaxed max-w-3xl">
                        AUM Context Foundry replaces "proprietary magic" with auditable science.
                        We evaluate AI outputs using a blend of geometric distance and deterministic claim verification.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
                    <div className="p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
                        <h2 className="text-2xl font-bold mb-6 flex items-center">
                            <span className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mr-3 text-sm font-mono">01</span>
                            The LCRS Formula
                        </h2>
                        <div className="bg-black/50 p-6 rounded-xl border border-white/5 font-mono text-xl mb-6 text-center text-purple-300">
                            LCRS = (0.4 × S<sub>acc</sub>) + (0.6 × C<sub>acc</sub>)
                        </div>
                        <p className="text-gray-400 text-sm italic text-center mb-6">
                            Formal Latent Contextual Rigor Score (v{methodology?.version || '1.2.0'})
                        </p>
                        <div className="grid grid-cols-2 gap-4 text-xs font-mono text-gray-500">
                            <div className="p-3 rounded-lg bg-black/30 border border-white/5 leading-relaxed">
                                <span className="text-blue-400 block mb-1">S_acc (40%)</span>
                                1.0 - Cosine Distance (1536-dim)
                            </div>
                            <div className="p-3 rounded-lg bg-black/30 border border-white/5 leading-relaxed">
                                <span className="text-green-400 block mb-1">C_acc (60%)</span>
                                Supported Claims / Total Extracted
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02]">
                            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                Multi-Model Adjudication
                            </h3>
                            <p className="text-gray-400 text-sm">
                                We don't just "guess." LCRS uses a consensus model where GPT-4o acts as the primary auditor for claim verification, while your manifest serves as the absolute Ground Truth.
                            </p>
                        </div>
                        <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02]">
                            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                Zero-Temperature Inference
                            </h3>
                            <p className="text-gray-400 text-sm">
                                All simulation probes are run at <code>temp=0.0</code> and <code>top_p=1.0</code> to ensure maximum reproducibility and factual stability during evaluation.
                            </p>
                        </div>
                    </div>
                </div>

                <section className="mb-20">
                    <h2 className="text-3xl font-bold mb-10 text-center">Science in Action: A Worked Example</h2>
                    <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 font-mono text-[10px] text-gray-600 uppercase tracking-widest bg-white/5 rounded-bl-xl border-l border-b border-white/5">Audit Case #A102</div>

                        <div className="p-8 border-b border-white/5 bg-white/[0.01]">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Ground Truth (Your Manifest)</h4>
                            <p className="text-lg font-medium text-slate-200">"AUM Context Foundry provides a <strong>zero-retention</strong> pipeline for enterprise brand data."</p>
                        </div>

                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12 bg-black/20">
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                    Model Response (Simulation)
                                </h4>
                                <div className="p-5 rounded-xl bg-slate-900 border border-white/5 font-mono text-sm mb-6 text-gray-400 leading-relaxed italic">
                                    "AUM is a data tool that <strong>stores</strong> brand files and helps with SEO monitoring."
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-rose-400 mb-4 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>
                                    The Audit Matrix
                                </h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                                        <span className="text-sm">Claim: "Zero-Retention"</span>
                                        <span className="text-rose-500 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10">CONTRADICTED [-]</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                                        <span className="text-sm text-gray-400">Distance Score (S_acc)</span>
                                        <span className="font-mono text-xs">0.68</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                                        <span className="text-sm text-gray-400">Claim Accuracy (C_acc)</span>
                                        <span className="font-mono text-xs">0.00</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-4">
                                        <span className="font-bold text-lg">Final LCRS Score</span>
                                        <span className="text-3xl font-black text-rose-500">0.27</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 leading-relaxed mt-4 italic border-t border-white/5 pt-4">
                                        Calculation: (0.4 × 0.68 [Distance]) + (0.6 × 0.00 [Claims]) = 0.272. Result: **Critical Narrative Drift.**
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="border-t border-white/10 pt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                        <h4 className="font-bold text-lg mb-4">Zero-Retention Policy</h4>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Vectors are stored in multi-tenant isolated Firestore. Raw PDF memory buffers are flushed immediately after extraction.
                        </p>
                    </div>
                    <div>
                        <h4 className="font-bold text-lg mb-4">Inference Logging</h4>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Every score includes a footprint of the exact Model ID and hyperparameters (temperature, top_p) used during evaluation.
                        </p>
                    </div>
                    <div>
                        <h4 className="font-bold text-lg mb-4">Standards Compliance</h4>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            LCRS is designed to align with ISO/IEC 42001 and the NIST AI Risk Management Framework (RMF).
                        </p>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
