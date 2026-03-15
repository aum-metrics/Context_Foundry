import { TrendingUp, ShieldAlert } from "lucide-react";
import type { QueryClusterInsight } from "@/types/som";

export default function QueryClusterInsights({
    loading,
    insights,
}: {
    loading: boolean;
    insights: QueryClusterInsight[];
}) {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-end">
                <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-400">Buyer-Intent Clusters</h3>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest italic leading-none">Scanned across GPT, Claude & Gemini</span>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {loading ? (
                    Array(4).fill(0).map((_, i) => (
                        <div key={i} className="animate-pulse bg-slate-100 dark:bg-slate-800/40 h-48 rounded-2xl w-full"></div>
                    ))
                ) : insights.map((insight) => (
                    <div key={insight.prompt} className={`rounded-2xl border p-6 transition-all hover:shadow-lg ${insight.avgAccuracy < 55 ? 'border-rose-200 dark:border-rose-500/20 bg-rose-50/20' : 'border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-bold text-slate-500 uppercase tracking-widest">{insight.category}</div>
                            <div className="text-right">
                                <p className={`text-2xl font-bold leading-none ${insight.avgAccuracy >= 80 ? 'text-emerald-500' : insight.avgAccuracy >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>{insight.avgAccuracy}%</p>
                                <p className="text-[9px] text-slate-400 uppercase font-bold mt-1 tracking-tighter">Share of Model</p>
                            </div>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2 leading-relaxed">&ldquo;{insight.prompt}&rdquo;</h4>
                        <p className="text-xs text-slate-500 mb-4 line-clamp-2">{insight.observedOutcome}</p>
                        <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-1.5 text-slate-400">
                                <TrendingUp className="w-3 h-3" />
                                Winner: <span className="text-slate-700 dark:text-slate-200 font-bold">{insight.winnerModel}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-rose-500">
                                <ShieldAlert className="w-3 h-3" />
                                Losing to: <span className="font-bold">{insight.winningCompetitor}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
