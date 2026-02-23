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
import { MessageSquare, X, Send, Bot, BookOpen, Shield, Key } from "lucide-react";
import { useOrganization } from "./OrganizationContext";
import { auth } from "../lib/firebase";

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
    const [messages, setMessages] = useState<Message[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const stored = sessionStorage.getItem('aum_chat_history');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                const hydrated = parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
                setMessages(hydrated);
            } catch (e) {
                console.error("Failed to parse chat history", e);
            }
        } else {
            setMessages([{
                id: "1",
                role: "bot",
                text: "Hello! I'm your AUM Assistant. How can I help you manage your context today?",
                timestamp: new Date()
            }]);
        }
        setIsInitialized(true);
    }, []);

    useEffect(() => {
        if (isInitialized) {
            sessionStorage.setItem('aum_chat_history', JSON.stringify(messages));
        }
    }, [messages, isInitialized]);
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

        setTimeout(() => {
            generateBotResponse(input.toLowerCase());
        }, 800);
    };

    const generateBotResponse = async (query: string) => {
        let response = "";
        const orgName = (organization && orgContext?.orgUser) ? organization.name : "your enterprise";

        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token || !organization?.id) {
                response = "Please authenticate and select an organization to use the AI Context Assistant.";
            } else {
                setMessages(prev => [...prev, { id: "loading", role: "bot", text: "Consulting your Context Moat...", timestamp: new Date() }]);

                const res = await fetch("/api/chatbot/ask", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        orgId: organization.id,
                        query: query,
                        chatHistory: messages.map(m => ({
                            id: m.id,
                            text: m.text,
                            sender: m.role,
                            timestamp: m.timestamp.toISOString()
                        }))
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    response = data.response;
                } else {
                    response = "I encountered an error querying your Context Engine. Please check your API keys.";
                }
            }
        } catch (error) {
            response = "Network error communicating with AUM Foundry.";
        }

        setMessages(prev => {
            const clean = prev.filter(m => m.id !== "loading");
            return [...clean, {
                id: Date.now().toString() + "-bot",
                role: "bot",
                text: response,
                timestamp: new Date()
            }];
        });
    };

    return (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[100] font-sans">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 w-[calc(100vw-2rem)] h-[calc(100vh-10rem)] max-h-[500px] sm:w-[360px] sm:h-[500px] rounded-[1.5rem] shadow-2xl flex flex-col overflow-hidden mb-4 relative"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-4 flex justify-between items-center text-white shrink-0">
                            <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
                                    <Bot className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-xs">AUM Assistant</span>
                                    <span className="text-[9px] opacity-70 uppercase tracking-widest">{organization && orgContext?.orgUser ? `${organization.name} Tenant` : 'Public Mode'}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors focus:ring-2 focus:ring-white/20 outline-none"
                                aria-label="Close Chat"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/20 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-xl text-[13px] ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-tr-none'
                                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 text-slate-800 dark:text-slate-200 rounded-tl-none shadow-sm'
                                        }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Quick Actions */}
                        <div className="px-4 py-2 flex space-x-2 overflow-x-auto no-scrollbar shrink-0 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900">
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
                        <div className="p-4 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 shrink-0">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                    placeholder="Ask for help..."
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 pl-3 pr-10 text-[13px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <button
                                    onClick={handleSend}
                                    className="absolute right-2 top-1.5 text-indigo-600 hover:text-indigo-700 p-1"
                                >
                                    <Send className="w-4 h-4" />
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
