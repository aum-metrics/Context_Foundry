"use client";

import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { usePersona } from '@/components/PersonaContext';

export default function MethodsPage() {
    const { persona } = usePersona();
    const [methodology, setMethodology] = useState<any>(null);

    useEffect(() => {
        fetch('/api/methods')
            .then(res => res.json())
            .then(data => setMethodology(data))
            .catch(err => console.error("Failed to load methodology:", err));
    }, []);

    // Helper text color to fix light mode
    const textMuted = "text-slate-600 dark:text-gray-400";

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 selection:bg-purple-500/30">
            <Navbar />

            <main className="max-w-5xl mx-auto px-6 py-24">
                <div className="mb-16">
                    <h1 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500 dark:from-purple-400 dark:to-blue-400">
                        {persona === 'CTO' ? "The Science of Contextual Rigor" : "Measurable Brand Health"}
                    </h1>
                    <p className={`text-xl leading-relaxed max-w-3xl ${textMuted}`}>
                        {persona === 'CTO' ? (
                            <>
                                AUM Context Foundry replaces "proprietary magic" with auditable science.
                                We evaluate AI outputs using a blend of geometric distance and deterministic claim verification.
                            </>
                        ) : (
                            <>
                                We replace "AI guesswork" with auditable facts. AUM evaluates how AI search engines talk about your brand using strict verification checks against your own approved marketing materials.
                            </>
                        )}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
                    <div className="p-8 rounded-2xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-xl shadow-xl dark:shadow-none">
                        <h2 className="text-2xl font-bold mb-6 flex items-center text-slate-900 dark:text-white">
                            <span className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center mr-3 text-sm font-mono">01</span>
                            {persona === 'CTO' ? "The LCRS Formula" : "The Brand Fidelity Score"}
                        </h2>
                        {persona === 'CTO' ? (
                            <>
                                <div className="bg-slate-100 dark:bg-black/50 p-6 rounded-xl border border-slate-200 dark:border-white/5 font-mono text-xl mb-6 text-center text-purple-700 dark:text-purple-300">
                                    LCRS = (0.4 × S<sub>acc</sub>) + (0.6 × C<sub>acc</sub>)
                                </div>
                                <p className={`text-sm italic text-center mb-6 pl-4 pr-4 ${textMuted}`}>
                                    Formal Latent Contextual Rigor Score (v{methodology?.version || '1.2.0'})
                                </p>
                                <div className="grid grid-cols-2 gap-4 text-xs font-mono text-slate-500">
                                    <div className="p-3 rounded-lg bg-white dark:bg-black/30 border border-slate-200 dark:border-white/5 leading-relaxed shadow-sm dark:shadow-none">
                                        <span className="text-blue-500 dark:text-blue-400 block mb-1">S_acc (40%)</span>
                                        1.0 - Cosine Distance (1536-dim)
                                    </div>
                                    <div className="p-3 rounded-lg bg-white dark:bg-black/30 border border-slate-200 dark:border-white/5 leading-relaxed shadow-sm dark:shadow-none">
                                        <span className="text-emerald-500 dark:text-green-400 block mb-1">C_acc (60%)</span>
                                        Supported Claims / Total Extracted
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <p className={textMuted}>Your Brand Fidelity Score is calculated by blending two distinct checks:</p>
                                <ul className="space-y-3">
                                    <li className="flex items-start bg-slate-50 dark:bg-black/30 p-4 rounded-xl border border-slate-200 dark:border-white/5">
                                        <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 mr-3 shrink-0"></div>
                                        <div>
                                            <strong className="block text-slate-800 dark:text-slate-200 text-sm">Semantic Alignment (40%)</strong>
                                            <span className={`text-xs ${textMuted}`}>Does the AI capture your brand's overall "vibe" and messaging tone accurately?</span>
                                        </div>
                                    </li>
                                    <li className="flex items-start bg-slate-50 dark:bg-black/30 p-4 rounded-xl border border-slate-200 dark:border-white/5">
                                        <div className="w-2 h-2 mt-1.5 rounded-full bg-emerald-500 mr-3 shrink-0"></div>
                                        <div>
                                            <strong className="block text-slate-800 dark:text-slate-200 text-sm">Factual Accuracy (60%)</strong>
                                            <span className={`text-xs ${textMuted}`}>Did the AI cite your features properly without hallucinating competitor details?</span>
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <div className="p-6 rounded-xl border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-white/[0.02] shadow-sm dark:shadow-none">
                            <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-slate-900 dark:text-white">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                {persona === 'CTO' ? "Multi-Model Adjudication" : "Independent Verification"}
                            </h3>
                            <p className={`text-sm ${textMuted}`}>
                                {persona === 'CTO' ?
                                    "We don't just 'guess.' LCRS uses a consensus model where GPT-4o acts as the primary auditor for claim verification, while your manifest serves as the absolute Ground Truth."
                                    : "We use a leading AI engine to verify the outputs of the other engines. Your approved marketing documents serve as the undisputed source of truth during every audit."
                                }
                            </p>
                        </div>
                        <div className="p-6 rounded-xl border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-white/[0.02] shadow-sm dark:shadow-none">
                            <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-slate-900 dark:text-white">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                {persona === 'CTO' ? "Zero-Temperature Inference" : "Consistent Testing"}
                            </h3>
                            <p className={`text-sm ${textMuted}`}>
                                {persona === 'CTO' ?
                                    "All simulation probes are run at temp=0.0 and top_p=1.0 to ensure maximum reproducibility and factual stability during evaluation."
                                    : "We force the generative engines into a 'deterministic' mode during audits. This guarantees that your weekly reports track genuine changes in brand visibility, not random AI fluctuations."
                                }
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
                    <div className="border-t border-slate-200 dark:border-white/10 pt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                            <h4 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">Zero-Retention Policy</h4>
                            <p className={`text-sm leading-relaxed ${textMuted}`}>
                                {persona === 'CTO' ? "Vectors are stored in multi-tenant isolated Firestore. Raw PDF memory buffers are flushed immediately after extraction." : "We analyze your confidential marketing materials in a secure vault, extract the facts we need, and instantly delete the original files."}
                            </p>
                        </div>
                        <div>
                            <h4 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">Inference Logging</h4>
                            <p className={`text-sm leading-relaxed ${textMuted}`}>
                                {persona === 'CTO' ? "Every score includes a footprint of the exact Model ID and hyperparameters (temperature, top_p) used during evaluation." : "Every audit score comes with an irrefutable receipt proving exactly which AI answered the question and when."}
                            </p>
                        </div>
                        <div>
                            <h4 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">Standards Compliance</h4>
                            <p className={`text-sm leading-relaxed ${textMuted}`}>
                                {persona === 'CTO' ? "LCRS is designed to align with ISO/IEC 42001 and the NIST AI Risk Management Framework (RMF)." : "Our verification methods are designed to align with emerging global standards for AI safety and corporate risk management."}
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
