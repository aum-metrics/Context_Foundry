"use client";

import { CheckCircle2 } from "lucide-react";
import ProductFlowShowcase from "@/components/ProductDemoVideo";

export default function ValueLoopSection() {
    return (
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
    );
}
