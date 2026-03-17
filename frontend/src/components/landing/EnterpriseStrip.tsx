"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Lock, Cpu, Scale } from "lucide-react";

export default function EnterpriseStrip() {
    return (
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
        </section>
    );
}
