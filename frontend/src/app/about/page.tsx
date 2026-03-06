import React from 'react';
import { Logo } from '@/components/Logo';
import { Shield, Sparkles, Target, Zap } from 'lucide-react';
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
    title: 'About | AUM Context Foundry',
    description: 'The narrative protection layer for the agentic era. Monitor and control your enterprise brand visibility across LLM ecosystems.',
};

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-[#020202] text-slate-900 dark:text-white selection:bg-indigo-500/30">
            <Navbar />

            {/* HERO SECTION */}
            <section className="relative pt-32 pb-20 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/10 dark:bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

                <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
                    <div className="flex justify-center mb-8">
                        <Logo size={48} showText={false} />
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-white dark:to-slate-400 bg-clip-text text-transparent">
                        Defending Narrative<br />in the Agentic Era
                    </h1>
                    <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                        AUM Context Foundry is the enterprise standard for tracking, scoring, and defending brand fidelity across global language models and autonomous AI agents.
                    </p>
                </div>
            </section>

            {/* THE PROBLEM / MISSION */}
            <section className="py-24 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#050505]">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-sm font-bold tracking-widest text-indigo-600 dark:text-indigo-400 uppercase mb-4">Our Mission</h2>
                        <h3 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">The Rules of Search Have Changed</h3>
                    </div>

                    <div className="space-y-8 text-slate-600 dark:text-slate-300 text-lg leading-relaxed">
                        <p>
                            For two decades, enterprises optimized for PageRank. You controlled the keywords, you controlled the landing pages, and you controlled the narrative. But the transition to Generative Engine Optimization (GEO) and Agentic web-browsing has shattered the traditional funnel.
                        </p>
                        <p>
                            Today, your customers aren&apos;t clicking links—they are asking an AI. If your brand context isn&apos;t perfectly structured, hallucination-resistant, and injected directly into the LLM&apos;s context window, <strong className="text-slate-900 dark:text-white">your competition will become the synthetic ground truth.</strong>
                        </p>
                        <p>
                            We built AUM Context Foundry to give enterprise marketing, PR, and engineering teams a unified &quot;Smoke Detector&quot; for narrative drift. We simulate thousands of distinct user journeys through models like GPT-4o, Claude 3.5 Sonnet, and Gemini, mathematically scoring your Agentic Share of Voice (ASoV).
                        </p>
                    </div>
                </div>
            </section>

            {/* CORE PILLARS */}
            <section className="py-24 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-black">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

                        <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors">
                            <div className="w-12 h-12 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center mb-6">
                                <Target className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h4 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Precision Measurement</h4>
                            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                                We run deterministic, parallel queries across GPT-4o, Claude, and Gemini to objectively measure how accurately each model represents your brand.
                            </p>
                        </div>

                        <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors">
                            <div className="w-12 h-12 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center mb-6">
                                <Shield className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h4 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Fidelity Defense</h4>
                            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                                Identify hallucination risks and narrative drift before they impact your pipeline. We alert you when AI models misrepresent your core IP.
                            </p>
                        </div>

                        <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors">
                            <div className="w-12 h-12 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center mb-6">
                                <Zap className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                            </div>
                            <h4 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Zero-Retention</h4>
                            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                                Your data stays yours. Our SOC2-compliant ingestion engine processes proprietary documents in volatile RAM and purges them instantly post-bedrock grounding.
                            </p>
                        </div>

                        <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors">
                            <div className="w-12 h-12 rounded-lg bg-cyan-500/10 dark:bg-cyan-500/20 flex items-center justify-center mb-6">
                                <Sparkles className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                            </div>
                            <h4 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Agentic SEO Protocol</h4>
                            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                                Download structured <code className="text-xs bg-slate-200 dark:bg-white/10 px-1.5 py-0.5 rounded">llms.txt</code> files and inject your ground truth context directly into LLM crawler nodes.
                            </p>
                        </div>

                    </div>
                </div>
            </section>

            {/* HQ & CONTACT BANNER */}
            <section className="py-24 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#050505]">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h2 className="text-3xl font-bold mb-8 text-slate-900 dark:text-white">Headquarters</h2>
                    <div className="p-8 rounded-2xl bg-white dark:bg-indigo-900/10 border border-slate-200 dark:border-indigo-500/20 inline-block text-left shadow-sm dark:shadow-none">
                        <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">AUM Context Foundry</h4>
                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                            Chennai, Tamil Nadu<br />
                            India
                        </p>
                        <a href="mailto:hello@aumcontextfoundry.com" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium transition-colors">
                            hello@aumcontextfoundry.com
                        </a>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
