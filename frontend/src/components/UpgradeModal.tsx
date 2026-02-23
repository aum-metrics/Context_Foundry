import { useState } from "react";
import { useOrganization } from "./OrganizationContext";
import { useRazorpay } from "@/hooks/useRazorpay";
import { X, CheckCircle, Zap, ShieldCheck, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "./Logo";

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    featureHighlight?: string;
}

export function UpgradeModal({ isOpen, onClose, featureHighlight = "Premium Features" }: UpgradeModalProps) {
    const { organization, orgUser } = useOrganization();
    const { checkout, isScriptLoading } = useRazorpay();
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const handleUpgrade = () => {
        if (!orgUser || !organization) return;
        setIsProcessing(true);
        checkout(
            "growth",
            organization.id,
            orgUser.email,
            () => window.location.reload(), // Success callback
            () => setIsProcessing(false)    // Failure callback
        );
    };

    const isButtonDisabled = isScriptLoading || isProcessing;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={!isProcessing ? onClose : undefined}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden"
                    >
                        {/* Header Gradient */}
                        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 opacity-10 dark:opacity-20" />

                        {/* Close Button */}
                        {!isProcessing && (
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors z-10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}

                        <div className="p-8 relative z-10">
                            {/* Icon & Title */}
                            <div className="flex items-center justify-center mb-6">
                                <Logo size={64} showText={false} />
                            </div>

                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                                Unlock {featureHighlight}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8">
                                You're currently on the Starter plan. Upgrade to the Growth plan to unlock the full power of AUM Context Foundry.
                            </p>

                            {/* Features List */}
                            <div className="space-y-4 mb-8">
                                <div className="flex items-start">
                                    <Cpu className="w-5 h-5 text-indigo-500 mr-3 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-slate-900 dark:text-white">Full Multi-Model Access</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Unlock GPT-4o Mini and Claude 3.5 Haiku alongside Gemini for holistic synthesis.</p>
                                    </div>
                                </div>
                                <div className="flex items-start">
                                    <ShieldCheck className="w-5 h-5 text-emerald-500 mr-3 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-slate-900 dark:text-white">SEO & GEO Readiness Audits</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Simulate brand recall and optimization scores against major AI search tools.</p>
                                    </div>
                                </div>
                                <div className="flex items-start">
                                    <CheckCircle className="w-5 h-5 text-purple-500 mr-3 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-slate-900 dark:text-white">10x Simulation Capacity</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Bump your usage limit from 50 to 500 simulations every billing cycle.</p>
                                    </div>
                                </div>
                            </div>

                            {/* CTA / Price */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-100 dark:border-white/5 flex items-center justify-between mb-6">
                                <div>
                                    <p className="text-sm text-slate-500 font-medium mb-1">Growth Plan</p>
                                    <div className="flex items-baseline space-x-1">
                                        <span className="text-2xl font-bold text-slate-900 dark:text-white">₹25,000</span>
                                        <span className="text-slate-500 text-sm">/mo</span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleUpgrade}
                                    disabled={isButtonDisabled}
                                    className={`relative overflow-hidden px-6 py-3 rounded-lg font-medium text-white transition-all ${isButtonDisabled
                                        ? "bg-indigo-400 cursor-not-allowed"
                                        : "bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40"
                                        }`}
                                >
                                    {isProcessing ? "Processing..." : isScriptLoading ? "Loading Secure Checkout..." : "Pay with Razorpay"}
                                </button>
                            </div>

                            <p className="text-center text-xs text-slate-400">
                                Secured by Razorpay. You can cancel your subscription at any time.
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
