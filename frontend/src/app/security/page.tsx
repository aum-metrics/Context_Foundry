"use client";

import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

export default function SecurityPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200">
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
                    <h2 className="text-2xl font-bold mb-8 text-blue-400">Auditable Data Flow</h2>
                    <div className="p-8 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden mb-10">
                        {/* CSS Data Flow Diagram Wrapper */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-12 py-8 px-4 bg-black/40 rounded-xl border border-white/5">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-400 text-center px-2 uppercase">Source PDF</div>
                                <div className="text-[10px] text-gray-500 font-mono">Input Stream</div>
                            </div>
                            <div className="h-0.5 w-8 bg-blue-500/20 md:block hidden animate-pulse"></div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 border-2 border-dashed border-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-400 text-center px-2 uppercase animate-pulse">Volatile RAM Buffer</div>
                                <div className="text-[10px] text-gray-500 font-mono">Zero Disk</div>
                            </div>
                            <div className="h-0.5 w-8 bg-indigo-500/20 md:block hidden animate-pulse"></div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold text-emerald-400 text-center px-2 uppercase">JSON-LD Extracted</div>
                                <div className="text-[10px] text-gray-500 font-mono">Factual Logic</div>
                            </div>
                            <div className="h-0.5 w-8 bg-emerald-500/20 md:block hidden animate-pulse"></div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-[10px] font-bold text-rose-400 text-center px-2 uppercase">Buffer Purged</div>
                                <div className="text-[10px] text-gray-500 font-mono">GC.Collect()</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 font-mono text-sm">01</div>
                                <div>
                                    <h3 className="font-bold">Volatile Ingestion</h3>
                                    <p className="text-sm text-gray-400">PDFs are read as a byte-stream directly into volatile RAM. We bypass the OS temp filesystem entirely.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 font-mono text-sm">02</div>
                                <div>
                                    <h3 className="font-bold">Immediate Memory Flush</h3>
                                    <p className="text-sm text-gray-400">Upon extraction of semantic JSON-LD, an explicit garbage collection (GC) trigger purges the RAM buffer.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 font-mono text-sm">03</div>
                                <div>
                                    <h3 className="font-bold">PII Scrubbing</h3>
                                    <p className="text-sm text-gray-400">Metadata is scrubbed of corporate signatures and PII before JSON-LD manifestation storage.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 font-mono text-sm">04</div>
                                <div>
                                    <h3 className="font-bold">Per-Tenant Isolation</h3>
                                    <p className="text-sm text-gray-400">All data assets are physically separated at the Firestore collection level with unique SHA-256 access keys.</p>
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
