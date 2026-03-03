"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkle, Sun, Moon, Briefcase, Code2 } from 'lucide-react';
import { Logo } from './Logo';
import { usePersona } from './PersonaContext';

export default function Navbar() {
    const [mounted, setMounted] = useState(false);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const { persona, setPersona } = usePersona();

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
        <nav className="fixed top-0 left-0 right-0 z-[100] border-b border-white/5 bg-slate-950/50 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                <Link href="/" className="flex items-center group">
                    <Logo size={32} showText={true} theme="dark" />
                </Link>

                <div className="hidden md:flex items-center space-x-8">
                    <Link href="/methods" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Methods</Link>
                    <Link href="/security" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Security</Link>
                    <Link href="/#moat" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Platform</Link>
                </div>

                <div className="flex items-center space-x-6">
                    {/* Persona Toggle */}
                    <div className="hidden lg:flex items-center p-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10">
                        <button
                            onClick={() => setPersona('CMO')}
                            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${persona === 'CMO' ? 'bg-white dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <Briefcase className="w-3.5 h-3.5" />
                            <span>CMO</span>
                        </button>
                        <button
                            onClick={() => setPersona('CTO')}
                            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${persona === 'CTO' ? 'bg-white dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <Code2 className="w-3.5 h-3.5" />
                            <span>CTO</span>
                        </button>
                    </div>

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
