/**
 * Author: "Sambath Kumar Natarajan"
 * Date: "26-Dec-2025"
 * Org: " Start-up/AUM Data Labs"
 * Product: "AUM Context Foundry"
 * Description: Public Landing Page for AUM Context Foundry.
 */
"use client";

import { motion } from "framer-motion";
import { ArrowRight, BrainCircuit, Play, ShieldCheck, Zap, Moon, Sun, Cpu, Lock, BarChart3, Binary, Scale, Sparkles as Sparkle, Sparkles, Globe, Webhook, Code2, Terminal, Activity, CheckCircle2, Crosshair, AlertTriangle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Logo } from "@/components/Logo";
import React, { useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import ProductDemoVideo from "@/components/ProductDemoVideo";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function LandingPage() {
    const { theme, toggleTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 font-sans overflow-x-hidden selection:bg-indigo-500/30 transition-colors duration-300">

            {/* Premium Background Gradients */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/10 dark:bg-indigo-600/10 blur-[140px] rounded-full"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-500/10 dark:bg-fuchsia-600/10 blur-[130px] rounded-full"></div>
                <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] bg-cyan-500/10 dark:bg-cyan-900/10 blur-[150px] rounded-full"></div>
            </div>

            <Navbar />


            <main className="relative z-10 pt-32 pb-20">

                {/* Hero Section */}
                <section className="max-w-7xl mx-auto px-6 pt-24 pb-32 flex flex-col items-center text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center space-x-2 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest mb-10 border border-indigo-200/50 dark:border-indigo-500/20 backdrop-blur-sm shadow-[0_0_30px_rgba(99,102,241,0.1)] dark:shadow-[0_0_30px_rgba(99,102,241,0.2)]"
                    >
                        <Sparkle className="w-3.5 h-3.5" />
                        <span>Generative Engine Optimization (GEO)</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-[0.9] max-w-5xl text-slate-900 dark:text-white uppercase"
                    >
                        Protect Your Brand's <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-cyan-500 to-indigo-500 dark:from-emerald-400 dark:via-cyan-400 dark:to-indigo-300">
                            AI Search Revenue.
                        </span>
                    </motion.h1>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="text-xl md:text-2xl text-slate-600 dark:text-slate-400/80 mb-12 max-w-3xl leading-relaxed font-light"
                    >
                        <div className="space-y-4">
                            <span>
                                According to Gartner (2024), over <strong className="font-semibold text-slate-800 dark:text-slate-200">60% of B2B technology buyers</strong> start their journey with a generative AI prompt.
                            </span>
                            <span className="block mt-2">
                                AUM ensures ChatGPT, Claude, and Gemini recommend your brand accurately instead of <span className="text-rose-600 dark:text-rose-400 font-medium">hallucinating features or promoting your competitors.</span>
                            </span>
                            <p className="text-xs text-slate-500 dark:text-slate-500 italic mt-4">
                                [1] Gartner. "B2B Tech Buyer Search Trends" (2024).
                            </p>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6"
                    >
                        <Link href="/login" className="w-full sm:w-auto px-8 py-4 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center transition-all shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/40 transform hover:-translate-y-1 glow-indigo">
                            Request Strategic Audit <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <a href="#demo" className="w-full sm:w-auto px-8 py-4 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 font-medium flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                            <Play className="w-5 h-5 mr-2 text-indigo-500" /> Watch Demo
                        </a>
                    </motion.div>
                </section>

                {/* The Moat Section */}
                <section id="moat" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/5">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-6">
                                Drive Pipeline with <span className="font-semibold text-emerald-600 dark:text-emerald-400">Agentic SEO</span>
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed mb-8 font-light">
                                <strong>Track your Agentic Share of Voice (ASoV).</strong> We audit what AI says about you, alert you to hallucinations, and provide the exact data pipeline to inject the facts.
                            </p>
                            <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed mb-8 font-light">
                                Stop losing leads to outdated AI models. We ensure your brand is cited accurately and prominently across every major generative engine.
                            </p>

                            <div className="space-y-4">
                                <div className="flex items-start">
                                    <div className="mt-1 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center mr-4 shrink-0">
                                        <Crosshair className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-900 dark:text-white">Competitor Benchmarking</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">See exactly when and why Claude or Perplexity recommend your competitors instead of you.</p>
                                    </div>
                                </div>
                                <div className="flex items-start">
                                    <div className="mt-1 w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center mr-4 shrink-0">
                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-900 dark:text-white">Hallucination Alerts</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Get immediate pings when AI models invent false limitations about your product.</p>
                                    </div>
                                </div>
                                <div className="flex items-start">
                                    <div className="mt-1 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mr-4 shrink-0">
                                        <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-900 dark:text-white">Direct-to-AI Correction</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Upload your latest marketing sheets to update the AI ecosystems instantly without coding.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="relative group">
                            <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500/10 to-fuchsia-500/10 rounded-3xl blur-2xl group-hover:from-indigo-500/20 group-hover:to-fuchsia-500/20 transition duration-700"></div>
                            <div className="relative rounded-[2rem] border border-slate-200 dark:border-white/10 glass-morphism p-8 shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                                <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-200/50 dark:border-white/10">
                                    <h3 className="font-medium text-slate-900 dark:text-white flex items-center">
                                        <Activity className="w-4 h-4 mr-2 text-indigo-500" />
                                        Global ASoV Index
                                    </h3>
                                    <span className="text-2xl font-light text-cyan-600 dark:text-cyan-400">84.2%</span>
                                </div>
                                <div className="space-y-4">
                                    {['ChatGPT', 'Claude 3.5', 'Gemini 2.0 Flash'].map((model, i) => (
                                        <div key={model} className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600 dark:text-slate-400">{model}</span>
                                                <span className="text-slate-900 dark:text-white font-medium">{95 - (i * 7)}%</span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    whileInView={{ width: `${95 - (i * 7)}%` }}
                                                    transition={{ duration: 1, delay: i * 0.2 }}
                                                    viewport={{ once: true }}
                                                    className="h-full bg-indigo-500 rounded-full"
                                                ></motion.div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Proprietary Technical Moats: THE NICHE FEATURES */}
                <section id="features" className="max-w-7xl mx-auto px-6 py-32 border-t border-slate-200 dark:border-white/5 relative overflow-hidden">
                    {/* Animated background element for this section */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none"></div>

                    <div className="text-center mb-20 relative z-10">
                        <h2 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] mb-4 text-center">Proprietary Technical Moats</h2>
                        <h3 className="text-4xl md:text-5xl font-light tracking-tight text-slate-900 dark:text-white text-center">Engineering the Future of Fact.</h3>
                    </div>

                    <div className="grid md:grid-cols-3 gap-12 relative z-10">
                        {/* Moat 1: LCRS */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            viewport={{ once: true }}
                            className="bg-white/40 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-8 rounded-[2.5rem] backdrop-blur-xl group hover:border-indigo-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/5"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                                <Binary className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h4 className="text-xl font-medium mb-4 text-slate-900 dark:text-white transition-colors group-hover:text-indigo-500">
                                <Link href="/methods">LCRS Scoring</Link>
                            </h4>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6 font-light">
                                Our <strong>Latent Contextual Rigor Scoring</strong> engine uses claim extraction and vector divergence to mathematically prove AI accuracy against your verified ground truth.
                            </p>
                            <div className="font-mono text-[10px] bg-slate-100 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200 dark:border-white/5 text-slate-500 dark:text-indigo-300/60 leading-relaxed">
                                d = 1.0 - (v_manifest ⋅ v_answer) / (||v_manifest|| ||v_answer||)
                            </div>
                        </motion.div>

                        {/* Moat 2: Zero-Retention */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            viewport={{ once: true }}
                            className="bg-white/40 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-8 rounded-[2.5rem] backdrop-blur-xl group hover:border-fuchsia-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-fuchsia-500/5"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-fuchsia-50 dark:bg-fuchsia-500/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                                <Lock className="w-7 h-7 text-fuchsia-600 dark:text-fuchsia-400" />
                            </div>
                            <h4 className="text-xl font-medium mb-4 text-slate-900 dark:text-white transition-colors group-hover:text-fuchsia-500">
                                <Link href="/security">Zero-Retention Ingestion</Link>
                            </h4>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6 font-light">
                                Built for CISO-level compliance. Our <strong>Semantic Ingestion</strong> pipeline processes PDF binaries in volatile memory streams, ensuring zero proprietary data ever touches persistent disk.
                            </p>
                            <ul className="space-y-2 text-xs text-slate-500 dark:text-fuchsia-300/60">
                                <li className="flex items-center"><CheckCircle2 className="w-3 h-3 mr-2" /> SOC2/CISO Audit Ready</li>
                                <li className="flex items-center"><CheckCircle2 className="w-3 h-3 mr-2" /> Volatile Buffer Distillation</li>
                                <li className="flex items-center"><CheckCircle2 className="w-3 h-3 mr-2" /> Verified JSON-LD Output</li>
                            </ul>
                        </motion.div>

                        {/* Moat 3: ASoV */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            viewport={{ once: true }}
                            className="bg-white/40 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-8 rounded-[2.5rem] backdrop-blur-xl group hover:border-cyan-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-cyan-500/5"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-cyan-50 dark:bg-cyan-500/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                                <BarChart3 className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
                            </div>
                            <h4 className="text-xl font-medium mb-4 text-slate-900 dark:text-white transition-colors group-hover:text-cyan-500">
                                <Link href="/methods">ASoV Indexing</Link>
                            </h4>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6 font-light">
                                Move beyond clicks. <strong>Agentic Share of Voice</strong> measures how often and how accurately your brand is cited by LLMs during competitive purchasing simulations.
                            </p>
                            <div className="flex items-center space-x-2">
                                <span className="px-3 py-1 bg-cyan-500/10 text-cyan-500 rounded-full text-[10px] uppercase font-bold tracking-widest">Moat Factor: 1.8x</span>
                                <span className="px-3 py-1 bg-indigo-500/10 text-indigo-500 rounded-full text-[10px] uppercase font-bold tracking-widest">ASoV Score: Delta+</span>
                            </div>
                        </motion.div>
                    </div>
                </section >


                {/* Demo Video Area */}
                <section id="demo" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/5">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-4">See the Foundry in Action</h2>
                        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">Watch how leading enterprises deploy their semantic facts directly to Agentic Search engines.</p>
                    </div>

                    <div className="relative max-w-5xl mx-auto">
                        <ProductDemoVideo />
                    </div>
                </section>

                {/* Trust & Capabilities Strip */}
                <section className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/5">
                    <div className="text-center mb-16">
                        <h2 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] mb-4">Built for Enterprise</h2>
                        <h3 className="text-4xl md:text-5xl font-light tracking-tight text-slate-900 dark:text-white">Production-Grade Infrastructure</h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { metric: '3', label: 'LLM Providers', sub: 'ChatGPT · Claude · Gemini', cls: 'text-indigo-600 dark:text-indigo-400' },
                            { metric: '99.99%', label: 'Uptime SLA', sub: 'Multi-region deployment', cls: 'text-emerald-600 dark:text-emerald-400' },
                            { metric: '< 50ms', label: 'Scoring Latency', sub: 'Real-time analysis', cls: 'text-cyan-600 dark:text-cyan-400' },
                            { metric: 'SOC2', label: 'Compliance Ready', sub: 'Zero-retention processing', cls: 'text-fuchsia-600 dark:text-fuchsia-400' },
                        ].map((item) => (
                            <motion.div
                                key={item.label}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="bg-white/60 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl p-6 text-center backdrop-blur-xl"
                            >
                                <p className={`text-3xl md:text-4xl font-light tracking-tighter mb-2 ${item.cls}`}>{item.metric}</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">{item.label}</p>
                                <p className="text-xs text-slate-500">{item.sub}</p>
                            </motion.div>
                        ))}
                    </div>

                    <div className="mt-12 flex flex-wrap justify-center gap-6 text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-medium">
                        <span className="flex items-center"><ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Multi-Tenant Isolation</span>
                        <span>·</span>
                        <span className="flex items-center"><Lock className="w-3.5 h-3.5 mr-1.5" /> End-to-End Encryption</span>
                        <span>·</span>
                        <span className="flex items-center"><Cpu className="w-3.5 h-3.5 mr-1.5" /> Claim-Level Fact Checking</span>
                        <span>·</span>
                        <span className="flex items-center"><Scale className="w-3.5 h-3.5 mr-1.5" /> RBAC Access Control</span>
                    </div>
                </section >

                {/* API & Developer Platform Section */}
                <section id="api" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/5">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div>
                            <div className="inline-flex items-center space-x-2 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
                                <Code2 className="w-3.5 h-3.5" />
                                <span>API-First Architecture</span>
                            </div>
                            <h2 className="text-3xl md:text-5xl font-light tracking-tight text-slate-900 dark:text-white mb-6">
                                The Verified Identity Router
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400 text-lg font-light leading-relaxed mb-8">
                                AUM is not just a dashboard; it is core B2B data infrastructure. We provide the <strong className="font-medium text-slate-800 dark:text-slate-200">REST API layer</strong> that enterprise SEO and PR platforms license to bring Agentic Search insights directly into their native workflows.
                            </p>

                            <ul className="space-y-6">
                                <li className="flex items-start">
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mr-4">
                                        <Webhook className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-slate-900 dark:text-white font-medium mb-1">Zero-Retention Ingestion Webhooks</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-light">Programmatically send proprietary corporate PDFs to our secure API. We flush from memory instantly and return perfectly structured semantic vectors.</p>
                                    </div>
                                </li>
                                <li className="flex items-start">
                                    <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0 mr-4">
                                        <Terminal className="w-5 h-5 text-cyan-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-slate-900 dark:text-white font-medium mb-1">ASoV & Context Drift Endpoints</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-light">Pull real-time mathematical scores (60/40 blend) for brand fidelity across ChatGPT, Claude 3.5, and Gemini 2.0 to power your own analytics.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 rounded-[2rem] blur-3xl opacity-50 dark:opacity-20 animate-pulse"></div>
                            <div className="relative rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-[#0a0a0a]/80 backdrop-blur-xl p-8 shadow-2xl overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-50 transition-opacity">
                                    <div className="flex space-x-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                                    </div>
                                </div>
                                <h4 className="text-slate-400 uppercase tracking-widest text-[10px] font-bold mb-4">POST /api/simulation/v1/run</h4>
                                <pre className="text-xs md:text-sm font-mono text-slate-600 dark:text-slate-300 overflow-hidden text-left bg-slate-50 dark:bg-black/30 p-4 rounded-xl border border-slate-200/50 dark:border-white/5">
                                    <code className="text-indigo-600 dark:text-indigo-400">curl</code> -X POST https://api.aumdatalabs.com/api/simulation/v1/run \<br />
                                    -H <span className="text-emerald-600 dark:text-emerald-400">"Authorization: Bearer sk-live-..."</span> \<br />
                                    -d <span className="text-amber-600 dark:text-amber-400">{'{'}</span><br />
                                    &nbsp;&nbsp;<span className="text-cyan-600 dark:text-cyan-400">"brandId"</span>: <span className="text-emerald-600 dark:text-emerald-400">"org_2F3a..."</span>,<br />
                                    &nbsp;&nbsp;<span className="text-cyan-600 dark:text-cyan-400">"engines"</span>: [<span className="text-emerald-600 dark:text-emerald-400">"gpt-4o"</span>, <span className="text-emerald-600 dark:text-emerald-400">"perplexity"</span>],<br />
                                    &nbsp;&nbsp;<span className="text-cyan-600 dark:text-cyan-400">"query"</span>: <span className="text-emerald-600 dark:text-emerald-400">"What is their current pricing?"</span><br />
                                    <span className="text-amber-600 dark:text-amber-400">{'}'}</span>
                                </pre>

                                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5">
                                    <pre className="text-xs md:text-sm font-mono text-slate-500 dark:text-slate-400 overflow-hidden text-left">
                                        {/* Response snippet (LCRS 60/40 logic) */}<br />
                                        {'{'}<br />
                                        &nbsp;&nbsp;<span className="text-cyan-600 dark:text-cyan-400">"contextDrift"</span>: <span className="text-rose-500">32.4</span>,<br />
                                        &nbsp;&nbsp;<span className="text-cyan-600 dark:text-cyan-400">"claimVerification"</span>: <span className="text-emerald-600 dark:text-emerald-400">"0.89"</span>,<br />
                                        &nbsp;&nbsp;<span className="text-cyan-600 dark:text-cyan-400">"semanticDistance"</span>: <span className="text-emerald-600 dark:text-emerald-400">"0.92"</span><br />
                                        {'}'}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Pricing — 3 Tiers */}
                <section id="pricing" className="max-w-7xl mx-auto px-6 py-32 border-t border-slate-200 dark:border-white/5">
                    <div className="text-center mb-20">
                        <h2 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] mb-4">Transparent Pricing</h2>
                        <h3 className="text-4xl md:text-5xl font-light tracking-tight text-slate-900 dark:text-white">Choose Your GEO Strategy</h3>
                        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mt-4 font-light">All plans include zero-retention data processing and multi-tenant isolation.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        {/* EXPLORER */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            viewport={{ once: true }}
                            className="rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-[#0a0a0a]/80 backdrop-blur-2xl p-8 shadow-xl dark:shadow-none flex flex-col"
                        >
                            <div className="mb-8">
                                <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-1">EXPLORER</h4>
                                <p className="text-sm text-slate-500">Try it. No card required.</p>
                            </div>
                            <div className="flex items-baseline mb-8">
                                <span className="text-4xl font-light tracking-tighter text-slate-900 dark:text-white">Free Forever</span>
                            </div>
                            <ul className="space-y-3 mb-10 flex-1 text-sm text-slate-600 dark:text-slate-400">
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> <strong className="text-slate-900 dark:text-white">3</strong> weekly brand probes</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> <strong className="text-slate-900 dark:text-white">All 3 models</strong> (ChatGPT, Claude, Gemini)</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> 1 document ingestion</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Basic ASoV score</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> <code>/llms.txt</code> preview</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Multi-model comparison</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Basic scoring history</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> 1 Team seat</li>
                            </ul>
                            <Link href="/login" className="block w-full py-3.5 rounded-xl border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 font-medium text-center hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-sm">
                                Start Free
                            </Link>
                        </motion.div>

                        {/* GROWTH — Recommended */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            viewport={{ once: true }}
                            className="rounded-[2rem] iridescent-border bg-white dark:bg-[#0a0a0a]/90 backdrop-blur-2xl p-8 shadow-2xl shadow-indigo-500/10 flex flex-col relative"
                        >
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-indigo-600 text-white text-xs font-semibold uppercase tracking-widest shadow-lg">
                                Most Popular
                            </div>
                            <div className="mb-8">
                                <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-1">GROWTH</h4>
                                <p className="text-sm text-slate-500">For teams serious about AI visibility.</p>
                            </div>
                            <div className="flex items-baseline mb-8">
                                <span className="text-5xl font-light tracking-tighter text-slate-900 dark:text-white">$79</span>
                                <span className="text-slate-500 font-medium ml-2">/mo</span>
                            </div>
                            <ul className="space-y-3 mb-10 flex-1 text-sm text-slate-600 dark:text-slate-400">
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-indigo-500 mr-2.5 mt-0.5 shrink-0" /> <strong className="text-slate-900 dark:text-white">125</strong> weekly brand probes</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-indigo-500 mr-2.5 mt-0.5 shrink-0" /> <strong className="text-slate-900 dark:text-white">All 3 models</strong> (ChatGPT, Claude, Gemini)</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Unlimited document ingestion</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Full ASoV dashboard</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> <code>/llms.txt</code> deploy to edge</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> SEO + GEO readiness audit</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Automated monitoring rhythm</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Up to 5 seats</li>
                            </ul>
                            <Link href="/login" className="block w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-center transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transform hover:-translate-y-0.5 text-sm">
                                Start 7-Day Trial
                            </Link>
                            <p className="text-center text-xs text-slate-400 mt-4">7-day trial, then $79/mo. Cancel anytime.</p>
                        </motion.div>

                        {/* SCALE */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            viewport={{ once: true }}
                            className="rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-[#0a0a0a]/80 backdrop-blur-2xl p-8 shadow-xl dark:shadow-none flex flex-col"
                        >
                            <div className="mb-8">
                                <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-1">SCALE</h4>
                                <p className="text-sm text-slate-500">For agencies managing high-volume brands.</p>
                            </div>
                            <div className="flex items-baseline mb-8">
                                <span className="text-5xl font-light tracking-tighter text-slate-900 dark:text-white">$249</span>
                                <span className="text-slate-500 font-medium ml-2">/mo</span>
                            </div>
                            <ul className="space-y-3 mb-10 flex-1 text-sm text-slate-600 dark:text-slate-400">
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> <strong className="text-slate-900 dark:text-white">500</strong> weekly brand probes</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> <strong className="text-slate-900 dark:text-white">All 3 models + priority queue</strong></li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Unlimited document ingestion</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Fully white-labeled exports</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> <code>/llms.txt</code> deploy to edge</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Competitor displacement tracking</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Weekly automated batch runs</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> <strong className="text-slate-900 dark:text-white">Unlimited</strong> team seats</li>
                            </ul>
                            <Link href="/contact" className="block w-full py-3.5 rounded-xl border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 font-medium text-center hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-sm">
                                Start 7-Day Trial
                            </Link>
                            <p className="text-center text-xs text-slate-400 mt-4">7-day trial. Custom Agency SLA available.</p>
                        </motion.div>
                    </div>
                </section>

                {/* FAQs */}
                <section id="faq" className="max-w-4xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/5">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-light tracking-tight text-slate-900 dark:text-white">Questions we actually get asked</h2>
                    </div>
                    <div className="space-y-6 text-left">
                        <div className="p-6 rounded-2xl bg-white/50 dark:bg-[#0a0a0a]/50 border border-slate-200 dark:border-white/10 backdrop-blur-xl">
                            <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">What is a &quot;Brand Probe&quot;?</h4>
                            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                A Brand Probe is a single diagnostic query tested across all three major models simultaneously. One probe against ChatGPT, Claude, and Gemini counts as one unit. We align these to a &quot;Weekly Probe&quot; rhythm to match how enterprise comms teams track narrative drift.
                            </p>
                        </div>
                        <div className="p-6 rounded-2xl bg-white/50 dark:bg-[#0a0a0a]/50 border border-slate-200 dark:border-white/10 backdrop-blur-xl">
                            <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Why does the free tier include all 3 models?</h4>
                            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                Because a single-model score isn&apos;t the insight. The insight is when ChatGPT rates your brand at 91% accuracy and Claude rates it at 47%. That gap is what you&apos;re paying to understand and fix. Showing you only one model would be dishonest about the product&apos;s value.
                            </p>
                        </div>
                        <div className="p-6 rounded-2xl bg-white/50 dark:bg-[#0a0a0a]/50 border border-slate-200 dark:border-white/10 backdrop-blur-xl">
                            <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">What happens when I hit my simulation limit?</h4>
                            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                Simulations pause — no surprise overage charges. You&apos;ll get a dashboard warning at 80% usage. The counter resets on your billing date.
                            </p>
                        </div>
                        <div className="p-6 rounded-2xl bg-white/50 dark:bg-[#0a0a0a]/50 border border-slate-200 dark:border-white/10 backdrop-blur-xl">
                            <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Is my uploaded data actually deleted?</h4>
                            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                Yes. PDFs are read into volatile memory buffers, chunked, embedded into vectors, then purged from memory. We store the resulting JSON-LD schema, not your source document. Nothing proprietary touches persistent disk.
                            </p>
                        </div>
                        <div className="p-6 rounded-2xl bg-white/50 dark:bg-[#0a0a0a]/50 border border-slate-200 dark:border-white/10 backdrop-blur-xl">
                            <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">What&apos;s the difference between /llms.txt preview (Explorer) and deploy to edge (Growth+)?</h4>
                            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                Preview shows you the generated manifest file. Deploy actually serves it at your verified endpoint so LLM crawlers can discover it. The preview is proof-of-concept; the deploy is the product working.
                            </p>
                        </div>
                    </div>
                </section>

            </main>
            <Footer />
        </div>
    );
}


