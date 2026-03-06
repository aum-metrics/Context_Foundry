"use client";

import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { motion } from 'framer-motion';
import { ShieldCheck, Server, Key } from 'lucide-react';

export default function SecurityPage() {
    const textMuted = "text-slate-600 dark:text-gray-400";

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 selection:bg-indigo-500/30 font-sans">
            <Navbar />

            <main className="max-w-7xl mx-auto px-6 py-32">
                <div className="mb-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center space-x-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-6"
                    >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Security & Compliance</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-5xl md:text-7xl font-black tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-r from-rose-500 to-indigo-500 dark:from-rose-400 dark:to-indigo-400 uppercase"
                    >
                        Zero Retention. <br /> Zero Exposure.
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className={`text-xl md:text-2xl leading-relaxed max-w-4xl font-light ${textMuted}`}
                    >
                        Enterprise-grade data infrastructure built for the agentic era.
                        AUM ensures your competitive moats remain private while your public identity remains accurate.
                    </motion.p>
                </div>

                <section className="mb-32">
                    <h2 className="text-sm font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-[0.3em] mb-12 text-center">Auditable Data Flow</h2>
                    <div className="p-12 rounded-[3rem] bg-white/60 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 relative overflow-hidden shadow-2xl backdrop-blur-3xl">

                        {/* High-Fidelity Data Flow Diagram */}
                        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 mb-20 py-12 px-8 bg-slate-50 dark:bg-black/40 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-inner">
                            <div className="flex flex-col items-center gap-4 group">
                                <div className="w-20 h-20 rounded-2xl bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-[11px] font-black text-indigo-600 dark:text-indigo-400 text-center px-4 uppercase transition-transform group-hover:scale-110">Source PDF</div>
                                <div className={`text-[10px] font-mono uppercase tracking-widest ${textMuted}`}>Binary Stream</div>
                            </div>
                            <div className="h-0.5 w-12 bg-indigo-500/20 lg:block hidden"></div>
                            <div className="flex flex-col items-center gap-4 group">
                                <div className="w-24 h-24 rounded-[1.5rem] bg-rose-100 dark:bg-rose-500/10 border-2 border-dashed border-rose-500/40 flex items-center justify-center text-[11px] font-black text-rose-600 dark:text-rose-400 text-center px-4 uppercase animate-pulse">Volatile RAM Buffer</div>
                                <div className={`text-[10px] font-mono uppercase tracking-widest ${textMuted}`}>No Disk Storage</div>
                            </div>
                            <div className="h-0.5 w-12 bg-rose-500/20 lg:block hidden"></div>
                            <div className="flex flex-col items-center gap-4 group">
                                <div className="w-20 h-20 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[11px] font-black text-emerald-600 dark:text-emerald-400 text-center px-4 uppercase transition-transform group-hover:scale-110">JSON-LD Extracted</div>
                                <div className={`text-[10px] font-mono uppercase tracking-widest ${textMuted}`}>Factual Logic</div>
                            </div>
                            <div className="h-0.5 w-12 bg-emerald-500/20 lg:block hidden"></div>
                            <div className="flex flex-col items-center gap-4 group">
                                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-500/10 border border-slate-500/30 flex items-center justify-center text-[11px] font-black text-slate-600 dark:text-slate-400 text-center px-4 uppercase transition-transform group-hover:scale-110">Buffer Purged</div>
                                <div className={`text-[10px] font-mono uppercase tracking-widest ${textMuted}`}>GC.Collect()</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16 relative z-10">
                            <div className="flex items-start gap-6 group">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-mono text-lg group-hover:scale-110 transition-transform">01</div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white mb-2">Volatile Ingestion Pipeline</h3>
                                    <p className={`text-sm leading-relaxed font-light ${textMuted}`}>PDFs are read as byte-streams directly into application memory. Raw document content is not written to disk at any point during processing.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-6 group">
                                <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 font-mono text-lg group-hover:scale-110 transition-transform">02</div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white mb-2">Deterministic Memory Disposal</h3>
                                    <p className={`text-sm leading-relaxed font-light ${textMuted}`}>Upon extraction of the structured output, Python's garbage collection is invoked to release the ingestion buffers. This ensures raw content is cleared from memory before the API response is dispatched.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-6 group">
                                <div className="w-12 h-12 rounded-2xl bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 font-mono text-lg group-hover:scale-110 transition-transform">03</div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white mb-2">Cryptographic Metadata Scrubbing</h3>
                                    <p className={`text-sm leading-relaxed font-light ${textMuted}`}>Internal document metadata and tracking IDs are stripped during ingestion, so only the extracted semantic content is retained in the workspace.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-6 group">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-mono text-lg group-hover:scale-110 transition-transform">04</div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white mb-2">Multi-Tenant Subspace Isolation</h3>
                                    <p className={`text-sm leading-relaxed font-light ${textMuted}`}>Each organization's data is stored in separate Firestore document collections, preventing any cross-tenant data access.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-32">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="p-10 rounded-[2.5rem] border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-[#0a0a0a]/50 backdrop-blur-2xl shadow-xl"
                    >
                        <h3 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-3 text-slate-900 dark:text-white">
                            <Server className="w-6 h-6 text-emerald-500" />
                            Audit Logging
                        </h3>
                        <p className={`text-sm leading-relaxed font-light mb-6 ${textMuted}`}>
                            AUM maintains an immutable audit trail for all workspace actions. Every API request, user invitation, and manifest deployment is logged to a write-once ledger for regulatory compliance.
                        </p>
                        <div className="flex items-center space-x-6">
                            <div className="flex flex-col">
                                <span className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Audit Log Type</span>
                                <span className="text-sm font-mono text-emerald-500">Immutable Ledger</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Status</span>
                                <span className="text-sm font-mono text-emerald-500">Continuous Sync</span>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="p-10 rounded-[2.5rem] border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-[#0a0a0a]/50 backdrop-blur-2xl shadow-xl"
                    >
                        <h3 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-3 text-slate-900 dark:text-white">
                            <Key className="w-6 h-6 text-indigo-500" />
                            SHA-256 Key Security
                        </h3>
                        <p className={`text-sm leading-relaxed font-light mb-6 ${textMuted}`}>
                            Authorization tokens are hashed using SHA-256 before storage. API keys can be rotated on-demand from the dashboard to limit exposure windows.
                        </p>
                        <div className="flex items-center space-x-6">
                            <div className="flex flex-col">
                                <span className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Hash Algorithm</span>
                                <span className="text-sm font-mono text-indigo-500">SHA-256 (Salted)</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Rotation</span>
                                <span className="text-sm font-mono text-indigo-500">Manual / API-Driven</span>
                            </div>
                        </div>
                    </motion.div>
                </div>

                <section className="mb-32">
                    <h2 className="text-3xl font-black tracking-tighter mb-12 uppercase text-center">Security Architecture FAQ</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="p-8 rounded-[2rem] border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01] hover:bg-white/60 dark:hover:bg-white/[0.03] transition-all">
                            <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">Where do embeddings live?</h3>
                            <p className={`text-sm leading-relaxed font-light ${textMuted}`}>Representations are stored in multi-tenant isolated Firestore collections within the <code>us-central1</code> region. We do not support cross-cluster replication to maintain strict data sovereignty.</p>
                        </div>
                        <div className="p-8 rounded-[2rem] border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01] hover:bg-white/60 dark:hover:bg-white/[0.03] transition-all">
                            <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">Are logs/traces redacted?</h3>
                            <p className={`text-sm leading-relaxed font-light ${textMuted}`}>Yes. Our pipeline does not include raw document content or API tokens in application logs.</p>
                        </div>
                        <div className="p-8 rounded-[2rem] border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01] hover:bg-white/60 dark:hover:bg-white/[0.03] transition-all">
                            <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">What is the retention period?</h3>
                            <p className={`text-sm leading-relaxed font-light ${textMuted}`}>JSON-LD manifests persist until an organization explicitly issues a Purge command or terminates the workspace. Your brand's machine-readable truth is owned exclusively by you.</p>
                        </div>
                        <div className="p-8 rounded-[2rem] border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01] hover:bg-white/60 dark:hover:bg-white/[0.03] transition-all">
                            <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">Does AUM train on this data?</h3>
                            <p className={`text-sm leading-relaxed font-light ${textMuted}`}>No. AUM does not engage in model training using client-uploaded data. We are an audit and evaluation framework, not a base model provider. We use pre-trained LLMs via API exclusively for adjudication.</p>
                        </div>
                    </div>
                </section>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="bg-gradient-to-br from-rose-500/10 to-indigo-500/10 border border-rose-500/20 p-16 rounded-[3rem] text-center shadow-2xl backdrop-blur-xl relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-indigo-500"></div>
                    <h3 className="text-3xl font-black tracking-tighter mb-6 text-slate-900 dark:text-white uppercase">CISO-Grade Brand Protection</h3>
                    <p className={`mb-10 max-w-2xl mx-auto text-lg font-light leading-relaxed ${textMuted}`}>
                        AUM is committed to the highest standards of data protection. Request our complete security whitepaper for a detailed breakdown of our zero-retention methodology.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-6">
                        <button className="px-10 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-full transition-all font-bold shadow-lg shadow-rose-600/20 uppercase tracking-widest text-xs">Request Architecture Whitepaper</button>
                        <button className="px-10 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-full transition-all font-bold uppercase tracking-widest text-xs">Contact Security Team</button>
                    </div>
                </motion.div>
            </main>

            <Footer />
        </div>
    );
}
