/**
 * Author: "Sambath Kumar Natarajan"
 * Date: "26-Dec-2025"
 * Org: " Start-up/AUM Context Foundry"
 * Product: "AUM Context Foundry"
 * Description: Public Landing Page for AUM Context Foundry.
 */
"use client";

import { AnimatePresence } from "framer-motion";
import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useRazorpay } from "@/hooks/useRazorpay";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firestorePaths";
import { doc, getDoc } from "firebase/firestore";
import BrandHealthCertificate from "@/components/BrandHealthCertificate";

// --- MODULAR LANDING COMPONENTS ---
import LandingHero from "@/components/landing/LandingHero";
import MoatSection from "@/components/landing/MoatSection";
import FeaturesGrid from "@/components/landing/FeaturesGrid";
import ValueLoopSection from "@/components/landing/ValueLoopSection";
import EnterpriseStrip from "@/components/landing/EnterpriseStrip";
import ApiPlatformSection from "@/components/landing/ApiPlatformSection";
import PricingSection from "@/components/landing/PricingSection";
import BlogStrip from "@/components/landing/BlogStrip";
import FaqSection from "@/components/landing/FaqSection";

export default function LandingPage() {
    const [currency, setCurrency] = React.useState<'usd' | 'inr'>('usd');
    const [isUpgrading, setIsUpgrading] = React.useState<string | null>(null);
    const [isSampleReportOpen, setIsSampleReportOpen] = React.useState(false);
    const { checkout, isScriptLoading } = useRazorpay();

    React.useEffect(() => {
        const saved = localStorage.getItem('pricing-currency');
        if (saved === 'inr' || saved === 'usd') {
            setCurrency(saved as 'usd' | 'inr');
        }
    }, []);

    const toggleCurrency = () => {
        const next = currency === 'usd' ? 'inr' : 'usd';
        setCurrency(next);
        localStorage.setItem('pricing-currency', next);
    };

    const handleUpgradeFromLanding = async (planId: "growth" | "scale") => {
        try {
            setIsUpgrading(planId);
            const user = auth.currentUser;
            const selectedCurrency = currency === "inr" ? "INR" : "USD";
            if (!user || !user.email) {
                const redirect = encodeURIComponent(`/dashboard?upgrade=${planId}&currency=${selectedCurrency}`);
                window.location.href = `/login?redirect=${redirect}`;
                return;
            }

            const userDoc = await getDoc(doc(db, "users", user.uid));
            const orgId = userDoc.exists() ? userDoc.data()?.orgId : null;
            if (!orgId) {
                const redirect = encodeURIComponent(`/dashboard?upgrade=${planId}&currency=${selectedCurrency}`);
                window.location.href = `/login?redirect=${redirect}`;
                return;
            }

            await checkout(
                planId,
                orgId,
                user.email,
                selectedCurrency,
                () => window.location.assign("/dashboard"),
                () => setIsUpgrading(null)
            );
        } catch {
            setIsUpgrading(null);
            window.alert("Unable to start checkout from landing page. Please sign in and try again.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 font-sans overflow-x-hidden selection:bg-indigo-500/30 transition-colors duration-300">

            {/* Premium Background Gradients */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/10 dark:bg-indigo-600/10 blur-[130px] rounded-full"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-500/10 dark:bg-fuchsia-600/10 blur-[130px] rounded-full"></div>
                <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] bg-cyan-500/10 dark:bg-cyan-900/10 blur-[150px] rounded-full"></div>
            </div>

            <Navbar />

            <main className="relative z-10 pt-32 pb-20">
                <LandingHero onViewSampleReport={() => setIsSampleReportOpen(true)} />
                <MoatSection />
                <FeaturesGrid />
                <ValueLoopSection />
                <EnterpriseStrip />
                <ApiPlatformSection />
                <PricingSection 
                    currency={currency} 
                    onToggleCurrency={toggleCurrency} 
                    handleUpgrade={handleUpgradeFromLanding} 
                    isUpgrading={isUpgrading}
                    isScriptLoading={isScriptLoading}
                />
                <BlogStrip />
                <FaqSection />
            </main>
            
            <Footer />

            <AnimatePresence>
                {isSampleReportOpen && (
                    <BrandHealthCertificate
                        organizationName="DemoCorp Global"
                        asovScore={84.2}
                        driftRate={12}
                        onClose={() => setIsSampleReportOpen(false)}
                        modelResults={[
                            { model: "GPT-4o", accuracy: 92.4, hasHallucination: false, claimScore: "5/6 assertions visible" },
                            { model: "Gemini 3 Flash", accuracy: 81.5, hasHallucination: true, claimScore: "4/6 assertions visible" },
                            { model: "Claude 4.5 Sonnet", accuracy: 78.7, hasHallucination: false, claimScore: "3/6 assertions visible" }
                        ]}
                        lastPrompt="How does DemoCorp Global compare with Enterprise Rivals for AI transformation?"
                        competitors={[
                            { name: "Rival Solutions", displacementRate: 18, strengths: ["Mobile SDK", "Offline Support"], weaknesses: ["Enterprise Security"], winningCategory: "Developer Experience" },
                            { name: "Legacy Analytics", displacementRate: 4, strengths: ["Brand History"], weaknesses: ["Cloud Maturity"], winningCategory: "Market Longevity" }
                        ]}
                        activeContextName="Primary Brand Identity"
                        clusterInsights={[
                            {
                                prompt: "Best platform for AI transformation?",
                                category: "Market Leadership",
                                avgAccuracy: 88,
                                claimRecall: 0.83,
                                hallucinationCount: 0,
                                winnerModel: "GPT-4o",
                                weakestModel: "Claude 4.5 Sonnet",
                                observedOutcome: "Strong brand presence in 2/3 models.",
                                winningCompetitor: "None",
                                claimsOwned: ["Strategy Consulting", "Execution"],
                                missingClaims: ["Pricing Detail"]
                            }
                        ]}
                        remediationRecommendations={[
                            {
                                title: "Fix Security Signal Gap",
                                category: "Enterprise Trust",
                                observedOutcome: "Models miss SOC2 and PCI compliance claims.",
                                winningCompetitor: "Rival Solutions",
                                missingClaims: ["SOC2 Compliance", "PCI DSS"],
                                pageTargets: [{ label: "Security Page", reason: "Direct source for trust signals", url: "https://democorp.com/security" }],
                                copyBlock: "Add explicit SOC2 Type II seals and update the H1 to mention 'Bank-grade compliance' explicitly.",
                                schemaSuggestion: "Add 'accreditedBy' to Organization schema.",
                                faqSuggestion: "FAQ: Is DemoCorp SOC2 compliant?",
                                llmsSuggestion: "llms.txt: Add Security section."
                            }
                        ]}
                        allowPdfDownload={false}
                        onUpgradeRequired={() => {
                            window.location.href = "/login";
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
