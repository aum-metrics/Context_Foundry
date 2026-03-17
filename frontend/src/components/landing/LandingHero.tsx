"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles as Sparkle } from "lucide-react";
import Link from "next/link";
import QuickScan from "@/components/QuickScan";

interface LandingHeroProps {
    onViewSampleReport: () => void;
}

export default function LandingHero({ onViewSampleReport }: LandingHeroProps) {
    return (
        <section className="max-w-7xl mx-auto px-6 pt-24 pb-32 flex flex-col items-center text-center">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center space-x-2 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest mb-10 border border-indigo-200/50 dark:border-indigo-500/20 backdrop-blur-sm shadow-[0_0_30px_rgba(99,102,241,0.1)] dark:shadow-[0_0_30px_rgba(99,102,241,0.2)]"
            >
                <Sparkle className="w-3.5 h-3.5" />
                <span>AI Search Presence</span>
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
                    <span className="block text-slate-800 dark:text-slate-200 font-medium">
                        Find out which competitor AI recommends instead of you — and fix it.
                    </span>
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
                    onClick={onViewSampleReport}
                    className="w-full sm:w-auto px-10 py-5 rounded-full bg-white/10 dark:bg-white/5 backdrop-blur-xl text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 font-bold flex items-center justify-center hover:bg-white/20 dark:hover:bg-white/10 transition-all shadow-xl"
                >
                    View Sample Executive Report
                </button>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.45 }}
                className="mt-10 w-full max-w-2xl"
            >
                <QuickScan />
            </motion.div>
        </section>
    );
}
