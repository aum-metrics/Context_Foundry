/**
 * Author: "Sambath Kumar Natarajan"
 * Date: "26-Dec-2025"
 * Org: " Start-up/AUM Data Labs"
 * Product: "Context Foundry"
 * Description: Public Landing Page for AUM Context Foundry.
 */
"use client";

import { motion } from "framer-motion";
import { ArrowRight, BrainCircuit, Play, ShieldCheck, Zap, Moon, Sun, Cpu, Lock, BarChart3, Binary, Scale, Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import ProductDemoVideo from "@/components/ProductDemoVideo";

export default function LandingPage() {
    const { theme, toggleTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="min-h-screen bg-white dark:bg-[#030303] text-slate-900 dark:text-slate-100 font-sans overflow-x-hidden selection:bg-indigo-500/30 transition-colors duration-300">

            {/* Premium Background Gradients */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/10 dark:bg-indigo-600/10 blur-[140px] rounded-full"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-500/10 dark:bg-fuchsia-600/10 blur-[130px] rounded-full"></div>
                <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] bg-cyan-500/10 dark:bg-cyan-900/10 blur-[150px] rounded-full"></div>
                {/* Micro-grid overlay for texture */}
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] dark:opacity-20 opacity-5"></div>
            </div>

            {/* Navigation */}
            <nav className="fixed w-full z-50 bg-white/50 dark:bg-[#030303]/60 backdrop-blur-2xl border-b border-slate-200/50 dark:border-white/5 transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center space-x-3 group cursor-pointer">
                        <div className="w-10 h-10 relative flex items-center justify-center">
                            <Image src="/favicon.ico" alt="AUM Context Foundry Logo" width={32} height={32} className="object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-semibold text-xl tracking-tight text-slate-900 dark:text-white leading-tight">AUM Context Foundry</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">by AUM Data Labs</span>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-600 dark:text-slate-400">
                        <a href="#moat" className="hover:text-indigo-600 dark:hover:text-white transition-colors">The Moat</a>
                        <a href="#features" className="hover:text-cyan-600 dark:hover:text-white transition-colors">Platform</a>
                        <a href="#demo" className="hover:text-fuchsia-600 dark:hover:text-white transition-colors">Demo</a>
                        <Link href="/contact" className="hover:text-emerald-600 dark:hover:text-white transition-colors">Contact</Link>
                    </div>

                    <div className="flex items-center space-x-4">
                        {mounted && (
                            <button
                                onClick={toggleTheme}
                                className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-amber-300 transition-colors"
                                aria-label="Toggle dark mode"
                            >
                                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                            </button>
                        )}
                        <Link href="/login" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white transition-colors">
                            Sign In
                        </Link>
                        {/* Premium CTA Button */}
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-full blur opacity-30 group-hover:opacity-70 transition duration-500"></div>
                            <Link href="/login" className="relative text-sm font-medium bg-slate-900 dark:bg-[#0a0a0a] border border-slate-700/50 dark:border-white/10 text-white px-6 py-2.5 rounded-full flex items-center transition-all">
                                Request Audit
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

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
                        className="text-6xl md:text-8xl font-light tracking-tighter mb-8 leading-[1.05] max-w-5xl text-slate-900 dark:text-white"
                    >
                        Control Your Narrative in <br className="hidden md:block" />
                        <span className="font-medium text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-cyan-500 dark:from-indigo-400 dark:via-fuchsia-400 dark:to-cyan-300">
                            The Agentic Web.
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="text-xl md:text-2xl text-slate-600 dark:text-slate-400/80 mb-12 max-w-3xl leading-relaxed font-light"
                    >
                        AUM Context Foundry translates your unstructured data into verified JSON-LD schemas and <code className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded-md text-sm font-mono text-slate-800 dark:text-slate-300">/llms.txt</code> manifests. Win the LLM recommendation wars before they begin.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6"
                    >
                        <Link href="/login" className="w-full sm:w-auto px-8 py-4 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center transition-all shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/40 transform hover:-translate-y-1">
                            Request Strategic Audit <ArrowRight className="ml-2 w-5 h-5" />
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
                                The <span className="font-semibold text-indigo-600 dark:text-indigo-400">Agentic Commerce</span> Moat
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed mb-8">
                                Traditional SEO is dead. Tomorrow's buyers won't search Google; their AI agents will synthesize options and make purchasing decisions for them.
                            </p>
                            <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed mb-8">
                                Our platform ensures your enterprise data is the **most heavily weighted** and **least hallucinated** entity in the latent space of models like GPT-4, Claude, and Gemini.
                            </p>

                            <div className="space-y-4">
                                <div className="flex items-start">
                                    <div className="mt-1 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mr-4 shrink-0">
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-900 dark:text-white">Divergence Stress-Testing</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">We simulate thousands of prompts to ensure <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">d &gt; ε_div</span> remains below acceptable hallucination thresholds.</p>
                                    </div>
                                </div>
                                <div className="flex items-start">
                                    <div className="mt-1 w-6 h-6 rounded-full bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center mr-4 shrink-0">
                                        <Zap className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-900 dark:text-white">Real-time Semantic Ingestion</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Drop in messy marketing PDFs; get out pristine, LLM-optimized JSON-LD schemas.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="relative group">
                            <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500/10 to-fuchsia-500/10 rounded-3xl blur-2xl group-hover:from-indigo-500/20 group-hover:to-fuchsia-500/20 transition duration-700"></div>
                            <div className="relative rounded-[2rem] border border-slate-200/50 dark:border-white/10 bg-white/60 dark:bg-[#0a0a0a]/80 backdrop-blur-2xl p-8 shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                                <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-200/50 dark:border-white/10">
                                    <h3 className="font-medium text-slate-900 dark:text-white flex items-center">
                                        <Activity className="w-4 h-4 mr-2 text-indigo-500" />
                                        Global ASoV Index
                                    </h3>
                                    <span className="text-2xl font-light text-cyan-600 dark:text-cyan-400">84.2%</span>
                                </div>
                                <div className="space-y-4">
                                    {['GPT-4.5', 'Claude 3.7 Sonnet', 'Gemini 2.5 Pro'].map((model, i) => (
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
                            <h4 className="text-xl font-medium mb-4 text-slate-900 dark:text-white">LCRS Math</h4>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6 font-light">
                                Our **Latent Contextual Rigor Scoring** engine uses high-dimension vector divergence (d &gt; ε_div) to mathematically prove AI accuracy against your ground truth.
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
                            <h4 className="text-xl font-medium mb-4 text-slate-900 dark:text-white">Zero-Retention Ingestion</h4>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6 font-light">
                                Built for CISO level compliance. Our **ARGUS-Thesis** pipeline processes PDF binaries in volatile memory streams, ensuring zero proprietary data ever touches our disk.
                            </p>
                            <ul className="space-y-2 text-xs text-slate-500 dark:text-fuchsia-300/60">
                                <li className="flex items-center"><CheckCircle2 className="w-3 h-3 mr-2" /> SOC2/CISO Audit Ready</li>
                                <li className="flex items-center"><CheckCircle2 className="w-3 h-3 mr-2" /> Volatile Buffer Flushing</li>
                                <li className="flex items-center"><CheckCircle2 className="w-3 h-3 mr-2" /> Direct Text-to-Schema Map</li>
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
                            <h4 className="text-xl font-medium mb-4 text-slate-900 dark:text-white">ASoV Indexing</h4>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6 font-light">
                                Move beyond clicks. **Agentic Share of Voice** measures how often and how accurately your brand is cited by LLMs during competitive purchasing simulations.
                            </p>
                            <div className="flex items-center space-x-2">
                                <span className="px-3 py-1 bg-cyan-500/10 text-cyan-500 rounded-full text-[10px] uppercase font-bold tracking-widest">Moat Factor: 1.8x</span>
                                <span className="px-3 py-1 bg-indigo-500/10 text-indigo-500 rounded-full text-[10px] uppercase font-bold tracking-widest">ASoV Score: Delta+</span>
                            </div>
                        </motion.div>
                    </div>
                </section>


                {/* Demo Video Area */}
                <section id="demo" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/5">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-4">See the Foundry in Action</h2>
                        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">Watch how leading enterprises deploy their semantic facts directly to the latent space.</p>
                    </div>

                    <div className="relative max-w-5xl mx-auto">
                        <ProductDemoVideo />
                    </div>
                </section>

                {/* Brutally Honest Testimonials */}
                <section id="proof" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/5">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-4 text-slate-900 dark:text-white">Zero Hallucinated Proof</h2>
                        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                            We don't buy fake reviews. AUM Context Foundry is a bleeding-edge early-adopter product.<br />
                            We are currently onboarding our Alpha Cohort. Once our clients' ASoV verifiable metrics cross target thresholds next quarter, their quotes will go here.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-tr from-slate-200 to-slate-100 dark:from-white/5 dark:to-white/5 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-700"></div>
                                <div className="relative rounded-xl border border-dashed border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-[#0a0a0a]/50 p-8 shadow-sm flex flex-col items-center justify-center h-full text-center">
                                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-400 dark:text-slate-500">
                                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                    </div>
                                    <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-2">Reserved Space</p>
                                    <p className="text-slate-400 dark:text-slate-500 italic text-sm">Waiting for verified semantic indexing results algorithmically.</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Pricing Strategy */}
                <section id="pricing" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/5">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-4">Securing the Real Win</h2>
                        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">Transparent, enterprise-grade pricing for global data syndication.</p>
                    </div>

                    <div className="max-w-lg mx-auto relative group">
                        <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-fuchsia-500 rounded-[2.5rem] blur-xl opacity-30 group-hover:opacity-70 transition duration-700"></div>
                        <div className="relative rounded-[2rem] border border-white/10 bg-white dark:bg-[#0a0a0a]/90 backdrop-blur-2xl p-12 shadow-2xl text-center">
                            <div className="inline-block px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-6">Platinum Tier</div>
                            <h3 className="text-3xl font-light mb-2 text-slate-900 dark:text-white">Enterprise Protocol</h3>
                            <p className="text-slate-500 dark:text-slate-400/80 text-sm mb-8">Full Generative Engine Optimization Suite</p>

                            <div className="my-10 flex items-baseline justify-center text-slate-900 dark:text-white">
                                <span className="text-6xl font-light tracking-tighter">₹25,000</span>
                                <span className="text-slate-500 dark:text-slate-500 font-medium ml-2">/mo</span>
                            </div>

                            <ul className="text-left space-y-4 mb-10 text-slate-700 dark:text-slate-300">
                                <li className="flex items-center"><CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 shrink-0" /> Unlimited Semantic Document Ingestion</li>
                                <li className="flex items-center"><CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 shrink-0" /> Global Edge Manifesto Deployment (/llms.txt)</li>
                                <li className="flex items-center"><CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 shrink-0" /> Real-time "Agentic Share of Voice" ASoV metrics</li>
                                <li className="flex items-center"><CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 shrink-0" /> Co-Intelligence Simulator (d &gt; ε_div tracking)</li>
                                <li className="flex items-center"><CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 shrink-0" /> Dedicated Solutions Architect</li>
                            </ul>

                            <Link href="/login" className="block w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:shadow-[0_0_40px_rgba(79,70,229,0.5)] transform hover:-translate-y-0.5">
                                Request Enterprise Audit
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Footer Section */}
                <footer className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/5">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                        <div className="col-span-1 md:col-span-2">
                            <h3 className="text-xl font-medium mb-6 flex items-center">
                                <BrainCircuit className="w-6 h-6 mr-3 text-indigo-600 dark:text-indigo-400" />
                                AUM Context Foundry
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-8">
                                Strategic Generative Engine Optimization (GEO) for the agentic era.
                                Secure your narrative in the latent space with vector-verified facts.
                            </p>
                            <div className="flex space-x-4">
                                <Link href="/contact" className="px-4 py-2 bg-indigo-500/10 text-indigo-500 rounded-full text-xs font-semibold hover:bg-indigo-500/20 transition-all">
                                    hello@AUMDataLabs.com
                                </Link>
                                <a href="tel:+919080735297" className="px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-semibold hover:bg-emerald-500/20 transition-all">
                                    +91 9080735297
                                </a>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-6">Foundry</h4>
                            <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
                                <li><a href="#moat" className="hover:text-indigo-600 transition-colors">The Moat</a></li>
                                <li><a href="#features" className="hover:text-indigo-600 transition-colors">LCRS Math</a></li>
                                <li><Link href="/dashboard" className="hover:text-indigo-600 transition-colors">Dashboard</Link></li>
                                <li><Link href="/status" className="hover:text-indigo-600 transition-colors">System Status</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-6">Legal</h4>
                            <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
                                <li><Link href="/privacy" className="hover:text-indigo-600 transition-colors">Privacy Policy</Link></li>
                                <li><Link href="/terms" className="hover:text-indigo-600 transition-colors">Terms of Service</Link></li>
                                <li><Link href="/contact" className="hover:text-indigo-600 transition-colors">CISO Audits</Link></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 gap-4">
                        <p>&copy; 2025 AUM Data Labs. All rights reserved.</p>
                        <div className="flex space-x-8">
                            <span>Author: Sambath Kumar Natarajan</span>
                            <span className="flex items-center"><Globe className="w-3 h-3 mr-1" /> Global Edge Distribution</span>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    ); >
    );
}

// Icon helpers
function Sparkle(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
        </svg>
    )
}
function Activity(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    )
}
function CheckCircle2(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    )
}
