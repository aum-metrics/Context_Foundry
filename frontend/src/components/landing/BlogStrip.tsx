"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function BlogStrip() {
    return (
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
                        category: "AI Search",
                        title: "AI Search Readiness",
                        description: "Why AI search readiness is not just SEO with a new label, and where measurement belongs in the operating loop.",
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
    );
}
