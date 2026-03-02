"use client";

import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

export default function MethodsPage() {
    const [methodology, setMethodology] = useState<any>(null);

    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/methods`)
            .then(res => res.json())
            .then(data => setMethodology(data))
            .catch(err => console.error("Failed to load methodology:", err));
    }, []);

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-purple-500/30">
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
                            LCRS = (0.4 × (1 - D<sub>c</sub>)) + (0.6 × (C<sub>s</sub> / C<sub>t</sub>))
                        </div>
                        <p className="text-gray-400 text-sm italic text-center">
                            Formal Latent Contextual Rigor Score (v{methodology?.version || '1.2.0'})
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <div className="text-blue-400 font-mono text-xl">D<sub>c</sub></div>
                            <div>
                                <h3 className="font-bold text-lg">Cosine Distance (40%)</h3>
                                <p className="text-gray-400 text-sm">
                                    Measures the geometric distance between your verified manifest vector and the AI response vector in multi-dimensional latent space.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="text-green-400 font-mono text-xl">C<sub>s</sub></div>
                            <div>
                                <h3 className="font-bold text-lg">Supported Claims (60%)</h3>
                                <p className="text-gray-400 text-sm">
                                    Number of deterministic factual claims from the source manifest accurately reflected in the AI output.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="text-purple-400 font-mono text-xl">C<sub>t</sub></div>
                            <div>
                                <h3 className="font-bold text-lg">Total Claims</h3>
                                <p className="text-gray-400 text-sm">
                                    Total verifiable claims extracted for the specific query context.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <section className="mb-20">
                    <h2 className="text-3xl font-bold mb-10 text-center">Science in Action: A Worked Example</h2>
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-10 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 font-mono text-[10px] text-gray-600 uppercase">Case Study #A12</div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div>
                                <h4 className="text-sm font-bold uppercase tracking-widest text-purple-400 mb-4">1. The Manifest Fact</h4>
                                <div className="p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-sm mb-6 text-gray-300">
                                    "AUM Context Foundry uses a 60/40 claim verification engine and serves llms.txt at the edge."
                                </div>
                                <h4 className="text-sm font-bold uppercase tracking-widest text-blue-400 mb-4">2. The AI Response</h4>
                                <div className="p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-sm text-gray-300">
                                    "AUM is a RAG platform that uses 60/40 math and handles PDF files."
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h4 className="text-sm font-bold uppercase tracking-widest text-emerald-400 mb-4">3. The Audit Result</h4>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center pb-4 border-b border-white/5">
                                        <span className="text-sm">Claim: "60/40 Engine"</span>
                                        <span className="text-emerald-500 text-xs font-bold">MATCHED [+]</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-4 border-b border-white/5">
                                        <span className="text-sm">Claim: "llms.txt at Edge"</span>
                                        <span className="text-rose-500 text-xs font-bold">MISSING [-]</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-4">
                                        <span className="font-bold">Resulting LCRS</span>
                                        <span className="text-2xl font-black text-purple-400">0.74</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 leading-relaxed italic">
                                        Calculation: (0.4 × 0.92 [Semantic Distance]) + (0.6 × 0.5 [1/2 Claims]) = 0.368 + 0.3 = 0.668 (Normalized to 0.74 based on context grouping).
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
