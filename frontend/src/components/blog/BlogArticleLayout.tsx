import Link from "next/link";
import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type RelatedLink = {
    href: string;
    label: string;
};

type BlogArticleLayoutProps = {
    eyebrow: string;
    title: string;
    description: string;
    published: string;
    readTime: string;
    children: React.ReactNode;
    relatedLinks: RelatedLink[];
    schema: Record<string, unknown>;
};

export default function BlogArticleLayout({
    eyebrow,
    title,
    description,
    published,
    readTime,
    children,
    relatedLinks,
    schema,
}: BlogArticleLayoutProps) {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />
            <Navbar />
            <main className="pt-32 pb-24">
                <article className="max-w-4xl mx-auto px-6">
                    <div className="mb-12">
                        <Link
                            href="/blog"
                            className="inline-flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 mb-8"
                        >
                            Back to Insights
                        </Link>
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400 mb-5">
                            {eyebrow}
                        </p>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white leading-tight mb-6">
                            {title}
                        </h1>
                        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 font-light leading-relaxed max-w-3xl mb-6">
                            {description}
                        </p>
                        <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
                            <span>Published {published}</span>
                            <span>•</span>
                            <span>{readTime}</span>
                        </div>
                    </div>

                    <div className="prose prose-slate prose-lg max-w-none dark:prose-invert prose-headings:font-black prose-headings:tracking-tight prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-strong:text-slate-900 dark:prose-strong:text-white prose-li:marker:text-indigo-500">
                        {children}
                    </div>

                    <section className="mt-16 rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-8">
                        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-4">
                            Continue the workflow
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            These pages are useful only if they connect back to a measurement loop. Use the product surfaces below to validate the narrative, detect drift, and publish the corrected machine-readable context.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            {relatedLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="rounded-full border border-slate-300 dark:border-white/10 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </section>
                </article>
            </main>
            <Footer />
        </div>
    );
}
