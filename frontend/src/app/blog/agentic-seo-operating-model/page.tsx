/**
 * The Agentic SEO Operating Model
 * Deep dive into machine-readable positioning for Acquisition Readiness.
 */
"use client";
import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import { Code, Share2, Layers, Cpu } from 'lucide-react';
import Link from 'next/link';

export default function AgenticSEOPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 selection:bg-indigo-500/30 font-sans">
            <Navbar />
            <main className="pt-32 pb-24">
                <article className="max-w-4xl mx-auto px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-12"
                    >
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-600 dark:text-cyan-400 mb-4">Technical Strategy</p>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white mb-8 leading-[0.9]">
                            The Agentic SEO <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-indigo-500">Operating Model</span>
                        </h1>
                        <div className="flex items-center gap-4 text-sm text-slate-500 mb-12">
                            <span>15 Min Read</span>
                            <span>•</span>
                            <span>Engineering Deep Dive</span>
                        </div>
                        
                        <div className="aspect-video rounded-[3rem] bg-gradient-to-br from-cyan-500/10 to-transparent border border-slate-200 dark:border-white/5 mb-16 flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20"></div>
                            <Code className="w-24 h-24 text-cyan-500/30" />
                        </div>
                    </motion.div>

                    <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-lg font-light leading-relaxed">
                        <p>
                            Traditional SEO was built for the <em>Browser</em>. Agentic SEO is built for the <em>Crawler</em>. This transition represents a fundamental shift from human-readability to machine-interpretability.
                        </p>

                        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white pt-8">Beyond PageRank</h2>
                        <p>
                            In the agentic era, a crawler visits your site, extracts a subset of information, and maps it into a vector space. If your content is wrapped in ambiguous marketing speak, the "semantic density" is too low for a model to make a high-confidence recommendation.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12">
                            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5">
                                <Share2 className="w-6 h-6 text-cyan-500 mb-4" />
                                <h4 className="font-bold mb-2">Manifest Ingestion</h4>
                                <p className="text-sm text-slate-500 mb-0">Directly exposing structured manifests to LLM scrapers via llms.txt protocol.</p>
                            </div>
                            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5">
                                <Layers className="w-6 h-6 text-indigo-500 mb-4" />
                                <h4 className="font-bold mb-2">Assertion Mapping</h4>
                                <p className="text-sm text-slate-500 mb-0">Deconstructing brand claims into verifiable logical units for model adjudication.</p>
                            </div>
                            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5">
                                <Cpu className="w-6 h-6 text-emerald-500 mb-4" />
                                <h4 className="font-bold mb-2">Audit Cycles</h4>
                                <p className="text-sm text-slate-500 mb-0">Closing the loop via deterministic simulation to verify "Recall Fidelity".</p>
                            </div>
                        </div>

                        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white pt-8">Deterministic Fidelity</h2>
                        <p>
                            To achieve "Recall Fidelity," enterprises must implement an Operating Model that treats Brand Context as code. Every change to your core product pillars should trigger an automated "Market Audit" to identify if AI shortlists are still citing the correct facts.
                        </p>
                        
                        <p>
                            The Agentic SEO Operating Model (ASOM) is the framework we use at AUM Context Foundry to ensure that when an AI speaks for your brand, it says exactly what you intended — no more, no less.
                        </p>
                    </div>

                    <div className="mt-24 pt-16 border-t border-slate-200 dark:border-white/10 text-center">
                        <p className="text-slate-500 mb-8 italic">Interested in implementing ASOM for your enterprise?</p>
                        <Link href="/methods" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                            Read about our Methodology →
                        </Link>
                    </div>
                </article>
            </main>
            <Footer />
        </div>
    );
}
