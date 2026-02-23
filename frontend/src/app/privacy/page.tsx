/**
 * Author: "Sambath Kumar Natarajan"
 * Org: "AUM Data Labs"
 * Product: "Context Foundry"
 */
"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#030303] text-slate-900 dark:text-slate-100 p-8 sm:p-24 font-sans leading-relaxed">
            <Link href="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 mb-12 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Link>

            <header className="max-w-3xl mb-16">
                <h1 className="text-4xl sm:text-5xl font-light tracking-tighter mb-6">Privacy Policy</h1>
                <p className="text-slate-500 dark:text-slate-400">Effective Date: December 26, 2025</p>
            </header>

            <main className="max-w-3xl space-y-12">
                <section>
                    <h2 className="text-2xl font-medium mb-4">1. Zero-Retention Commitment</h2>
                    <p className="text-slate-600 dark:text-slate-400">
                        At AUM Data Labs, your proprietary corporate data is processed using our <strong>Zero-Retention Processing</strong> model. PDF binaries are read into volatile RAM buffers, extracted for semantic JSON-LD structures, and immediately purged. We do not cache or store unstructured proprietary documents on disk.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-medium mb-4">2. Data We Collect</h2>
                    <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-400">
                        <li><strong>Account Information</strong>: Your email and organization profile for session management.</li>
                        <li><strong>Semantic Manifests</strong>: The generated <code>/llms.txt</code> results optimized for agentic discovery.</li>
                        <li><strong>LCRS Logs</strong>: Metadata regarding hallucination divergence scores to improve your GEO performance.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-medium mb-4">3. Multi-Tenant Isolation</h2>
                    <p className="text-slate-600 dark:text-slate-400">
                        Every business entity is sandboxed. Usage data and API keys provided for business-specific deployments are never leaked or shared across tenants.
                    </p>
                </section>

                <footer className="pt-12 border-t border-slate-200 dark:border-white/5">
                    <p className="text-sm text-slate-500">Contact legal@AUMDataLabs.com for inquiries.</p>
                </footer>
            </main>
        </div>
    );
}
