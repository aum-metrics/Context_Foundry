/**
 * Author: "Sambath Kumar Natarajan"
 * Date: "26-Dec-2025"
 * Org: " Start-up/AUM Context Foundry"
 * Product: "AUM Context Foundry"
 * Description: Public Landing Page for AUM Context Foundry.
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ShieldCheck, Cpu, Lock, BarChart3, Binary, Scale, Sparkles as Sparkle, Activity, CheckCircle2, Crosshair, AlertTriangle } from "lucide-react";
import Link from "next/link";
import React from "react";
import ProductFlowShowcase from "@/components/ProductDemoVideo";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useRazorpay } from "@/hooks/useRazorpay";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firestorePaths";
import { doc, getDoc } from "firebase/firestore";
import BrandHealthCertificate from "@/components/BrandHealthCertificate";

export default function LandingPage() {
    const [currency, setCurrency] = React.useState<'usd' | 'inr'>('usd');
    const [isUpgrading, setIsUpgrading] = React.useState<string | null>(null);
    const [isSampleReportOpen, setIsSampleReportOpen] = React.useState(false);
    const { checkout, isScriptLoading } = useRazorpay();

    React.useEffect(() => {
        const saved = localStorage.getItem('pricing-currency');
        if (saved === 'inr' || saved === 'usd') {
            setCurrency(saved as 'usd' | 'inr');
        }
    }, []);

    const toggleCurrency = () => {
        const next = currency === 'usd' ? 'inr' : 'usd';
        setCurrency(next);
        localStorage.setItem('pricing-currency', next);
    };

    const handleUpgradeFromLanding = async (planId: "growth" | "scale") => {
        try {
            setIsUpgrading(planId);
            const user = auth.currentUser;
            const selectedCurrency = currency === "inr" ? "INR" : "USD";
            if (!user || !user.email) {
                const redirect = encodeURIComponent(`/dashboard?upgrade=${planId}&currency=${selectedCurrency}`);
                window.location.href = `/login?redirect=${redirect}`;
                return;
            }

            const userDoc = await getDoc(doc(db, "users", user.uid));
            const orgId = userDoc.exists() ? userDoc.data()?.orgId : null;
            if (!orgId) {
                const redirect = encodeURIComponent(`/dashboard?upgrade=${planId}&currency=${selectedCurrency}`);
                window.location.href = `/login?redirect=${redirect}`;
                return;
            }

            await checkout(
                planId,
                orgId,
                user.email,
                selectedCurrency,
                () => window.location.assign("/dashboard"),
                () => setIsUpgrading(null)
            );
        } catch {
            setIsUpgrading(null);
            window.alert("Unable to start checkout from landing page. Please sign in and try again.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 font-sans overflow-x-hidden selection:bg-indigo-500/30 transition-colors duration-300">

            {/* Premium Background Gradients */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/10 dark:bg-indigo-600/10 blur-[130px] rounded-full"></div>
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
                                Industry forecasts indicate that by 2028, over <strong className="font-semibold text-slate-800 dark:text-slate-200">60% of B2B sales work</strong> will be driven by generative AI interfaces.
                            </span>
                            <span className="block mt-2">
                                AUM ensures OpenAI, Anthropic Claude, and Google Gemini <span className="text-emerald-600 dark:text-emerald-400 font-medium">recommend your firm first</span> — so enterprise buyers shortlist you, not a competitor, when they ask an AI for the best vendor.
                            </span>
                            <p className="text-xs text-slate-500 dark:text-slate-500 italic mt-4">
                                [1] Gartner. "Future of Sales" (2024 Prediction).
                            </p>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6"
                    >
                        <Link href="/login" className="w-full sm:w-auto px-10 py-5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center transition-all shadow-2xl shadow-indigo-600/30 hover:shadow-indigo-600/50 transform hover:-translate-y-1 glow-indigo scale-110">
                            Start Private Audit <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <button 
                            onClick={() => setIsSampleReportOpen(true)}
                            className="w-full sm:w-auto px-10 py-5 rounded-full bg-white/10 dark:bg-white/5 backdrop-blur-xl text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 font-bold flex items-center justify-center hover:bg-white/20 dark:hover:bg-white/10 transition-all shadow-xl"
                        >
                            View Sample Executive Report
                        </button>
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
                                <strong>Track your Share of Model (SoM).</strong> We run enterprise buyer queries across AI engines, rank how often your firm is shortlisted over competitors, and prescribe exactly what to change to reclaim those queries.
                            </p>
                            <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed mb-8 font-light">
                                Stop losing pipeline to competitors favoured by AI. Get the exact positioning gaps — with confidence scores — so your marketing team can close them this sprint.
                            </p>

                            <div className="space-y-4">
                                <div className="flex items-start">
                                    <div className="mt-1 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center mr-4 shrink-0">
                                        <Crosshair className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-900 dark:text-white">Competitor Benchmarking</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">See exactly when and why GPT-4o, Gemini 3 Flash, or Claude 4.5 Sonnet recommend your competitors instead of you.</p>
                                    </div>
                                </div>
                                <div className="flex items-start">
                                    <div className="mt-1 w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center mr-4 shrink-0">
                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-900 dark:text-white">Competitive Displacement Alerts</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Get pinged when GPT-4o, Gemini, or Claude shortlist a named competitor instead of you for a buyer query in your category.</p>
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
                                    {['OpenAI', 'Anthropic Claude', 'Google Gemini'].map((model, i) => (
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
                                <Link href="/methods">SoM Scoring Engine</Link>
                            </h4>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6 font-light">
                                Our <strong>Share of Model (SoM)</strong> engine runs enterprise buyer queries across AI models and scores how often your firm is shortlisted, with gap confidence bars and estimated SoM recovery per fix.
                            </p>
                            <div className="font-mono text-[10px] bg-slate-100 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200 dark:border-white/5 text-slate-500 dark:text-indigo-300/60 leading-relaxed">
                                SoM% = visible_assertions / total_buyer_assertions × 100
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
                                <li className="flex items-center"><CheckCircle2 className="w-3 h-3 mr-2" /> Audit Trail Included</li>
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
                    <div className="text-center mb-20 px-6">
                        <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-6 uppercase">The AUM Value Loop</h2>
                        <p className="text-xl text-slate-500 max-w-2xl mx-auto font-light leading-relaxed">
                            Watch the actual product flow, then review the four-step operating loop underneath. This makes the workflow concrete before a user signs in.
                        </p>
                    </div>

                    <div className="max-w-6xl mx-auto mb-12 rounded-[2.5rem] border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-[#0a0a0a]/80 backdrop-blur-2xl shadow-xl dark:shadow-none overflow-hidden">
                        <div className="grid lg:grid-cols-[1.35fr_0.65fr] gap-0">
                            <div className="bg-slate-950">
                                <video
                                    className="w-full h-full min-h-[320px] md:min-h-[520px] object-cover"
                                    controls
                                    preload="metadata"
                                    playsInline
                                    poster="/demo-thumbnail.jpg"
                                >
                                    <source src="/AUM%20Context%20Foundry-%20Demo.mp4" type="video/mp4" />
                                    Your browser does not support embedded video.
                                </video>
                            </div>
                            <div className="p-8 md:p-10 flex flex-col justify-center">
                                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600 dark:text-indigo-400 mb-4">
                                    Watch Demo
                                </p>
                                <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white mb-4">
                                    See ingestion, simulation, scoring, and report generation in one pass
                                </h3>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                                    The embedded walkthrough shows the actual user path: ingest source material, run multi-model checks across GPT-4o, Gemini 3 Flash, and Claude 4.5 Sonnet, inspect drift, and export the buyer-facing report.
                                </p>
                                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                                    <div className="flex items-start">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-3 mt-0.5 shrink-0" />
                                        <span>Real product walkthrough, not a marketing animation.</span>
                                    </div>
                                    <div className="flex items-start">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-3 mt-0.5 shrink-0" />
                                        <span>Covers the core workflow a new evaluator needs to understand quickly.</span>
                                    </div>
                                    <div className="flex items-start">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-3 mt-0.5 shrink-0" />
                                        <span>Keeps the sales page understandable before a prospect enters the product.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <ProductFlowShowcase />
                </section>

                {/* Trust & Capabilities Strip */}
                <section className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/5">
                    <div className="text-center mb-16">
                        <h2 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] mb-4">Built for Enterprise</h2>
                        <h3 className="text-4xl md:text-5xl font-light tracking-tight text-slate-900 dark:text-white">Production-Grade Infrastructure</h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { metric: '3', label: 'LLM Providers', sub: 'OpenAI · Anthropic Claude · Google Gemini', cls: 'text-indigo-600 dark:text-indigo-400' },
                            { metric: '☁️', label: 'Cloud-Native', sub: 'Google Cloud Run (Asia)', cls: 'text-emerald-600 dark:text-emerald-400' },
                            { metric: '3x', label: 'Multi-Model', sub: 'Parallel LLM queries', cls: 'text-cyan-600 dark:text-cyan-400' },
                            { metric: '🔒', label: 'Zero-Retention', sub: 'No raw data stored', cls: 'text-fuchsia-600 dark:text-fuchsia-400' },
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
                    <div className="flex flex-col lg:flex-row items-center gap-20">
                        <div className="lg:w-1/2">
                            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-8 text-slate-900 dark:text-white leading-[0.9]">
                                The Verified Identity Router
                            </h2>
                            <p className="text-lg font-light text-slate-600 dark:text-slate-400 mb-10 leading-relaxed max-w-xl">
                                AUM is not just a dashboard; it is core B2B data infrastructure. We provide the REST API layer that enterprise SEO and PR platforms license to bring Agentic Search insights directly into their native workflows.
                            </p>

                            <div className="space-y-8">
                                <div className="flex gap-6 group">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-mono text-lg group-hover:scale-110 transition-transform">01</div>
                                    <div>
                                        <h3 className="text-lg font-bold uppercase tracking-tight text-slate-900 dark:text-white mb-2">Zero-Retention Ingestion Webhooks</h3>
                                        <p className="text-sm font-light text-slate-500 dark:text-slate-400 leading-relaxed">Programmatically send proprietary corporate PDFs to our secure API. We flush from memory instantly and return perfectly structured semantic vectors.</p>
                                    </div>
                                </div>
                                <div className="flex gap-6 group">
                                    <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 font-mono text-lg group-hover:scale-110 transition-transform">02</div>
                                    <div>
                                        <h3 className="text-lg font-bold uppercase tracking-tight text-slate-900 dark:text-white mb-2">Live Competitive Positioning Scores</h3>
                                        <p className="text-sm font-light text-slate-500 dark:text-slate-400 leading-relaxed">Pull real-time Share of Model (SoM) scores showing how often your firm is recommended over named competitors across OpenAI, Anthropic Claude, and Google Gemini — power your own analytics dashboards.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:w-1/2 w-full">
                            <div className="bg-slate-900 rounded-3xl p-8 border border-white/10 shadow-2xl relative group overflow-hidden">
                                <div className="absolute top-0 right-0 p-4">
                                    <div className="flex gap-2">
                                        <div className="w-3 h-3 rounded-full bg-rose-500/50" />
                                        <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                                        <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
                                    </div>
                                </div>

                                <div className="font-mono text-sm space-y-6">
                                    <div>
                                        <div className="text-slate-500 mb-2 uppercase tracking-widest text-[10px] font-bold">POST /api/simulation/v1/run</div>
                                        <div className="text-emerald-400 whitespace-pre overflow-x-auto">
                                            {`curl -X POST https://api.aumcontextfoundry.com/api/simulation/v1/run \\
-H "Authorization: Bearer aum_..." \\
-d {
  "orgId": "org_2F3a...",
  "prompt": "How does this firm compare with Accenture, Tiger Analytics, Fractal, and Mu Sigma for enterprise AI and analytics transformation?",
  "manifestVersion": "latest"
}`}
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-white/5">
                                        <div className="text-slate-500 mb-2 uppercase tracking-widest text-[10px] font-bold">Response 200 OK</div>
                                        <div className="text-indigo-400 whitespace-pre overflow-x-auto">
                                            {`{
  "results": [
    {
      "model": "gpt-4o",
      "accuracy": 92.4,
      "status": "strong_presence",
      "hasHallucination": false,
      "claimScore": "5/6 assertions visible to enterprise buyers",
      "metrics": {
        "semantic_divergence": 0.076,
        "claim_recall": 0.833
      }
    }
  ],
  "prompt": "How does this firm compare with Accenture for enterprise AI?",
  "version": "latest"
}`}
                                        </div>
                                    </div>
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

                        {/* Currency Toggle */}
                        <div className="flex items-center justify-center gap-4 mt-8">
                            <span className={`text-sm font-medium ${currency === 'inr' ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>USD</span>
                            <button
                                onClick={toggleCurrency}
                                className="px-4 py-2 rounded-full border border-indigo-600 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-medium text-sm transition-all hover:scale-105 active:scale-95"
                            >
                                {currency === 'inr' ? '🇮🇳 INR' : '🇺🇸 USD'} ({currency === 'inr' ? '₹' : '$'})
                            </button>
                            <span className={`text-sm font-medium ${currency === 'inr' ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>INR</span>
                        </div>
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
                                <span className="text-4xl font-light tracking-tighter text-slate-900 dark:text-white">One Free Report</span>
                            </div>
                            <ul className="space-y-3 mb-10 flex-1 text-sm text-slate-600 dark:text-slate-400">
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> <strong className="text-slate-900 dark:text-white">1</strong>{" "}simulation run (all 3 models, so users see real value)</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> 1 document ingestion</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Basic SoM score</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> <code>/llms.txt</code>{" "}preview</li>
                                <li className="flex items-start text-slate-400 dark:text-slate-500"><CheckCircle2 className="w-4 h-4 mr-2.5 mt-0.5 shrink-0" /> No scoring history</li>
                                <li className="flex items-start text-slate-400 dark:text-slate-500"><CheckCircle2 className="w-4 h-4 mr-2.5 mt-0.5 shrink-0" /> No team seats</li>
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
                                <span className="text-5xl font-light tracking-tighter text-slate-900 dark:text-white">{currency === 'inr' ? '₹6,499' : '$79'}</span>
                                <span className="text-slate-500 font-medium ml-2">/mo</span>
                            </div>
                            <ul className="space-y-3 mb-10 flex-1 text-sm text-slate-600 dark:text-slate-400">
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-indigo-500 mr-2.5 mt-0.5 shrink-0" /> <strong className="text-slate-900 dark:text-white">100</strong>{" "}simulations/month</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Unlimited document ingestion</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Full Share of Model dashboard</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Download <code>/llms.txt</code>{" "}manifest</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Up to 5 seats</li>
                            </ul>
                            <button
                                type="button"
                                onClick={() => handleUpgradeFromLanding("growth")}
                                disabled={isScriptLoading || isUpgrading === "growth"}
                                className="block w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-center transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transform hover:-translate-y-0.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isUpgrading === "growth" ? "Starting Checkout..." : "Upgrade to Growth"}
                            </button>
                            <p className="text-center text-xs text-slate-400 mt-4">Cancel anytime.</p>
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
                                <p className="text-sm text-slate-500">For enterprise teams running multi-context, multi-competitor programs.</p>
                            </div>
                            <div className="flex items-baseline mb-8">
                                <span className="text-5xl font-light tracking-tighter text-slate-900 dark:text-white">{currency === 'inr' ? '₹20,999' : '$249'}</span>
                                <span className="text-slate-500 font-medium ml-2">/mo</span>
                            </div>
                            <ul className="space-y-3 mb-10 flex-1 text-sm text-slate-600 dark:text-slate-400">
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> <strong className="text-slate-900 dark:text-white">500</strong>{" "}simulations/month</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Everything in Growth</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Competitor tracking</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> White-labeled exports</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> <strong className="text-slate-900 dark:text-white">25</strong>{" "}team seats included</li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Agency SLA</li>
                            </ul>
                            <button
                                type="button"
                                onClick={() => handleUpgradeFromLanding("scale")}
                                disabled={isScriptLoading || isUpgrading === "scale"}
                                className="block w-full py-3.5 rounded-xl border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 font-medium text-center hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isUpgrading === "scale" ? "Starting Checkout..." : "Upgrade to Scale"}
                            </button>
                            <p className="text-center text-xs text-slate-400 mt-4">Custom Agency SLA available.</p>
                        </motion.div>
                    </div>
                </section>

                <section className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/5">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600 dark:text-indigo-400 mb-4">
                                SEO Content Layer
                            </p>
                            <h2 className="text-3xl md:text-4xl font-light tracking-tight text-slate-900 dark:text-white">
                                Research pages built around the same problems the product measures
                            </h2>
                        </div>
                        <Link
                            href="/blog"
                            className="inline-flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                        >
                            Read all insights <ArrowRight className="w-4 h-4 ml-2" />
                        </Link>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                href: "/blog/brand-safety-in-llms",
                                category: "Brand Fidelity",
                                title: "Brand Safety in LLMs",
                                description: "How answer systems misstate, omit, or displace your approved narrative even when the output sounds polished.",
                            },
                            {
                                href: "/blog/fixing-ai-hallucinations-for-healthcare",
                                category: "Healthcare AI",
                                title: "Fixing AI Hallucinations for Healthcare",
                                description: "A concrete workflow for turning healthcare claims into verifiable, machine-readable ground truth.",
                            },
                            {
                                href: "/blog/generative-engine-optimization-geo",
                                category: "GEO",
                                title: "Generative Engine Optimization (GEO)",
                                description: "Why GEO is not just SEO with a new label, and where measurement belongs in the operating loop.",
                            },
                        ].map((article) => (
                            <Link
                                key={article.href}
                                href={article.href}
                                className="rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-[#0a0a0a]/80 backdrop-blur-2xl p-8 shadow-xl dark:shadow-none hover:-translate-y-0.5 transition-transform"
                            >
                                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400 mb-4">
                                    {article.category}
                                </p>
                                <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
                                    {article.title}
                                </h3>
                                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                    {article.description}
                                </p>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* FAQs */}
                <section id="faq" className="max-w-4xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/5">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-light tracking-tight text-slate-900 dark:text-white">Questions we actually get asked</h2>
                    </div>
                    <div className="space-y-6 text-left">
                        <div className="p-6 rounded-2xl bg-white/50 dark:bg-[#0a0a0a]/50 border border-slate-200 dark:border-white/10 backdrop-blur-xl">
                            <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">What is a &quot;Buyer Query Simulation&quot;?</h4>
                            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                A Buyer Query Simulation tests a single enterprise procurement question (e.g. &quot;Who are the top analytics firms for Fortune 500 retail transformation?&quot;) simultaneously across all three major model families. One simulation against OpenAI, Anthropic Claude, and Google Gemini builds your Share of Model score and surfaces which competitors are being recommended instead of you.
                            </p>
                        </div>
                        <div className="p-6 rounded-2xl bg-white/50 dark:bg-[#0a0a0a]/50 border border-slate-200 dark:border-white/10 backdrop-blur-xl">
                            <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Why does the free tier include all 3 models?</h4>
                            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                Because a single-model score misses the key signal. The real insight is model variance. If OpenAI rates your brand at 91% and Anthropic Claude rates it at 47%, that gap identifies retrieval and grounding risk you need to fix.
                            </p>
                        </div>
                        <div className="p-6 rounded-2xl bg-white/50 dark:bg-[#0a0a0a]/50 border border-slate-200 dark:border-white/10 backdrop-blur-xl">
                            <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">What happens when I hit my simulation limit?</h4>
                            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                Simulations pause with no overage billing. You&apos;ll get a dashboard warning at 80% usage, and your quota resets on your billing date.
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

            <AnimatePresence>
                {isSampleReportOpen && (
                    <BrandHealthCertificate
                        organizationName="DemoCorp Global"
                        asovScore={84.2}
                        driftRate={12}
                        onClose={() => setIsSampleReportOpen(false)}
                        modelResults={[
                            { model: "GPT-4o", accuracy: 92.4, hasHallucination: false, claimScore: "5/6 assertions visible" },
                            { model: "Gemini 3 Flash", accuracy: 81.5, hasHallucination: true, claimScore: "4/6 assertions visible" },
                            { model: "Claude 4.5 Sonnet", accuracy: 78.7, hasHallucination: false, claimScore: "3/6 assertions visible" }
                        ]}
                        lastPrompt="How does DemoCorp Global compare with Enterprise Rivals for AI transformation?"
                        competitors={[
                            { name: "Rival Solutions", displacementRate: 18, strengths: ["Mobile SDK", "Offline Support"], weaknesses: ["Enterprise Security"], winningCategory: "Developer Experience" },
                            { name: "Legacy Analytics", displacementRate: 4, strengths: ["Brand History"], weaknesses: ["Cloud Maturity"], winningCategory: "Market Longevity" }
                        ]}
                        activeContextName="Primary Brand Identity"
                        clusterInsights={[
                            {
                                prompt: "Best platform for AI transformation?",
                                category: "Market Leadership",
                                avgAccuracy: 88,
                                claimRecall: 0.83,
                                hallucinationCount: 0,
                                winnerModel: "GPT-4o",
                                weakestModel: "Claude 4.5 Sonnet",
                                observedOutcome: "Strong brand presence in 2/3 models.",
                                winningCompetitor: "None",
                                claimsOwned: ["Strategy Consulting", "Execution"],
                                missingClaims: ["Pricing Detail"]
                            }
                        ]}
                        remediationRecommendations={[
                            {
                                title: "Fix Security Signal Gap",
                                category: "Enterprise Trust",
                                observedOutcome: "Models miss SOC2 and PCI compliance claims.",
                                winningCompetitor: "Rival Solutions",
                                missingClaims: ["SOC2 Compliance", "PCI DSS"],
                                pageTargets: [{ label: "Security Page", reason: "Direct source for trust signals", url: "https://democorp.com/security" }],
                                copyBlock: "Add explicit SOC2 Type II seals and update the H1 to mention 'Bank-grade compliance' explicitly.",
                                schemaSuggestion: "Add 'accreditedBy' to Organization schema.",
                                faqSuggestion: "FAQ: Is DemoCorp SOC2 compliant?",
                                llmsSuggestion: "llms.txt: Add Security section."
                            }
                        ]}
                        allowPdfDownload={true}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
