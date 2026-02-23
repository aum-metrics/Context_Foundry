/**
 * Author: "Sambath Kumar Natarajan"
 * Date: "26-Dec-2025"
 * Org: " Start-up/AUM Data Labs"
 * Product: "Context Foundry"
 * Description: Enterprise Contact Page.
 */
"use client";

import { motion } from "framer-motion";
import { Mail, Phone, MapPin, ArrowLeft } from "lucide-react";
import Link from "next/link";
import React from "react";

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-[#030303] text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500/30">
            <nav className="p-8">
                <Link href="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                </Link>
            </nav>

            <main className="max-w-4xl mx-auto px-6 pt-12 pb-24">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-20"
                >
                    <h1 className="text-5xl md:text-6xl font-light tracking-tighter mb-6">Get in Touch</h1>
                    <p className="text-xl text-slate-500 dark:text-slate-400 font-light max-w-2xl mx-auto">
                        Connect with AUM Data Labs for strategic audits, custom deployments, or enterprise support.
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-2 gap-12">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="space-y-8"
                    >
                        <div className="flex items-start bg-slate-50 dark:bg-white/5 p-8 rounded-3xl border border-slate-100 dark:border-white/5">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mr-6 shrink-0">
                                <Mail className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-2">Email</h3>
                                <a href="mailto:hello@AUMDataLabs.com" className="text-xl font-medium hover:text-indigo-600 transition-colors">
                                    hello@AUMDataLabs.com
                                </a>
                            </div>
                        </div>

                        <div className="flex items-start bg-slate-50 dark:bg-white/5 p-8 rounded-3xl border border-slate-100 dark:border-white/5">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mr-6 shrink-0">
                                <Phone className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-2">Phone</h3>
                                <a href="tel:+919080735297" className="text-xl font-medium hover:text-emerald-600 transition-colors">
                                    +91-9080735297
                                </a>
                            </div>
                        </div>

                        <div className="flex items-start bg-slate-50 dark:bg-white/5 p-8 rounded-3xl border border-slate-100 dark:border-white/5">
                            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center mr-6 shrink-0">
                                <MapPin className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-2">Headquarters</h3>
                                <p className="text-lg text-slate-700 dark:text-slate-300">
                                    AUM Data Labs<br />
                                    Chennai, Tamil Nadu, India
                                </p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-indigo-600 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-600/30"
                    >
                        <h2 className="text-3xl font-light mb-6">Partner with Us</h2>
                        <p className="opacity-80 leading-relaxed mb-8">
                            We are helping global leaders secure their narrative in the agentic web. Request a personalized strategic audit today.
                        </p>
                        <form className="space-y-4">
                            <input
                                type="text"
                                placeholder="Full Name"
                                className="w-full bg-white/10 border border-white/20 rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all placeholder:text-white/40"
                            />
                            <input
                                type="email"
                                placeholder="Business Email"
                                className="w-full bg-white/10 border border-white/20 rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all placeholder:text-white/40"
                            />
                            <textarea
                                placeholder="Strategic Goals"
                                rows={4}
                                className="w-full bg-white/10 border border-white/20 rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all placeholder:text-white/40"
                            ></textarea>
                            <button className="w-full bg-white text-indigo-600 font-semibold py-4 rounded-xl hover:bg-slate-100 transition-colors">
                                Dispatch Request
                            </button>
                        </form>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
