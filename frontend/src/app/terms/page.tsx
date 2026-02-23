/**
 * Author: "Sambath Kumar Natarajan"
 * Org: "AUM Data Labs"
 * Product: "Context Foundry"
 */
"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#030303] text-slate-900 dark:text-slate-100 p-8 sm:p-24 font-sans leading-relaxed">
            <Link href="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 mb-12 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Link>

            <header className="max-w-3xl mb-16">
                <h1 className="text-4xl sm:text-5xl font-light tracking-tighter mb-6">Terms of Service</h1>
                <p className="text-slate-500 dark:text-slate-400">Last Updated: December 26, 2025</p>
            </header>

            <main className="max-w-3xl space-y-12">
                <section>
                    <h2 className="text-2xl font-medium mb-4">1. Acceptance of Terms</h2>
                    <p className="text-slate-600 dark:text-slate-400">
                        By accessing AUM Context Foundry, you agree to govern your agentic presence according to these terms.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-medium mb-4">2. Agentic Integrity</h2>
                    <p className="text-slate-600 dark:text-slate-400">
                        Users must not use the LCRS engine to intentionally generate deceptive latent-space signals. We empower enterprises to be **factually accurate**, not synthetically dominant.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-medium mb-4">3. Professional Tier Constraints</h2>
                    <p className="text-slate-600 dark:text-slate-400">
                        Standard professional accounts are limited to 25 seats per organization. Enterprise audits require a custom strategic partnership agreement.
                    </p>
                </section>

                <footer className="pt-12 border-t border-slate-200 dark:border-white/5">
                    <p className="text-sm text-slate-500">&copy; 2025 AUM Data Labs. All rights reserved.</p>
                </footer>
            </main>
        </div>
    );
}
