"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkle, Sun, Moon } from 'lucide-react';
import { Logo } from './Logo';

export default function Navbar() {
    const [mounted, setMounted] = useState(false);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');

    useEffect(() => {
        setMounted(true);
        const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' || 'dark';
        setTheme(savedTheme);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.classList.toggle('dark');
    };

    if (!mounted) return null;

    return (
        <nav className="fixed top-0 left-0 right-0 z-[100] border-b border-white/5 bg-slate-950/50 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                <Link href="/" className="flex items-center space-x-3 group">
                    <Logo size={32} />
                    <span className="font-bold text-xl tracking-tighter text-white">
                        AUM <span className="text-blue-500">CONTEXT</span>
                    </span>
                </Link>

                <div className="hidden md:flex items-center space-x-8">
                    <Link href="/methods" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Methods</Link>
                    <Link href="/security" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Security</Link>
                    <Link href="/#moat" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Platform</Link>
                </div>

                <div className="flex items-center space-x-6">
                    <button onClick={toggleTheme} className="p-2 text-slate-400 hover:text-white transition-colors">
                        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                    <Link href="/login" className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all transform hover:scale-105">
                        Sign In
                    </Link>
                </div>
            </div>
        </nav>
    );
}
