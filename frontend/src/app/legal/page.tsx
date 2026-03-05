import { FileText, Shield, CreditCard, Box } from "lucide-react";

export const metadata = {
    title: "Legal & Policies | AUM Context Foundry",
    description: "Usage Policy, Terms and Conditions, and Refund Policy for AUM Context Foundry.",
};

export default function LegalPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-[#050505] selection:bg-cyan-500/30 font-sans">
            {/* Minimalist Hero */}
            <div className="pt-32 pb-20 px-6 sm:px-12 lg:px-24 max-w-7xl mx-auto border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center text-cyan-500 font-semibold tracking-wider uppercase text-sm mb-6">
                    <Shield className="w-4 h-4 mr-2" />
                    Legal & Compliance
                </div>
                <h1 className="text-4xl md:text-5xl font-light text-slate-900 dark:text-white mb-6">
                    Platform Policies
                </h1>
                <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 font-light max-w-3xl leading-relaxed">
                    Transparent guidelines on how AUM Context Foundry operates, manages data, and structures commercial agreements. Last updated: March 2026.
                </p>
            </div>

            {/* Content Body */}
            <div className="px-6 sm:px-12 lg:px-24 py-20 max-w-4xl mx-auto">

                {/* Usage Policy */}
                <section className="mb-20">
                    <div className="flex items-center mb-8">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mr-6 border border-slate-200 dark:border-white/10">
                            <FileText className="w-6 h-6 text-slate-700 dark:text-slate-300" />
                        </div>
                        <h2 className="text-3xl font-light text-slate-900 dark:text-white">Usage Policy (Terms & Conditions)</h2>
                    </div>

                    <div className="space-y-8 text-slate-600 dark:text-slate-300 leading-relaxed font-light">
                        <div>
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">1. Acceptance of Terms</h3>
                            <p>By accessing or using the AUM Context Foundry service (the "Service"), you agree to be bound by these Usage Policy terms.</p>
                        </div>

                        <div>
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">2. Data Ownership and Privacy</h3>
                            <p>You retain all ownership rights to the data you upload. We process your data solely to provide the Service, including LLM simulations, KPI computation, and visualization. We will never sell, share, or use your proprietary data for any purpose other than improving the Service and providing anonymous aggregated benchmarks. We employ a Zero-Retention pipeline for raw document ingestion.</p>
                        </div>

                        <div>
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">3. Service Scope</h3>
                            <p>The Service provides analytical tools and insights based on your input data. We offer no guarantees on the absolute accuracy of auto-generated insights, which are intended for diagnostic and guidance purposes only. You are solely responsible for actions taken based on the insights provided by the Service.</p>
                        </div>

                        <div>
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">4. Free Tier Limits</h3>
                            <p>The free Explorer Tier is limited to one (1) active user seat per organization and three (3) LCRS simulations per month. Upgrading to a paid commercial tier (Growth or Scale) is required to add more collaborative seats, API access, and higher compute limits.</p>
                        </div>

                        <div>
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">5. Prohibited Use</h3>
                            <p>You agree not to upload data that is illegal, contains sensitive personal health information (PHI), or financial account details not required for the Service. Do not use the service to verify claims regarding explicit, dangerous, or legally restricted domains.</p>
                        </div>
                    </div>
                </section>

                <hr className="border-slate-200 dark:border-white/5 mb-20" />

                {/* Refund Policy */}
                <section className="mb-20">
                    <div className="flex items-center mb-8">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mr-6 border border-slate-200 dark:border-white/10">
                            <CreditCard className="w-6 h-6 text-slate-700 dark:text-slate-300" />
                        </div>
                        <h2 className="text-3xl font-light text-slate-900 dark:text-white">Refund Policy (No Refunds)</h2>
                    </div>

                    <div className="space-y-6 text-slate-600 dark:text-slate-300 leading-relaxed font-light">
                        <p>
                            AUM Context Foundry operates on a monthly or annual B2B SaaS subscription model, granting immediate access to premium programmatic features, API keys, and elevated compute upon payment.
                        </p>
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                            All subscription fees, once paid, are non-refundable. We do not offer prorated refunds for cancellation mid-cycle.
                        </p>
                        <p>
                            Users are highly encouraged to utilize the Free Explorer Tier to fully evaluate the Service interface and capabilities before committing to a paid commercial subscription. You may cancel your subscription at any time via the billing portal, and access will continue seamlessly until the end of the paid billing period.
                        </p>
                    </div>
                </section>

                <hr className="border-slate-200 dark:border-white/5 mb-20" />

                {/* Shipping Policy */}
                <section>
                    <div className="flex items-center mb-8">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mr-6 border border-slate-200 dark:border-white/10">
                            <Box className="w-6 h-6 text-slate-700 dark:text-slate-300" />
                        </div>
                        <h2 className="text-3xl font-light text-slate-900 dark:text-white">Shipping Policy (Digital Only)</h2>
                    </div>

                    <div className="space-y-4 text-slate-600 dark:text-slate-300 leading-relaxed font-light">
                        <p>
                            AUM Context Foundry provides a cloud-based digital infrastructure service.
                        </p>
                        <p>
                            No physical goods, products, hardware, or printed materials are shipped. Upon subscription or feature access, delivery is immediate and electronic via your workspace dashboard and registered API keys.
                        </p>
                    </div>
                </section>

            </div>

            {/* Call to Action Footer */}
            <div className="bg-slate-50 dark:bg-[#0a0a0a] border-t border-slate-200 dark:border-white/5 py-24 text-center">
                <h2 className="text-2xl font-light text-slate-900 dark:text-white mb-6">Have compliance questions?</h2>
                <a
                    href="/contact"
                    className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                >
                    Contact Legal Team
                </a>
            </div>
        </div>
    );
}
