"use client";

import React from 'react';
import Link from 'next/link';
import { Logo } from './Logo';

export default function Footer() {
    return (
        <footer className="border-t border-white/5 bg-[#050505] py-20 px-6">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
                <div className="max-w-xs">
                    <Link href="/" className="inline-block mb-6">
                        <Logo size={28} showText={true} theme="dark" />
                    </Link>
                    <p className="text-sm text-gray-500 leading-relaxed">
                        The "Smoke Detector" for narrative drift. Ensuring enterprise brand fidelity in the agentic era.
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
                    <div>
                        <h4 className="font-bold text-white mb-6 text-sm uppercase tracking-widest">Platform</h4>
                        <ul className="space-y-4 text-sm text-gray-500">
                            <li><Link href="/methods" className="hover:text-white transition-colors">For Engineering</Link></li>
                            <li><Link href="/security" className="hover:text-white transition-colors">Security Architecture</Link></li>
                            <li><Link href="/blog" className="hover:text-white transition-colors">Insights</Link></li>
                            <li><Link href="/#pricing" className="hover:text-white transition-colors">Enterprise Plans</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-6 text-sm uppercase tracking-widest">Company</h4>
                        <ul className="space-y-4 text-sm text-gray-500">
                            <li><Link href="/about" className="hover:text-white">About</Link></li>
                            <li><Link href="/contact" className="hover:text-white">Contact Sales</Link></li>
                            <li><Link href="/legal" className="hover:text-white">Legal Docs</Link></li>
                        </ul>
                    </div>
                </div>
            </div>
            <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-white/5 flex justify-between items-center">
                <p className="text-xs text-gray-600">© 2026 AUM CONTEXT FOUNDRY. All rights reserved.</p>
                <div className="flex space-x-6">
                    <Link href="/privacy" className="text-xs text-gray-600 hover:text-white">Privacy Policy</Link>
                    <Link href="/terms" className="text-xs text-gray-600 hover:text-white">Terms of Service</Link>
                </div>
            </div>
        </footer>
    );
}
