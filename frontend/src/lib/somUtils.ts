export const FALLBACK_MODEL_ORDER: string[] = ["GPT-4o", "Gemini 3 Flash", "Claude 4.5 Sonnet"];

export function normalizeModelName(model: string): string {
    const raw = (model || "").trim();
    const lowered = raw.toLowerCase();
    if (lowered.startsWith("gpt-4o")) return "GPT-4o";
    if (lowered.includes("gemini") && lowered.includes("flash")) return "Gemini 3 Flash";
    if (lowered.includes("claude") && (lowered.includes("sonnet") || lowered.includes("haiku"))) return "Claude 4.5 Sonnet";
    return raw;
}

export function parseClaimRecallPercent(claimScore?: string): number | null {
    if (!claimScore) return null;
    const ratioMatch = claimScore.match(/(\d+)\s*\/\s*(\d+)/);
    if (!ratioMatch) return null;
    const supported = Number(ratioMatch[1]);
    const total = Number(ratioMatch[2]);
    if (!Number.isFinite(supported) || !Number.isFinite(total) || total <= 0) return null;
    return Math.max(0, Math.min(100, Math.round((supported / total) * 100)));
}

export function clampPct(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
}

export function averageAccuracy(results: { accuracy: number }[]): number {
    if (!results.length) return 0;
    return Math.round(results.reduce((sum, result) => sum + (result.accuracy || 0), 0) / results.length);
}

export function hallucinationRate(results: { hasHallucination?: boolean }[]): number {
    if (!results.length) return 0;
    return Math.round((results.filter((result) => result.hasHallucination).length / results.length) * 100);
}

export function getFirstSentence(value?: string): string {
    if (!value) return "";
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (!cleaned) return "";
    const match = cleaned.match(/.*?[.!?](\s|$)/);
    return (match ? match[0] : cleaned).trim();
}
