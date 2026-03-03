"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sun, Moon } from 'lucide-react';
import { Logo } from './Logo';

export default function Navbar() {
    const [mounted, setMounted] = useState(false);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');

    useEffect(() => {
        setMounted(true);
        const savedTheme = localStorage.getItem('aum_theme') as 'dark' | 'light' || 'dark';
        setTheme(savedTheme);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('aum_theme', newTheme);
        document.documentElement.classList.toggle('dark');
    };

    if (!mounted) return null;

    return (
        <nav className="fixed top-0 left-0 right-0 z-[100] border-b border-slate-200/10 dark:border-white/5 bg-white/80 dark:bg-slate-950/50 backdrop-blur-xl transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                <Link href="/" className="flex items-center group">
                    <Logo size={32} showText={true} theme="auto" />
                </Link>

                <div className="hidden md:flex items-center space-x-8">
                    <Link href="/methods" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-colors">For Engineering</Link>
                    <Link href="/security" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-colors">Security Architecture</Link>
                    <Link href="/#moat" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-colors">Platform</Link>
                </div>

                <div className="flex items-center space-x-6">

                    <button onClick={toggleTheme} className="p-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-colors">
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
