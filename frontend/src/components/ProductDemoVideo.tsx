"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Database, ArrowRight, CheckCircle2, Shield, Activity, FileText, Globe } from 'lucide-react';

export default function ProductFlowShowcase() {
    const [currentStep, setCurrentStep] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    const steps = [
        {
            id: 0,
            title: "Semantic Ingestion",
            subtitle: "Convert messy corporate PDFs into verified ground-truth.",
            icon: Database,
            tag: "The Input",
            outputLabel: "Verified Manifest (JSON-LD)",
            outputDetail: "Zero-retention distillation of product specs, pricing, and claims.",
            accent: "emerald",
            preview: (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <FileText className="w-5 h-5 text-emerald-500" />
                        <div className="flex-1">
                            <div className="h-1.5 w-24 bg-emerald-500/40 rounded-full mb-1"></div>
                            <div className="h-1 w-32 bg-emerald-500/20 rounded-full"></div>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="font-mono text-[10px] p-4 bg-black/40 rounded-xl border border-white/5 text-emerald-400/70">
                        {`{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Sight Spectrum",
  "url": "https://sightspectrum.com",
  "description": "Enterprise AI & Cloud Transformation Solutions"
}
`}
                    </div>
                </div>
            )
        },
        {
            id: 1,
            title: "Narrative Simulation",
            subtitle: "Stress-test ChatGPT, Claude, and Gemini for Context Drift.",
            icon: Search,
            tag: "The Process",
            outputLabel: "Drift Analysis Log",
            outputDetail: "Detecting where AI hallucinations deviate from your manifest.",
            accent: "indigo",
            preview: (
                <div className="space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-mono text-indigo-400">
                        <span>PROBE: "What are Sight Spectrum's AI capabilities?"</span>
                        <span className="animate-pulse">RUNNING...</span>
                    </div>
                    <div className="space-y-2">
                        {[
                            { name: 'GPT-4o', score: 92, status: 'Fidelity' },
                            { name: 'Claude 3.5', score: 45, status: 'Drift' },
                            { name: 'Gemini 2', score: 88, status: 'Fidelity' }
                        ].map((m) => (
                            <div key={m.name} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
                                <div className="text-[9px] w-16">{m.name}</div>
                                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div className={`h-full bg-${m.status === 'Fidelity' ? 'indigo' : 'emerald'}-500`} style={{ width: `${m.score}%` }}></div>
                                </div>
                                <div className={`text-[9px] text-${m.status === 'Fidelity' ? 'indigo' : 'rose'}-400 font-bold`}>{m.score}%</div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        },
        {
            id: 2,
            title: "Global ASoV Dashboard",
            subtitle: "Centralized intelligence for your Brand Fidelity.",
            icon: Activity,
            tag: "The Result",
            outputLabel: "Agentic Share of Voice Index",
            outputDetail: "Real-time auditing of how the AI ecosystem represents you.",
            accent: "cyan",
            preview: (
                <div className="relative aspect-video rounded-xl bg-slate-900 border border-white/10 overflow-hidden p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div className="h-4 w-24 bg-white/10 rounded"></div>
                        <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500/50"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></div>
                        </div>
                    </div>
                    <div className="flex items-end gap-2 h-24">
                        {[60, 40, 85, 30, 95, 55, 80].map((h, i) => (
                            <div key={i} className="flex-1 bg-cyan-500/20 rounded-t-sm border-t border-cyan-500/40" style={{ height: `${h}%` }}></div>
                        ))}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="p-2 rounded bg-white/5 border border-white/5">
                            <div className="text-[8px] text-slate-500 uppercase">Avg ASoV</div>
                            <div className="text-sm font-bold text-cyan-400">84.2%</div>
                        </div>
                        <div className="p-2 rounded bg-white/5 border border-white/5">
                            <div className="text-[8px] text-slate-500 uppercase">Drift Alert</div>
                            <div className="text-sm font-bold text-rose-400">Critical</div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 3,
            title: "Direct-to-Edge Correction",
            subtitle: "Serve the corrected facts directly to AI crawlers.",
            icon: Globe,
            tag: "The Output",
            outputLabel: "/llms.txt Provisioning",
            outputDetail: "Corrected narrative pushed to the Agentic SEO layer.",
            accent: "fuchsia",
            preview: (
                <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/20">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-mono text-fuchsia-400">DEPLOYMENT STATUS</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[8px] font-bold">LIVE</span>
                        </div>
                        <div className="space-y-2">
                            <div className="h-1.5 w-full bg-fuchsia-500/20 rounded-full"></div>
                            <div className="h-1.5 w-4/5 bg-fuchsia-500/20 rounded-full"></div>
                            <div className="h-1.5 w-3/4 bg-fuchsia-500/20 rounded-full"></div>
                        </div>
                    </div>
                    <button className="w-full py-2 rounded-lg bg-fuchsia-600/20 border border-fuchsia-500/30 text-fuchsia-300 text-[10px] font-bold uppercase tracking-widest hover:bg-fuchsia-600/30 transition-colors">
                        View llms.txt at Edge
                    </button>
                </div>
            )
        }
    ];

    useEffect(() => {
        if (isHovered) return;
        const interval = setInterval(() => {
            setCurrentStep((prev) => (prev + 1) % steps.length);
        }, 6000);
        return () => clearInterval(interval);
    }, [isHovered, steps.length]);

    return (
        <div
            className="w-full max-w-7xl mx-auto flex flex-col items-center px-4"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Context Header */}
            <div className="w-full flex justify-between items-center mb-8 px-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Platform Status</p>
                        <p className="text-xs text-slate-900 dark:text-white font-medium">Viewing as: <span className="text-indigo-500">internal-audit@sightspectrum.com</span></p>
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-6">
                    <div className="flex flex-col items-end">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Current Cycle</p>
                        <p className="text-xs text-slate-900 dark:text-white font-medium text-right">Current Audit Cycle</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
                {/* Left: Interactive Navigation */}
                <div className="lg:col-span-4 flex flex-col gap-3">
                    {steps.map((step, idx) => (
                        <button
                            key={step.id}
                            onClick={() => setCurrentStep(idx)}
                            className={`p-6 rounded-2xl border text-left transition-all duration-300 group relative overflow-hidden ${currentStep === idx
                                ? `bg-${step.accent}-500/5 border-${step.accent}-500/30 shadow-lg`
                                : "bg-white/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10"
                                }`}
                        >
                            {currentStep === idx && (
                                <motion.div
                                    layoutId="step-indicator"
                                    className={`absolute left-0 top-0 bottom-0 w-1 bg-${step.accent}-500`}
                                />
                            )}
                            <div className="flex items-start gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${currentStep === idx
                                    ? `bg-${step.accent}-500/20 text-${step.accent}-500`
                                    : "bg-slate-100 dark:bg-white/5 text-slate-400"
                                    }`}>
                                    <step.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${currentStep === idx ? `text-${step.accent}-500` : "text-slate-400"}`}>
                                        {step.tag}
                                    </p>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{step.title}</h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight pr-4">
                                        {step.subtitle}
                                    </p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Right: Output Display */}
                <div className="lg:col-span-8 relative">
                    <div className="h-full rounded-[2.5rem] border border-slate-200/50 dark:border-white/10 bg-[#0a0a0a] overflow-hidden shadow-2xl relative flex flex-col">
                        {/* Browser Header Bar */}
                        <div className="h-10 px-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <div className="flex space-x-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/40"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40"></div>
                            </div>
                            <div className="px-4 py-1 rounded bg-white/5 border border-white/5 text-[10px] font-mono text-slate-500 w-64 text-center">
                                aumcontextfoundry.com/platform
                            </div>
                            <div className="w-10"></div>
                        </div>

                        <div className="flex-1 p-8 md:p-12 flex flex-col lg:flex-row items-center gap-12">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentStep}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.5 }}
                                    className="w-full lg:w-1/2"
                                >
                                    <div className="mb-8">
                                        <h3 className={`text-2xl md:text-3xl font-black text-white mb-4 uppercase tracking-tighter`}>
                                            {steps[currentStep].outputLabel}
                                        </h3>
                                        <p className="text-slate-400 text-sm md:text-base leading-relaxed font-light">
                                            {steps[currentStep].outputDetail}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4 py-6 border-t border-white/5">
                                        <div className={`w-2 h-2 rounded-full bg-${steps[currentStep].accent}-500`}></div>
                                        <p className={`text-[10px] font-bold uppercase tracking-[0.2em] text-${steps[currentStep].accent}-500`}>
                                            Real-Time Generation Active
                                        </p>
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={`preview-${currentStep}`}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.5 }}
                                    className="w-full lg:w-1/2"
                                >
                                    <div className="glass-morphism p-2 rounded-2xl border border-white/5 bg-white/[0.01]">
                                        {steps[currentStep].preview}
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Navigation Arrows */}
                    <div className="absolute top-1/2 -translate-y-1/2 -left-4 hidden lg:flex">
                        <button
                            onClick={() => setCurrentStep((prev) => (prev - 1 + steps.length) % steps.length)}
                            className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-xl hover:bg-slate-50 transition-all transform hover:scale-110"
                        >
                            <ArrowRight className="w-5 h-5 rotate-180" />
                        </button>
                    </div>
                    <div className="absolute top-1/2 -translate-y-1/2 -right-4 hidden lg:flex">
                        <button
                            onClick={() => setCurrentStep((prev) => (prev + 1) % steps.length)}
                            className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-xl hover:bg-slate-50 transition-all transform hover:scale-110"
                        >
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Platform Trust Strip */}
            <div className="mt-16 w-full py-8 border-t border-slate-200 dark:border-white/5 flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">NIST AI RMF</span>
                </div>
                <div className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Zero-Retention Buffer</span>
                </div>
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Auditable Logic</span>
                </div>
            </div>
        </div>
    );
}
