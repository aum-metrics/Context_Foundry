"use client";

export default function ApiPlatformSection() {
    return (
        <section id="api" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/5">
            <div className="flex flex-col lg:flex-row items-center gap-20">
                <div className="lg:w-1/2">
                    <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-8 text-slate-900 dark:text-white leading-[0.9]">
                        The Verified Identity Router
                    </h2>
                    <p className="text-lg font-light text-slate-600 dark:text-slate-400 mb-10 leading-relaxed max-w-xl">
                        AUM is not just a dashboard; it is core B2B data infrastructure. We provide the REST API layer that enterprise SEO and PR platforms license to bring AI search presence insights directly into their native workflows.
                    </p>

                    <div className="space-y-8">
                        <div className="flex gap-6 group">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-mono text-lg group-hover:scale-110 transition-transform">01</div>
                            <div>
                                <h3 className="text-lg font-bold uppercase tracking-tight text-slate-900 dark:text-white mb-2">Zero-Retention Ingestion Webhooks</h3>
                                <p className="text-sm font-light text-slate-500 dark:text-slate-400 leading-relaxed">Programmatically send proprietary corporate PDFs to our secure API. We flush from memory instantly and return perfectly structured semantic vectors.</p>
                            </div>
                        </div>
                        <div className="flex gap-6 group">
                            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 font-mono text-lg group-hover:scale-110 transition-transform">02</div>
                            <div>
                                <h3 className="text-lg font-bold uppercase tracking-tight text-slate-900 dark:text-white mb-2">Live Competitive Positioning Scores</h3>
                                <p className="text-sm font-light text-slate-500 dark:text-slate-400 leading-relaxed">Pull real-time AI Recommendation Share scores showing how often your firm is recommended over named competitors across OpenAI, Anthropic Claude, and Google Gemini — power your own analytics dashboards.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:w-1/2 w-full">
                    <div className="bg-slate-900 rounded-3xl p-8 border border-white/10 shadow-2xl relative group overflow-hidden">
                        <div className="absolute top-0 right-0 p-4">
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-rose-500/50" />
                                <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                                <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
                            </div>
                        </div>

                        <div className="font-mono text-sm space-y-6">
                            <div>
                                <div className="text-slate-500 mb-2 uppercase tracking-widest text-[10px] font-bold">POST /api/simulation/v1/run</div>
                                <div className="text-emerald-400 whitespace-pre overflow-x-auto">
                                    {`curl -X POST https://api.aumcontextfoundry.com/api/simulation/v1/run \\
-H "Authorization: Bearer aum_..." \\
-d {
  "orgId": "org_2F3a...",
  "prompt": "How does this firm compare with Accenture, Fractal, and Mu Sigma for enterprise AI and analytics transformation?",
  "manifestVersion": "latest"
}`}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/5">
                                <div className="text-slate-500 mb-2 uppercase tracking-widest text-[10px] font-bold">Response 200 OK</div>
                                <div className="text-indigo-400 whitespace-pre overflow-x-auto">
                                    {`{
  "results": [
    {
      "model": "gpt-4o",
      "accuracy": 92.4,
      "status": "strong_presence",
      "hasHallucination": false,
      "claimScore": "5/6 assertions visible to enterprise buyers",
      "metrics": {
        "semantic_divergence": 0.076,
        "claim_recall": 0.833
      }
    }
  ],
  "prompt": "How does this firm compare with Accenture for enterprise AI?",
  "version": "latest"
}`}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
