/**
 * Author: "Sambath Kumar Natarajan"
 * Date: "26-Dec-2025"
 * Org: " Start-up/AUM Data Labs"
 * Product: "Context Foundry"
 * Description: Contextual Support Chatbot for Multi-Tenant Enterprise Assistance.
 */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Bot, User, HelpCircle, BookOpen, Shield, Key } from "lucide-react";
import { useOrganization } from "./OrganizationContext";

interface Message {
    id: string;
    role: "user" | "bot";
    text: string;
    timestamp: Date;
}

export default function SupportChatbot() {
    const orgContext = useOrganization();
    const organization = orgContext?.organization;
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            role: "bot",
            text: `Hello! I'm your AUM Context Assistant. How can I help you ${organization ? `manage context for ${organization.name}` : 'explore AUM Context Foundry'} today?`,
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = () => {
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            text: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput("");

        // Simulated Contextual Response logic
        setTimeout(() => {
            generateBotResponse(input.toLowerCase());
        }, 800);
    };

    const generateBotResponse = (query: string) => {
        let response = "";
        const orgName = organization ? organization.name : "your enterprise";

        if (query.includes("onboard") || query.includes("add business") || query.includes("setup")) {
            response = `To onboard a new branch or sub-entity for ${orgName}, go to Team Settings > Organizations and click 'Provision New Moat'. Ensure you have /llms.txt ready for ingestion.`;
        } else if (query.includes("api key") || query.includes("gemini") || query.includes("openai") || query.includes("claude")) {
            response = `Context Foundry supports tenant-specific API keys for Gemini, Claude, and OpenAI. You can manage these in Team Settings > API Management. This ensures ${orgName}'s usage is isolated and billed correctly.`;
        } else if (query.includes("hallucination") || query.includes("lcrs") || query.includes("score")) {
            response = `The LCRS (Latent Contextual Rigor Scoring) calculates vector divergence ($d > \\epsilon_{div}$). If your score is above 0.45, we recommend refining your Context Manifest to reduce hallucination risk.`;
        } else if (query.includes("ingest") || query.includes("pdf") || query.includes("zero-retention")) {
            response = `Our ingestion engine is Zero-Retention. When you upload a PDF for ${orgName}, it is processed in volatile memory and instantly flushed after JSON-LD extraction to ensure data privacy.`;
        } else if (query.includes("offboard") || query.includes("delete")) {
            response = `To offboard an entity, an Admin must revoke its /llms.txt sync and archive the organization context in Settings. This permanently wipes the latent mapping.`;
        } else {
            response = `I'm monitoring the Context Foundry for ${orgName}. You can ask about Ingestion, LCRS Math, API Key Management, or Onboarding procedures.`;
        }

        const botMsg: Message = {
            id: Date.now().toString() + "-bot",
            role: "bot",
            text: response,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, botMsg]);
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] font-sans">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 w-[340px] h-[500px] sm:w-[380px] sm:h-[550px] rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden mb-4"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-4 sm:p-6 flex justify-between items-center text-white">
                            <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md text-white">
                                    <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-xs sm:text-sm">Context Assistant</span>
                                    <span className="text-[9px] sm:text-[10px] opacity-70 uppercase tracking-widest">{organization ? `${organization.name} Tenant` : 'Public Mode'}</span>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1.5 sm:p-2 rounded-full transition-colors">
                                <X className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-slate-950/20">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 sm:p-4 rounded-xl sm:rounded-2xl text-[13px] sm:text-sm ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-tr-none'
                                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 text-slate-800 dark:text-slate-200 rounded-tl-none shadow-sm'
                                        }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Quick Actions */}
                        <div className="px-6 py-2 flex space-x-2 overflow-x-auto no-scrollbar">
                            <button onClick={() => generateBotResponse("api key")} className="flex items-center shrink-0 px-3 py-1.5 bg-slate-100 dark:bg-white/5 rounded-full text-[10px] font-medium text-slate-500 hover:text-indigo-600 transition-colors">
                                <Key className="w-3 h-3 mr-1" /> API Keys
                            </button>
                            <button onClick={() => generateBotResponse("onboard")} className="flex items-center shrink-0 px-3 py-1.5 bg-slate-100 dark:bg-white/5 rounded-full text-[10px] font-medium text-slate-500 hover:text-indigo-600 transition-colors">
                                <BookOpen className="w-3 h-3 mr-1" /> Onboarding
                            </button>
                            <button onClick={() => generateBotResponse("lcrs")} className="flex items-center shrink-0 px-3 py-1.5 bg-slate-100 dark:bg-white/5 rounded-full text-[10px] font-medium text-slate-500 hover:text-indigo-600 transition-colors">
                                <Shield className="w-3 h-3 mr-1" /> Hallucination
                            </button>
                        </div>

                        {/* Input */}
                        <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                    placeholder="Ask for help..."
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg sm:rounded-xl py-2 sm:py-3 pl-3 sm:pl-4 pr-10 sm:pr-12 text-[13px] sm:text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <button
                                    onClick={handleSend}
                                    className="absolute right-2 sm:right-3 top-1.5 sm:top-2.5 text-indigo-600 hover:text-indigo-700 p-1"
                                >
                                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${isOpen ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white'
                    }`}
            >
                {isOpen ? <X className="w-7 h-7" /> : <MessageSquare className="w-7 h-7" />}
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 flex items-center justify-center text-[8px] font-bold">1</span>
                    </span>
                )}
            </motion.button>
        </div>
    );
}
