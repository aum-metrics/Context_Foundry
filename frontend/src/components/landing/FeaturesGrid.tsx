"use client";

import { motion } from "framer-motion";
import { Binary, Lock, BarChart3, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function FeaturesGrid() {
    return (
        <section id="features" className="max-w-7xl mx-auto px-6 py-32 border-t border-slate-200 dark:border-white/5 relative overflow-hidden">
            {/* Animated background element for this section */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="text-center mb-20 relative z-10">
                <h2 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] mb-4 text-center">Proprietary Technical Moats</h2>
                <h3 className="text-4xl md:text-5xl font-light tracking-tight text-slate-900 dark:text-white text-center">Engineering the Future of Fact.</h3>
            </div>

            <div className="grid md:grid-cols-3 gap-12 relative z-10">
                {/* Moat 1: Visibility Scoring */}
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
                        <Link href="/methods">Visibility Scoring Engine</Link>
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6 font-light">
                        Our <strong>AI Recommendation Share</strong> engine runs enterprise buyer queries across AI models and scores how often your firm is shortlisted, with gap confidence bars and estimated recovery per fix.
                    </p>
                    <div className="font-mono text-[10px] bg-slate-100 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200 dark:border-white/5 text-slate-500 dark:text-indigo-300/60 leading-relaxed">
                        Visibility% = visible_assertions / total_buyer_assertions × 100
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

                {/* Moat 3: AI Visibility */}
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
                        <Link href="/methods">AI Visibility Indexing</Link>
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6 font-light">
                        Move beyond clicks. <strong>AI Visibility</strong> measures how often and how accurately your brand is cited by LLMs during competitive purchasing simulations.
                    </p>
                    <div className="flex items-center space-x-2">
                        <span className="px-3 py-1 bg-cyan-500/10 text-cyan-500 rounded-full text-[10px] uppercase font-bold tracking-widest">Moat Factor: 1.8x</span>
                        <span className="px-3 py-1 bg-indigo-500/10 text-indigo-500 rounded-full text-[10px] uppercase font-bold tracking-widest">Visibility Delta+</span>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
