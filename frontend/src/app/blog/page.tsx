import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
    title: "Insights | AUM Context Foundry",
    description: "Practical guidance on brand fidelity, AI hallucination control, and Generative Engine Optimization for enterprise teams.",
    alternates: {
        canonical: "/blog",
    },
};

const posts = [
    {
        href: "/blog/brand-safety-in-llms",
        category: "Brand Fidelity",
        title: "Brand Safety in LLMs",
        description: "What brand safety means once buyers ask GPT-4o, Gemini 3 Flash, and Claude 4.5 Sonnet to summarize your business.",
    },
    {
        href: "/blog/fixing-ai-hallucinations-for-healthcare",
        category: "Healthcare AI",
        title: "Fixing AI Hallucinations for Healthcare",
        description: "A practical workflow for reducing unsafe omission, fabrication, and narrative drift in healthcare-facing AI answers.",
    },
    {
        href: "/blog/generative-engine-optimization-geo",
        category: "GEO",
        title: "Generative Engine Optimization (GEO)",
        description: "How GEO differs from classic SEO, why manifest alignment matters, and where measurement actually belongs.",
    },
];

export default function BlogIndexPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200">
            <Navbar />
            <main className="pt-32 pb-24">
                <section className="max-w-6xl mx-auto px-6 mb-16">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600 dark:text-indigo-400 mb-4">
                        AUM Insights
                    </p>
                    <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white mb-6">
                        High-fidelity content for teams dealing with AI search risk
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
                        These articles are tightly aligned to what the product actually measures: brand safety, hallucination control, manifest quality, and Generative Engine Optimization.
                    </p>
                </section>

                <section className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-6">
                    {posts.map((post) => (
                        <Link
                            key={post.href}
                            href={post.href}
                            className="rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-8 shadow-sm hover:shadow-lg transition-shadow"
                        >
                            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400 mb-4">
                                {post.category}
                            </p>
                            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-4">
                                {post.title}
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                {post.description}
                            </p>
                        </Link>
                    ))}
                </section>
            </main>
            <Footer />
        </div>
    );
}
