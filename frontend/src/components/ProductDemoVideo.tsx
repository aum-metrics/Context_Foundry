"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Search, Database } from 'lucide-react';
import Image from 'next/image';
import { Logo } from './Logo';

export default function ProductDemoVideo() {
    const [currentStep, setCurrentStep] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    const steps = [
        {
            id: 0,
            title: "Global ASoV Dashboard",
            subtitle: "Track your latent space penetration against frontier models.",
            icon: Logo,
            image: "/mockups/dashboard.png"
        },
        {
            id: 1,
            title: "Semantic Ingestion Engine",
            subtitle: "Extract structure from noisy PDFs and corporate docs.",
            icon: Database,
            image: "/mockups/ingestion.png"
        },
        {
            id: 2,
            title: "Co-Intelligence Simulator",
            subtitle: "Stress-test prompts for hallucination and divergence.",
            icon: Search,
            image: "/mockups/simulator.png"
        }
    ];

    useEffect(() => {
        if (isHovered) return;
        const interval = setInterval(() => {
            setCurrentStep((prev) => (prev + 1) % steps.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [isHovered, steps.length]);

    return (
        <div
            className="w-full max-w-6xl mx-auto flex flex-col items-center"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >

            {/* Main Display Area */}
            <div className="relative w-full aspect-[16/9] md:aspect-[21/9] rounded-2xl md:rounded-[2rem] border border-slate-200/50 dark:border-white/10 bg-[#0a0a0a] overflow-hidden shadow-2xl group transition-all duration-500 hover:shadow-[0_0_50px_rgba(99,102,241,0.15)]">

                <AnimatePresence mode="popLayout">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="absolute inset-0"
                    >
                        <Image
                            src={steps[currentStep].image}
                            alt={steps[currentStep].title}
                            fill
                            className="object-cover object-top opacity-90 transition-transform duration-[10s] group-hover:scale-105"
                            priority
                        />
                    </motion.div>
                </AnimatePresence>

                {/* Gradient Overlays for readability */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0a0a0a] to-transparent opacity-90"></div>

                {/* Floating UI Elements */}
                <div className="absolute top-6 left-6 flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                </div>

                <div className="absolute bottom-10 left-10 md:bottom-12 md:left-12 max-w-lg z-10 font-sans">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`text-${currentStep}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                        >
                            <div className="inline-flex items-center space-x-2 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-4 border border-indigo-500/30 backdrop-blur-md">
                                {React.createElement(steps[currentStep].icon, { className: "w-3.5 h-3.5" })}
                                <span>Platform View</span>
                            </div>
                            <h3 className="text-2xl md:text-3xl font-medium text-white mb-2 tracking-tight">
                                {steps[currentStep].title}
                            </h3>
                            <p className="text-slate-300 text-sm md:text-base">
                                {steps[currentStep].subtitle}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Manual Navigation Controls */}
            <div className="flex space-x-3 mt-8">
                {steps.map((step, idx) => (
                    <button
                        key={idx}
                        onClick={() => setCurrentStep(idx)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${currentStep === idx
                            ? "w-12 bg-indigo-500"
                            : "w-4 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600"
                            }`}
                        aria-label={`View ${step.title}`}
                    />
                ))}
            </div>

        </div>
    );
}
