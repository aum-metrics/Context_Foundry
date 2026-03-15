/**
 * CMO's Guide to AI Search (GEO)
 * High-fidelity cornerstone content for Acquisition Readiness.
 */
"use client";
import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import { TrendingUp, Award } from 'lucide-react';
import Link from 'next/link';

export default function CMOGuidePage() {
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
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400 mb-4">Executive Insights</p>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white mb-8 leading-[0.9]">
                            The CMO&apos;s Guide to <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">AI Search Visibility</span>
                        </h1>
                        <div className="flex items-center gap-4 text-sm text-slate-500 mb-12">
                            <span>12 Min Read</span>
                            <span>•</span>
                            <span>Strategic Report</span>
                        </div>
                        
                        <div className="aspect-video rounded-[3rem] bg-gradient-to-br from-indigo-500/10 to-transparent border border-slate-200 dark:border-white/5 mb-16 flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20"></div>
                            <Award className="w-24 h-24 text-indigo-500/30" />
                        </div>
                    </motion.div>

                    <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-lg font-light leading-relaxed">
                        <p>
                            In the next 24 months, the primary interface for B2B procurement will shift from the rectangular search bar to the conversational AI agent. This is not a "future prediction"; it is a live market reality being observed across the Fortune 500.
                        </p>

                        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white pt-8">The Death of the Click</h2>
                        <p>
                            Traditional SEO optimized for the click. Generative Engine Optimization (GEO) optimizes for the <strong>Shortlist</strong>. When a buyer asks GPT-4o or Gemini to "List the top risk management platforms for global supply chains," there is no "Page 2". There is only the recommendation — and the exclusion.
                        </p>

                        <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-3xl p-10 my-12">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-indigo-500" />
                                Share of Model (SoM): The New KPI
                            </h3>
                            <p className="text-base text-slate-600 dark:text-slate-400 mb-0">
                                Share of Model measures the percentage of simulations where your brand is cited correctly as a primary solution. For a CMO, losing SoM is the digital equivalent of being removed from a physical shelf at a retailer.
                            </p>
                        </div>

                        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white pt-8">The Strategy of Contextual Rigor</h2>
                        <p>
                            AI engines do not "search" the web; they retrieve from a high-dimensional semantic space. If your brand&apos;s latest differentiators — like your SOC2 compliance, your nation-wide network, or your proprietary IP — are not represented as high-fidelity "Assertions," the AI will default to generic category language.
                        </p>

                        <p>
                            To win in the agentic era, brands must move from static landing pages to <strong>Semantic Manifests</strong>. This is why AUM Context Foundry exists: to measure the gap, score the risk, and provide the technical manifests LLMs need to represent your brand with 100% fidelity.
                        </p>
                    </div>

                    <div className="mt-24 pt-16 border-t border-slate-200 dark:border-white/10">
                        <div className="rounded-[2.5rem] bg-indigo-600 p-12 text-center text-white">
                            <h3 className="text-3xl font-bold mb-6">Position Your Brand for the Agentic Era</h3>
                            <p className="text-indigo-100 mb-10 max-w-xl mx-auto">
                                Get your Share of Model (SoM) score today and see exactly which competitors are displacing you in AI search queries.
                            </p>
                            <Link href="/login" className="inline-flex h-14 items-center justify-center rounded-full bg-white px-8 text-indigo-600 font-bold hover:bg-slate-100 transition-colors">
                                Start Your Audit
                            </Link>
                        </div>
                    </div>
                </article>
            </main>
            <Footer />
        </div>
    );
}
