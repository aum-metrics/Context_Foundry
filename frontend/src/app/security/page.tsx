"use client";

import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

export default function SecurityPage() {
    return (
        <div className="min-h-screen bg-[#050505] text-white">
            <Navbar />

            <main className="max-w-4xl mx-auto px-6 py-24">
                <div className="mb-16">
                    <h1 className="text-5xl font-bold mb-6">Security & Data Privacy</h1>
                    <p className="text-xl text-gray-400">
                        Enterprise-grade data infrastructure built for the agentic era.
                        Zero retention. Zero exposure. Zero trust.
                    </p>
                </div>

                <section className="mb-20">
                    <h2 className="text-2xl font-bold mb-8 text-blue-400">The Data Lifecycle</h2>
                    <div className="p-8 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full"></div>
                        <div className="space-y-8 relative z-10">
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 font-mono">1</div>
                                <div>
                                    <h3 className="font-bold">Volatile Ingestion</h3>
                                    <p className="text-sm text-gray-400">PDF/Docs are loaded into volatile RAM. No binary data is ever written to persistent disk storage.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 font-mono">2</div>
                                <div>
                                    <h3 className="font-bold">Semantic Extraction</h3>
                                    <p className="text-sm text-gray-400">Markdown text is extracted and converted into multi-dimensional vectors using organization-specific keys.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 font-mono">3</div>
                                <div>
                                    <h3 className="font-bold">Immediate Flush</h3>
                                    <p className="text-sm text-gray-400">Memory buffers containing raw source data are purged immediately after the vector transformation is complete.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 font-mono">4</div>
                                <div>
                                    <h3 className="font-bold">Isolated Storage</h3>
                                    <p className="text-sm text-gray-400">Vectors are stored in multi-tenant isolated Firestore collections, encrypted at rest with organization-level isolation.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
                    <div className="p-6 rounded-xl border border-white/10 bg-white/5">
                        <h3 className="font-bold mb-3 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            SOC2 Compliance
                        </h3>
                        <p className="text-sm text-gray-400">All administrative actions, API key generations, and configuration changes are logged to an immutable audit trail for SOC2 Type II compliance.</p>
                    </div>
                    <div className="p-6 rounded-xl border border-white/10 bg-white/5">
                        <h3 className="font-bold mb-3 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            SHA-256 API Security
                        </h3>
                        <p className="text-sm text-gray-400">API keys are never stored in plain text. We use high-entropy SHA-256 hashing for verification, ensuring your keys stay private even in the database.</p>
                    </div>
                </div>

                <section className="mb-20">
                    <h2 className="text-2xl font-bold mb-8 text-blue-400">Security FAQ</h2>
                    <div className="space-y-6">
                        <div className="p-6 rounded-xl border border-white/10 bg-white/5">
                            <h3 className="font-bold mb-2">Where do embeddings live?</h3>
                            <p className="text-sm text-gray-400">Representations are stored in multi-tenant isolated Firestore collections. No raw embeddings from proprietary documents are shared across organizations.</p>
                        </div>
                        <div className="p-6 rounded-xl border border-white/10 bg-white/5">
                            <h3 className="font-bold mb-2">Are logs/traces redacted?</h3>
                            <p className="text-sm text-gray-400">Yes. Our Zero-Retention pipeline automatically scrubs PII and proprietary tokens from application logs and tracing telemetry.</p>
                        </div>
                        <div className="p-6 rounded-xl border border-white/10 bg-white/5">
                            <h3 className="font-bold mb-2">What is the retention of JSON-LD artifacts?</h3>
                            <p className="text-sm text-gray-400">JSON-LD manifestations are owned by the organization and persist until explicitly deleted or a workspace is terminated. You own your brand's machine-readable truth.</p>
                        </div>
                    </div>
                </section>

                <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 p-8 rounded-2xl text-center">
                    <h3 className="text-xl font-bold mb-4">Enterprise Data Security</h3>
                    <p className="text-gray-400 mb-6">AUM is committed to the highest standards of data protection. We ensure that your competitive moats remain private while your public identity remains accurate.</p>
                    <div className="flex justify-center gap-4">
                        <button className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg transition-all font-bold">Request Whitepaper</button>
                        <button className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all font-bold">SOC2 Report</button>
                    </div>
                </div>

            </main>

            <Footer />
        </div>
    );
}
