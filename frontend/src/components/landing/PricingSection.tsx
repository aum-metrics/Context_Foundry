"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface PricingSectionProps {
    currency: 'usd' | 'inr';
    onToggleCurrency: () => void;
    handleUpgrade: (planId: "growth" | "scale") => void;
    isUpgrading: string | null;
    isScriptLoading: boolean;
}

export default function PricingSection({
    currency,
    onToggleCurrency,
    handleUpgrade,
    isUpgrading,
    isScriptLoading
}: PricingSectionProps) {
    return (
        <section id="pricing" className="max-w-7xl mx-auto px-6 py-32 border-t border-slate-200 dark:border-white/5">
            <div className="text-center mb-20">
                <h2 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] mb-4">Transparent Pricing</h2>
                <h3 className="text-4xl md:text-5xl font-light tracking-tight text-slate-900 dark:text-white">Choose Your AI Search Strategy</h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mt-4 font-light">All plans include zero-retention data processing and multi-tenant isolation.</p>

                {/* Currency Toggle */}
                <div className="flex items-center justify-center gap-4 mt-8">
                    <span className={`text-sm font-medium ${currency === 'inr' ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>USD</span>
                    <button
                        onClick={onToggleCurrency}
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
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> <strong className="text-slate-900 dark:text-white">1</strong> simulation run</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> 1 document ingestion</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Basic visibility score</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> <code>/llms.txt</code> preview</li>
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
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-indigo-500 mr-2.5 mt-0.5 shrink-0" /> <strong className="text-slate-900 dark:text-white">100</strong> simulations/month</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Unlimited document ingestion</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Full visibility dashboard</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Download <code>/llms.txt</code> manifest</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Up to 5 seats</li>
                    </ul>
                    <button
                        type="button"
                        onClick={() => handleUpgrade("growth")}
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
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> <strong className="text-slate-900 dark:text-white">500</strong> simulations/month</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Everything in Growth</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Competitor tracking</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> White-labeled exports</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> <strong className="text-slate-900 dark:text-white">25</strong> team seats included</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2.5 mt-0.5 shrink-0" /> Agency SLA</li>
                    </ul>
                    <button
                        type="button"
                        onClick={() => handleUpgrade("scale")}
                        disabled={isScriptLoading || isUpgrading === "scale"}
                        className="block w-full py-3.5 rounded-xl border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 font-medium text-center hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isUpgrading === "scale" ? "Starting Checkout..." : "Upgrade to Scale"}
                    </button>
                    <p className="text-center text-xs text-slate-400 mt-4">Custom Agency SLA available.</p>
                </motion.div>
            </div>
        </section>
    );
}
