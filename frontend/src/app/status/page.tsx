/**
 * Author: "Sambath Kumar Natarajan"
 * Org: "AUM Data Labs"
 * Product: "Context Foundry"
 */
"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Activity, Globe, Zap, Shield } from "lucide-react";

export default function StatusPage() {
    const services = [
        { name: "LCRS Math Engine", status: "Operational", latency: "42ms" },
        { name: "Semantic Ingestion Engine", status: "Operational", latency: "1.2s" },
        { name: "Multi-Tenant Auth", status: "Operational", latency: "15ms" },
        { name: "Edge Manifest Delivery", status: "Operational", latency: "8ms" },
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#030303] text-slate-900 dark:text-slate-100 p-8 sm:p-24 font-sans">
            <Link href="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 mb-12 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Link>

            <header className="max-w-4xl mb-20 text-center mx-auto">
                <div className="inline-flex items-center space-x-2 bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-full text-sm font-medium mb-8">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>All Systems Operational</span>
                </div>
                <h1 className="text-5xl font-light tracking-tighter mb-4">System Status</h1>
                <p className="text-slate-500">Real-time performance metrics for AUM Context Foundry services.</p>
            </header>

            <main className="max-w-4xl mx-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 p-8 rounded-[2rem]">
                        <Activity className="w-8 h-8 text-indigo-500 mb-4" />
                        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-2">Network Health</h3>
                        <p className="text-3xl font-light">99.99% Uptime</p>
                    </div>
                    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 p-8 rounded-[2rem]">
                        <Zap className="w-8 h-8 text-cyan-500 mb-4" />
                        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-2">Global Latency</h3>
                        <p className="text-3xl font-light">18ms Average</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-[2.5rem] overflow-hidden">
                    <div className="p-8 border-b border-slate-100 dark:border-white/5">
                        <h2 className="text-xl font-medium">Service Components</h2>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {services.map((service) => (
                            <div key={service.name} className="p-8 flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                    <span className="font-medium">{service.name}</span>
                                </div>
                                <div className="flex items-center space-x-12">
                                    <span className="text-sm text-slate-500">{service.latency}</span>
                                    <span className="text-sm font-medium text-emerald-500">{service.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
