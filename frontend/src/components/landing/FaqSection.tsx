"use client";

export default function FaqSection() {
    return (
        <section id="faq" className="max-w-4xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/5">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-light tracking-tight text-slate-900 dark:text-white">Questions we actually get asked</h2>
            </div>
            <div className="space-y-6 text-left">
                <div className="p-6 rounded-2xl bg-white/50 dark:bg-[#0a0a0a]/50 border border-slate-200 dark:border-white/10 backdrop-blur-xl">
                    <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">What is a &quot;Buyer Query Simulation&quot;?</h4>
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                        A Buyer Query Simulation tests a single enterprise procurement question (e.g. &quot;Who are the top analytics firms for Fortune 500 retail transformation?&quot;) simultaneously across all three major model families. One simulation against OpenAI, Anthropic Claude, and Google Gemini builds your visibility score and surfaces which competitors are being recommended instead of you.
                    </p>
                </div>
                <div className="p-6 rounded-2xl bg-white/50 dark:bg-[#0a0a0a]/50 border border-slate-200 dark:border-white/10 backdrop-blur-xl">
                    <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Why does the free tier include all 3 models?</h4>
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                        Because a single-model score misses the key signal. The real insight is model variance. If OpenAI rates your brand at 91% and Anthropic Claude rates it at 47%, that gap identifies retrieval and grounding risk you need to fix.
                    </p>
                </div>
                <div className="p-6 rounded-2xl bg-white/50 dark:bg-[#0a0a0a]/50 border border-slate-200 dark:border-white/10 backdrop-blur-xl">
                    <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">What happens when I hit my simulation limit?</h4>
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                        Simulations pause with no overage billing. You&apos;ll get a dashboard warning at 80% usage, and your quota resets on your billing date.
                    </p>
                </div>
                <div className="p-6 rounded-2xl bg-white/50 dark:bg-[#0a0a0a]/50 border border-slate-200 dark:border-white/10 backdrop-blur-xl">
                    <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Is my uploaded data actually deleted?</h4>
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                        Yes. PDFs are read into volatile memory buffers, chunked, embedded into vectors, then purged from memory. We store the resulting JSON-LD schema, not your source document. Nothing proprietary touches persistent disk.
                    </p>
                </div>
                <div className="p-6 rounded-2xl bg-white/50 dark:bg-[#0a0a0a]/50 border border-slate-200 dark:border-white/10 backdrop-blur-xl">
                    <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">What&apos;s the difference between /llms.txt preview (Explorer) and deploy to edge (Growth+)?</h4>
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                        Preview shows you the generated manifest file. Deploy actually serves it at your verified endpoint so LLM crawlers can discover it. The preview is proof-of-concept; the deploy is the product working.
                    </p>
                </div>
            </div>
        </section>
    );
}
