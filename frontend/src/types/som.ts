export interface BatchResult {
    domainStability: number;
    driftRate: number;
    modelAverages?: Record<string, number>;
    results?: Array<{
        prompt?: string;
        results?: { model: string; accuracy: number; hasDisplacement?: boolean; hasHallucination?: boolean; claimScore?: string; answer?: string }[];
        error?: string;
    }>;
}

export interface ScoringHistoryEntry {
    prompt: string;
    results: { model: string; accuracy: number; hasDisplacement?: boolean; hasHallucination?: boolean; claimScore?: string; answer?: string }[];
    timestamp: { seconds: number };
    version?: string;
}

export interface SEOResult {
    url: string;
    seoScore: number;
    geoScore: number;
    overallScore: number;
    geoMethod?: string;
    checks: { check: string; status: string; detail: string }[];
    recommendation: string;
}

export interface GapAssertion {
    assertion: string;
    gapConfidence: number;
    somImpact: number;
}

export interface CompetitorInsight {
    name: string;
    displacementRate: number;
    strengths: string[];
    weaknesses: string[];
    winningCategory?: string;
    buyerQueries?: string[];
    claimsOwned?: string[];
    missingAssertions?: (GapAssertion | string)[];
    remediationRecommendation?: string;
}

export interface ManifestSnapshot {
    sourceUrl?: string | null;
    name?: string | null;
    schemaData?: Record<string, unknown>;
    industryTaxonomy?: string | null;
    industryTags?: string[];
}

export interface PromptRun {
    prompt: string;
    results: { model: string; accuracy: number; hasDisplacement?: boolean; hasHallucination?: boolean; claimScore?: string; answer?: string }[];
}

export interface QueryClusterInsight {
    prompt: string;
    category: string;
    avgAccuracy: number;
    claimRecall: number;
    hallucinationCount: number;
    winnerModel: string;
    weakestModel: string;
    observedOutcome: string;
    winningCompetitor: string;
    claimsOwned: string[];
    missingClaims: string[];
}

export interface RemediationRecommendation {
    title: string;
    category: string;
    observedOutcome: string;
    winningCompetitor: string;
    missingClaims: string[];
    pageTargets: import("@/lib/remediationTargets").RemediationPageTarget[];
    copyBlock: string;
    schemaSuggestion: string;
    faqSuggestion: string;
    llmsSuggestion: string;
}
