"use client";

import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { usePersona } from '@/components/PersonaContext';

export default function SecurityPage() {
    const { persona } = usePersona();
    const textMuted = "text-slate-600 dark:text-gray-400";

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200">
            <Navbar />

            <main className="max-w-4xl mx-auto px-6 py-24">
                <div className="mb-16">
                    <h1 className="text-5xl font-bold mb-6 text-slate-900 dark:text-white">Security & Data Privacy</h1>
                    <p className={`text-xl ${textMuted}`}>
                        {persona === 'CTO' ? "Enterprise-grade data infrastructure built for the agentic era." : "Your marketing data belongs to you. Not the AI engines."}
                        <br />
                        <span className="font-semibold mt-2 block">Zero retention. Zero exposure. Zero trust.</span>
                    </p>
                </div>

                <section className="mb-20">
                    <h2 className="text-2xl font-bold mb-8 text-blue-600 dark:text-blue-400">Auditable Data Flow</h2>
                    <div className="p-8 rounded-2xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 relative overflow-hidden mb-10 shadow-xl dark:shadow-none">
                        {/* CSS Data Flow Diagram Wrapper */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-12 py-8 px-4 bg-slate-100 dark:bg-black/40 rounded-xl border border-slate-200 dark:border-white/5 shadow-inner dark:shadow-none">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400 text-center px-2 uppercase">{persona === 'CTO' ? "Source PDF" : "Uploaded Materials"}</div>
                                <div className={`text-[10px] font-mono ${textMuted}`}>Input Stream</div>
                            </div>
                            <div className="h-0.5 w-8 bg-blue-500/20 md:block hidden animate-pulse"></div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-20 h-20 rounded-2xl bg-indigo-100 dark:bg-indigo-500/10 border-2 border-dashed border-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 text-center px-2 uppercase animate-pulse">{persona === 'CTO' ? "Volatile RAM Buffer" : "Secure Memory Processing"}</div>
                                <div className={`text-[10px] font-mono ${textMuted}`}>Zero Disk Storage</div>
                            </div>
                            <div className="h-0.5 w-8 bg-indigo-500/20 md:block hidden animate-pulse"></div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 text-center px-2 uppercase">{persona === 'CTO' ? "JSON-LD Extracted" : "Truth Verified"}</div>
                                <div className={`text-[10px] font-mono ${textMuted}`}>{persona === 'CTO' ? "Factual Logic" : "Brand Defense"}</div>
                            </div>
                            <div className="h-0.5 w-8 bg-emerald-500/20 md:block hidden animate-pulse"></div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-[10px] font-bold text-rose-600 dark:text-rose-400 text-center px-2 uppercase">{persona === 'CTO' ? "Buffer Purged" : "Files Destroyed"}</div>
                                <div className={`text-[10px] font-mono ${textMuted}`}>{persona === 'CTO' ? "GC.Collect()" : "Safeguarded."}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-mono text-sm">01</div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">{persona === 'CTO' ? "Volatile Ingestion" : "Protected Uploads"}</h3>
                                    <p className={`text-sm ${textMuted}`}>{persona === 'CTO' ? "PDFs are read as a byte-stream directly into volatile RAM. We bypass the OS temp filesystem entirely." : "When you upload battlecards or product sheets, they are processed in active memory, not saved permanently to a hard drive."}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-mono text-sm">02</div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">{persona === 'CTO' ? "Immediate Memory Flush" : "Automatic Destruction"}</h3>
                                    <p className={`text-sm ${textMuted}`}>{persona === 'CTO' ? "Upon extraction of semantic JSON-LD, an explicit garbage collection (GC) trigger purges the RAM buffer." : "As soon as we extract the facts we need to audit the AIs, your original marketing files are permanently destroyed."}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-mono text-sm">03</div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">PII Scrubbing</h3>
                                    <p className={`text-sm ${textMuted}`}>Metadata is scrubbed of corporate signatures and PII before {persona === 'CTO' ? "JSON-LD manifestation storage" : "we build your compliance footprint"}.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-mono text-sm">04</div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">{persona === 'CTO' ? "Per-Tenant Isolation" : "Strict Silos"}</h3>
                                    <p className={`text-sm ${textMuted}`}>{persona === 'CTO' ? "All data assets are physically separated at the Firestore collection level with unique SHA-256 access keys." : "Your data is completely segregated from other brands. Your verified facts are never used to train competitors."}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
                    <div className="p-6 rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 shadow-sm dark:shadow-none">
                        <h3 className="font-bold mb-3 flex items-center gap-2 text-slate-900 dark:text-white">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            SOC2 Compliance
                        </h3>
                        <p className={`text-sm ${textMuted}`}>All administrative actions, API key generations, and configuration changes are logged to an immutable audit trail for SOC2 Type II compliance.</p>
                    </div>
                    <div className="p-6 rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 shadow-sm dark:shadow-none">
                        <h3 className="font-bold mb-3 flex items-center gap-2 text-slate-900 dark:text-white">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            {persona === 'CTO' ? "SHA-256 API Security" : "Bank-Grade Encryption"}
                        </h3>
                        <p className={`text-sm ${textMuted}`}>{persona === 'CTO' ? "API keys are never stored in plain text. We use high-entropy SHA-256 hashing for verification, ensuring your keys stay private even in the database." : "When you integrate AUM into your marketing stacks, authentication credentials are mathematically disguised. No one on our team can read them."}</p>
                    </div>
                </div>

                <section className="mb-20">
                    <h2 className="text-2xl font-bold mb-8 text-blue-600 dark:text-blue-400">{persona === 'CTO' ? "Security FAQ" : "Common Compliance Questions"}</h2>
                    <div className="space-y-6">
                        <div className="p-6 rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 shadow-sm dark:shadow-none">
                            <h3 className="font-bold mb-2 text-slate-900 dark:text-white">{persona === 'CTO' ? "Where do embeddings live?" : "Are my competitors training on my vectors?"}</h3>
                            <p className={`text-sm ${textMuted}`}>{persona === 'CTO' ? "Representations are stored in multi-tenant isolated Firestore collections. No raw embeddings from proprietary documents are shared across organizations." : "Never. Your corporate knowledge graph is walled off structurally. We do not aggregate data to train 'master models'."}</p>
                        </div>
                        <div className="p-6 rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 shadow-sm dark:shadow-none">
                            <h3 className="font-bold mb-2 text-slate-900 dark:text-white">Are logs/traces redacted?</h3>
                            <p className={`text-sm ${textMuted}`}>Yes. Our Zero-Retention pipeline automatically scrubs PII and proprietary tokens from application logs and tracing telemetry.</p>
                        </div>
                        <div className="p-6 rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 shadow-sm dark:shadow-none">
                            <h3 className="font-bold mb-2 text-slate-900 dark:text-white">{persona === 'CTO' ? "What is the retention of JSON-LD artifacts?" : "Can I completely wipe my account?"}</h3>
                            <p className={`text-sm ${textMuted}`}>{persona === 'CTO' ? "JSON-LD manifestations are owned by the organization and persist until explicitly deleted or a workspace is terminated. You own your brand's machine-readable truth." : "Yes. If your agency switches platforms, one click permanently purges all associated analytics, scores, and brand facts. You own the facts."}</p>
                        </div>
                    </div>
                </section>

                <div className="bg-gradient-to-br from-indigo-50 dark:from-blue-500/10 to-purple-50 dark:to-purple-500/10 border border-indigo-200 dark:border-blue-500/20 p-8 rounded-2xl text-center shadow-lg dark:shadow-none">
                    <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Enterprise Data Security</h3>
                    <p className={`mb-6 ${textMuted}`}>AUM is committed to the highest standards of data protection. We ensure that your competitive moats remain private while your public identity remains accurate.</p>
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
