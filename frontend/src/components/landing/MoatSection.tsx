"use client";

import { motion } from "framer-motion";
import { Crosshair, AlertTriangle, Activity } from "lucide-react";

export default function MoatSection() {
    return (
        <section id="moat" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/5">
            <div className="grid md:grid-cols-2 gap-16 items-center">
                <div>
                    <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-6">
                        Drive Pipeline with <span className="font-semibold text-emerald-600 dark:text-emerald-400">AI Search Presence</span>
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed mb-8 font-light">
                        <strong>Track your AI Recommendation Share.</strong> We run enterprise buyer queries across AI engines, rank how often your firm is shortlisted over competitors, and prescribe exactly what to change to reclaim those queries.
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
                                AI Visibility Index
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
    );
}
