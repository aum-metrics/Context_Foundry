"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect, useMemo } from "react";
import { jsPDF } from "jspdf";
import { Shield, Download, Globe, Cpu, CheckCircle2, XCircle, AlertTriangle, BookOpen, X, FileText, Lock } from "lucide-react";
import { Logo } from "./Logo";
import { useOrganization } from "./OrganizationContext";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import { auth } from "@/lib/firebase";
import { describeGeoMethod } from "@/lib/geoMethod";
import type { RemediationPageTarget } from "@/lib/remediationTargets";

interface ModelResult {
    model: string;
    accuracy: number;
    hasDisplacement?: boolean;  // true when a competitor is recommended ahead of this company
    hasHallucination?: boolean; // backward-compat alias — same value
    claimScore?: string;
    answer?: string;
}

interface ScoringRecord {
    prompt: string;
    results: ModelResult[];
    timestamp: { toDate: () => Date } | null;
}

interface QueryClusterInsight {
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

interface RemediationRecommendation {
    title: string;
    category: string;
    observedOutcome: string;
    winningCompetitor: string;
    missingClaims: string[];
    pageTargets: RemediationPageTarget[];
    copyBlock: string;
    schemaSuggestion: string;
    faqSuggestion: string;
    llmsSuggestion: string;
}

interface BrandHealthCertificateProps {
    organizationName: string;
    asovScore: number;
    driftRate: number;
    onClose: () => void;
    // Optional: passed directly from in-session simulation results
    modelResults?: ModelResult[];
    lastPrompt?: string;
    seoResult?: {
        seoScore: number;
        geoScore: number;
        overallScore: number;
        geoMethod?: string;
        recommendation: string;
    };
    competitors?: { name: string; displacementRate: number; strengths: string[]; weaknesses: string[]; winningCategory?: string; claimsOwned?: string[]; missingAssertions?: string[]; remediationRecommendation?: string }[];
    activeContextName?: string;
    clusterInsights?: QueryClusterInsight[];
    remediationRecommendations?: RemediationRecommendation[];
    allowPdfDownload?: boolean;
    onUpgradeRequired?: () => void;
}

const CANONICAL_MODEL_ORDER = ["GPT-4o", "Gemini 3 Flash", "Claude 4.5 Sonnet"];

function normalizeModelName(model: string): string {
    const raw = (model || "").trim();
    const lowered = raw.toLowerCase();
    if (lowered.startsWith("gpt-4o")) return "GPT-4o";
    if (lowered.includes("gemini") && lowered.includes("flash")) return "Gemini 3 Flash";
    if (lowered.includes("claude") && (lowered.includes("sonnet") || lowered.includes("haiku"))) return "Claude 4.5 Sonnet";
    return raw;
}

function parseClaimRecallPercent(claimScore?: string): number | null {
    if (!claimScore) return null;
    const ratioMatch = claimScore.match(/(\d+)\s*\/\s*(\d+)/);
    if (!ratioMatch) return null;
    const supported = Number(ratioMatch[1]);
    const total = Number(ratioMatch[2]);
    if (!Number.isFinite(supported) || !Number.isFinite(total) || total <= 0) return null;
    return Math.max(0, Math.min(100, Math.round((supported / total) * 100)));
}

function clampPct(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
}

function averageAccuracy(results: ModelResult[]): number {
    if (!results.length) return 0;
    return Math.round(results.reduce((sum, result) => sum + (result.accuracy || 0), 0) / results.length);
}

function hallucinationRate(results: ModelResult[]): number {
    if (!results.length) return 0;
    return Math.round((results.filter((result) => result.hasHallucination).length / results.length) * 100);
}

export default function BrandHealthCertificate({
    organizationName: propOrgName,
    asovScore,
    driftRate,
    onClose,
    modelResults: propModelResults,
    lastPrompt: propPrompt,
    seoResult,
    competitors = [],
    activeContextName,
    clusterInsights = [],
    remediationRecommendations = [],
    allowPdfDownload = true,
    onUpgradeRequired,
}: BrandHealthCertificateProps) {
    const organizationName = propOrgName;
    const { organization, refreshKey, activeManifestVersion } = useOrganization();
    const { models } = useModelCatalog();
    const certificateRef = useRef<HTMLDivElement>(null);
    const [issuedDate, setIssuedDate] = useState("");
    const [isoTimestamp, setIsoTimestamp] = useState("");
    const [isDownloading, setIsDownloading] = useState(false);
    const [showMethodology, setShowMethodology] = useState(false);
    const [latestRecord, setLatestRecord] = useState<ScoringRecord | null>(null);
    const [historyRecords, setHistoryRecords] = useState<ScoringRecord[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIssuedDate(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));
        setIsoTimestamp(new Date().toISOString());
    }, []);

    // Load latest scoring record from Firestore for data post-refresh
    useEffect(() => {
        if (propModelResults && propModelResults.length > 0) {
            setLatestRecord({ prompt: propPrompt || "", results: propModelResults, timestamp: null });
        }
        if (!organization?.id) { setLoadingHistory(false); return; }
        const fetchHistory = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                let effectiveToken = token;
                if (!effectiveToken) {
                    const savedMockUser = typeof window !== 'undefined' ? localStorage.getItem("mock_auth_user") : null;
                    if (savedMockUser === "demo@demo.com") effectiveToken = "mock-demo-token";
                    else if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash") effectiveToken = "mock-dev-token";
                }

                if (!effectiveToken) {
                    setLoadingHistory(false);
                    return;
                }

                const response = await fetch(`/api/simulation/history/${organization.id}`, {
                    headers: { Authorization: `Bearer ${effectiveToken}` }
                });
                if (!response.ok) {
                    setError("Failed to load historical data. Please check your connection.");
                    return;
                }
                const data = await response.json();
                const matchingHistory = (data.history || []).filter((entry: { version?: string }) => {
                    if (!activeManifestVersion || activeManifestVersion === "latest") return true;
                    return entry.version === activeManifestVersion;
                });
                const normalizedHistory = matchingHistory.map((entry: ScoringRecord) => ({
                    prompt: entry.prompt || "",
                    results: (entry.results || []).map((result: ModelResult) => ({
                        ...result,
                        model: normalizeModelName(result.model),
                    })),
                    timestamp: entry.timestamp || null,
                }));
                setHistoryRecords(normalizedHistory);
                const record = normalizedHistory[0];
                if (record) {
                    setLatestRecord(record);
                }
            } catch (e) {
                console.warn("Could not load scoring history:", e);
                setError("Network error loading report history.");
            } finally {
                setLoadingHistory(false);
            }
        };
        fetchHistory();
    }, [organization, propModelResults, propPrompt, refreshKey, activeManifestVersion]);

    const results = (latestRecord?.results || [])
        .map((result) => ({ ...result, model: normalizeModelName(result.model) }))
        .sort((a, b) => CANONICAL_MODEL_ORDER.indexOf(a.model) - CANONICAL_MODEL_ORDER.indexOf(b.model));
    const avgSom = results.length > 0 ? averageAccuracy(results) : asovScore;
    const hallucinationCount = results.filter((r: ModelResult) => r.hasDisplacement ?? r.hasHallucination).length;
    const fidelityPct = results.length > 0 ? Math.round((results.filter((r: ModelResult) => !(r.hasDisplacement ?? r.hasHallucination)).length / results.length) * 100) : (100 - driftRate);
    const remediationSnapshot = useMemo(() => {
        if (historyRecords.length < 2) return null;
        const chronological = [...historyRecords].reverse();
        const baseline = chronological[0];
        const current = chronological[chronological.length - 1];
        const baselineAvg = averageAccuracy(baseline.results || []);
        const currentAvg = averageAccuracy(current.results || []);
        const baselineHallucinationRate = hallucinationRate(baseline.results || []);
        const currentHallucinationRate = hallucinationRate(current.results || []);
        return {
            baselinePrompt: baseline.prompt,
            currentPrompt: current.prompt,
            baselineAvg,
            currentAvg,
            deltaSom: currentAvg - baselineAvg,
            baselineHallucinationRate,
            currentHallucinationRate,
            deltaHallucinationRate: currentHallucinationRate - baselineHallucinationRate,
        };
    }, [historyRecords]);

    const scoreColor = (s: number) => s >= 85 ? "#10b981" : s >= 65 ? "#f59e0b" : s >= 40 ? "#fb923c" : "#ef4444";
    const gradeLabel = (s: number) => s >= 85 ? "HIGH FIDELITY" : s >= 65 ? "MINOR DRIFT" : s >= 40 ? "SEVERE DRIFT" : "CRITICAL DRIFT";
    const hasLowRecallCriticalDrift = avgSom < 55 && hallucinationCount === 0;

    const radarMetrics = useMemo(() => {
        const byModel: Record<string, { consistency: number; factuality: number; sentiment: number; safety: number; authority: number }> = {
            "GPT-4o": { consistency: 0, factuality: 0, sentiment: 0, safety: 0, authority: 0 },
            "Gemini 3 Flash": { consistency: 0, factuality: 0, sentiment: 0, safety: 0, authority: 0 },
            "Claude 4.5 Sonnet": { consistency: 0, factuality: 0, sentiment: 0, safety: 0, authority: 0 },
        };

        results.forEach((result) => {
            if (!byModel[result.model]) return;
            const accuracy = clampPct(result.accuracy || 0);
            const claimRecall = parseClaimRecallPercent(result.claimScore) ?? accuracy;
            const safety = result.hasHallucination ? clampPct(claimRecall - 25) : clampPct(claimRecall + 10);
            const authority = clampPct((accuracy * 0.6) + (claimRecall * 0.4));
            const sentiment = clampPct((accuracy * 0.5) + (safety * 0.5));
            byModel[result.model] = {
                consistency: accuracy,
                factuality: claimRecall,
                sentiment,
                safety,
                authority,
            };
        });

        return byModel;
    }, [results]);

    const getExecutiveSummary = (score: number, orgName: string) => {
        const hCount = results.filter((r: ModelResult) => r.hasDisplacement ?? r.hasHallucination).length;
        const totalMod = results.length;

        if (score >= 85 && hCount === 0) {
            return `AUM Context Foundry certifies that ${orgName} maintains High Fidelity across LLM representations. AI agents accurately retrieve, synthesize, and present your core claims without introducing hallucinated artifacts. Your unstructured data assets are optimally RAG-ready.`;
        }
        if (score >= 65) {
            return `${orgName} exhibits Minor Data Drift across modern AI agents. While core capabilities are recognized, some nuances are either omitted or mildly conflated. We recommend injecting clearer Context Manifests to prevent further brand erosion.`;
        }
        if (score >= 40) {
            return `ALERT: ${orgName} is experiencing Severe Data Drift. ${hCount > 0 ? `Hallucinations detected in ${hCount}/${totalMod} tested models.` : "Material facts are being omitted or misattributed."} Generative engines are failing to recall specific product differentiators. Immediate semantic alignment is recommended.`;
        }
        if (hCount > 0) {
            return `WARNING: ${orgName} suffers from Critical Data Drift. Generative AI engines are hallucinating material facts across ${hCount}/${totalMod} models and misrepresenting your core offerings. Immediate remediation via structured Semantic Ingestion is required to protect brand integrity.`;
        }
        return `WARNING: ${orgName} suffers from Critical Data Drift. Even without explicit hallucinations, models are failing to recall enough verified claims from your context, causing under-representation of your core offerings. Immediate remediation via structured Semantic Ingestion is required to protect brand integrity.`;
    };
    const GradeBadgeIcon = avgSom >= 85 ? CheckCircle2 : avgSom >= 55 ? Shield : AlertTriangle;

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4",
                compress: true,
            });

            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 20; // Increased margin for premium feel
            const contentWidth = pageWidth - (margin * 2);
            let y = margin;

            // DRAW PREMIUM HEADER BACKGROUND
            pdf.setFillColor(248, 250, 252); // slate-50
            pdf.rect(0, 0, pageWidth, 50, 'F');
            pdf.setDrawColor(99, 102, 241); // indigo-500
            pdf.setLineWidth(1);
            pdf.line(0, 50, pageWidth, 50);

            // WATERMARK / BADGE
            pdf.setFontSize(35);
            pdf.setTextColor(241, 245, 249); // slate-100
            pdf.setFont("helvetica", "bold");
            pdf.text("VERIFIED CONTEXT", pageWidth / 2, pageHeight / 2, { align: "center", angle: 45 });

            const ensureSpace = (needed = 8) => {
                if (y + needed > pageHeight - margin) {
                    pdf.addPage();
                    // Repeating header for subsequent pages
                    pdf.setFillColor(248, 250, 252);
                    pdf.rect(0, 0, pageWidth, 15, 'F');
                    pdf.setDrawColor(226, 232, 240);
                    pdf.line(0, 15, pageWidth, 15);
                    y = 25;
                }
            };

            const writeHeading = (text: string, color: [number, number, number] = [31, 41, 55]) => {
                ensureSpace(12);
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(14);
                pdf.setTextColor(color[0], color[1], color[2]);
                pdf.text(text.toUpperCase(), margin, y);
                y += 8;
                pdf.setDrawColor(226, 232, 240);
                pdf.setLineWidth(0.2);
                pdf.line(margin, y - 1, margin + 40, y - 1);
                y += 5;
            };

            const writeBody = (text: string, size = 10, color: [number, number, number] = [71, 85, 105], bold = false) => {
                const lines = pdf.splitTextToSize(text, contentWidth);
                ensureSpace((lines.length * 5) + 3);
                pdf.setFont("helvetica", bold ? "bold" : "normal");
                pdf.setFontSize(size);
                pdf.setTextColor(color[0], color[1], color[2]);
                pdf.text(lines, margin, y);
                y += (lines.length * 5) + 1.5;
            };

            const writeDivider = () => {
                ensureSpace(6);
                pdf.setDrawColor(226, 232, 240);
                pdf.setLineWidth(0.1);
                pdf.line(margin, y, pageWidth - margin, y);
                y += 6;
            };

            // HEADER CONTENT
            y = 15;
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(22);
            pdf.setTextColor(30, 41, 59);
            pdf.text("AUM CONTEXT FOUNDRY", margin, y);
            y += 8;
            pdf.setFontSize(10);
            pdf.setTextColor(99, 102, 241);
            pdf.text("EXECUTIVE BRAND HEALTH CERTIFICATE", margin, y);
            
            pdf.setTextColor(148, 163, 184);
            pdf.setFontSize(9);
            pdf.text(`ID: ${Date.now().toString(36).toUpperCase()}`, pageWidth - margin - 30, 15);
            pdf.text(`ISSUED: ${issuedDate}`, pageWidth - margin - 30, 20);

            y = 65; // Start content below header block

            // EXECUTIVE SUMMARY BLOCK
            writeHeading("Executive Summary", [79, 70, 229]);
            const executiveSummary = getExecutiveSummary(avgSom, organizationName);
            pdf.setFont("helvetica", "italic");
            writeBody(executiveSummary, 11, [30, 41, 59]);
            writeDivider();

            // METRICS GRID (2x2)
            writeHeading("Standard KPIs");
            const colWidth = contentWidth / 2;
            
            // Box 1: SoM
            pdf.setFillColor(248, 250, 252);
            pdf.rect(margin, y, colWidth - 2, 20, 'F');
            pdf.setFontSize(9); pdf.setTextColor(100); pdf.text("SHARE OF MODEL (SoM)", margin + 5, y + 7);
            pdf.setFontSize(16); pdf.setTextColor(30); pdf.text(`${avgSom}%`, margin + 5, y + 15);
            
            // Box 2: Fidelity
            pdf.rect(margin + colWidth + 2, y, colWidth - 2, 20, 'F');
            pdf.setFontSize(9); pdf.setTextColor(100); pdf.text("RECALL FIDELITY", margin + colWidth + 7, y + 7);
            pdf.setFontSize(16); pdf.setTextColor(30); pdf.text(`${fidelityPct}%`, margin + colWidth + 7, y + 15);
            
            y += 25;
            
            // Box 3: Displacement
            pdf.rect(margin, y, colWidth - 2, 20, 'F');
            pdf.setFontSize(9); pdf.setTextColor(100); pdf.text("COMPETITIVE DISPLACEMENT", margin + 5, y + 7);
            pdf.setFontSize(16); pdf.setTextColor(hallucinationCount > 0 ? 220 : 30); pdf.text(`${hallucinationCount}/${results.length}`, margin + 5, y + 15);
            
            // Box 4: Context
            pdf.rect(margin + colWidth + 2, y, colWidth - 2, 20, 'F');
            pdf.setFontSize(9); pdf.setTextColor(100); pdf.text("ANALYSIS CONTEXT", margin + colWidth + 7, y + 7);
            pdf.setFontSize(11); pdf.setTextColor(30); pdf.text(activeContextName || "Latest", margin + colWidth + 7, y + 15);
            
            y += 30;
            writeDivider();

            // MULTI-MODEL TABLE
            writeHeading("Multi-Model Adjudication");
            pdf.setFillColor(241, 245, 249);
            pdf.rect(margin, y, contentWidth, 8, 'F');
            pdf.setFontSize(9); pdf.setTextColor(71, 85, 105);
            pdf.text("MODEL", margin + 5, y + 5);
            pdf.text("FIDELITY SCORE", margin + 40, y + 5);
            pdf.text("CLAIM RECALL", margin + 80, y + 5);
            pdf.text("VERDICT", margin + 130, y + 5);
            y += 12;

            results.forEach((r) => {
                ensureSpace(10);
                pdf.setFontSize(10); pdf.setTextColor(30, 41, 59);
                pdf.text(r.model, margin + 5, y);
                pdf.text(`${r.accuracy}%`, margin + 40, y);
                pdf.text(r.claimScore || "N/A", margin + 80, y);
                pdf.setTextColor( (r.hasDisplacement || r.hasHallucination) ? 225 : 16, (r.hasDisplacement || r.hasHallucination) ? 29 : 185, (r.hasDisplacement || r.hasHallucination) ? 72 : 129 );
                pdf.text( (r.hasDisplacement || r.hasHallucination) ? "Displaced" : "Grounded", margin + 130, y);
                y += 8;
            });
            y += 5;
            writeDivider();

            // 5. QUERY CLUSTERS
            if (clusterInsights && clusterInsights.length > 0) {
                writeHeading("Winning and Losing Query Clusters");
                clusterInsights.slice(0, 5).forEach((cluster) => {
                    ensureSpace(35);
                    pdf.setFillColor(248, 250, 252);
                    pdf.rect(margin, y, contentWidth, 25, 'F');
                    
                    pdf.setFont("helvetica", "bold");
                    pdf.setFontSize(8);
                    pdf.setTextColor(148, 163, 184);
                    pdf.text(cluster.category.toUpperCase(), margin + 5, y + 6);
                    
                    pdf.setFontSize(14);
                    pdf.setTextColor(30, 41, 59);
                    pdf.text(`${cluster.avgAccuracy}%`, margin + contentWidth - 15, y + 15, { align: "right" });
                    pdf.setFontSize(8);
                    pdf.setTextColor(148, 163, 184);
                    pdf.text("avg fidelity", margin + contentWidth - 15, y + 19, { align: "right" });

                    pdf.setFontSize(10);
                    pdf.setTextColor(30, 41, 59);
                    pdf.text(pdf.splitTextToSize(cluster.prompt, contentWidth - 40), margin + 5, y + 12);
                    
                    y += 28;
                    writeBody(cluster.observedOutcome, 9, [71, 85, 105]);
                    writeBody(`Winner: ${cluster.winnerModel} · Weakest: ${cluster.weakestModel} · Competitor: ${cluster.winningCompetitor}`, 8, [148, 163, 184]);
                    writeBody(`Missing claims: ${cluster.missingClaims.join(", ")}`, 8, [148, 163, 184]);
                    y += 4;
                });
                writeDivider();
            }

            // 6. RADAR CONTEXT
            if (results.length > 0) {
                writeHeading("SoM Radar Context (5-D)");
                writeBody("These contextual dimensions explain where narrative preservation is strong vs weak across model families.", 9);
                CANONICAL_MODEL_ORDER.forEach((model) => {
                    const m = radarMetrics[model];
                    if (m) {
                        ensureSpace(12);
                        pdf.setFont("helvetica", "bold");
                        pdf.setFontSize(10);
                        pdf.setTextColor(30, 41, 59);
                        pdf.text(model, margin, y);
                        y += 5;
                        pdf.setFont("helvetica", "normal");
                        pdf.setFontSize(9);
                        pdf.setTextColor(71, 85, 105);
                        pdf.text(`Consistency: ${m.consistency}% | Factuality: ${m.factuality}% | Sentiment: ${m.sentiment}% | Safety: ${m.safety}% | Authority: ${m.authority}%`, margin + 5, y);
                        y += 6;
                    }
                });
                writeDivider();
            }

            // 7. COMPETITOR DISPLACEMENT
            if (competitors.length > 0) {
                writeHeading("Competitor Displacement Summary");
                competitors.slice(0, 3).forEach((comp) => {
                    ensureSpace(40);
                    pdf.setFillColor(254, 242, 242); // rose-50
                    pdf.rect(margin, y, contentWidth, 35, 'F');
                    
                    pdf.setFont("helvetica", "bold");
                    pdf.setFontSize(11);
                    pdf.setTextColor(30, 41, 59);
                    pdf.text(comp.name, margin + 5, y + 8);
                    
                    pdf.setTextColor(225, 29, 72); // rose-600
                    pdf.text(`${comp.displacementRate}%`, margin + contentWidth - 5, y + 8, { align: "right" });
                    pdf.setFontSize(7);
                    pdf.setTextColor(153, 27, 27);
                    pdf.text("AI REC. FREQUENCY", margin + contentWidth - 5, y + 12, { align: "right" });

                    pdf.setFontSize(9);
                    pdf.setTextColor(71, 85, 105);
                    pdf.text(`Strengths: ${comp.strengths.join(", ")}`, margin + 5, y + 16);
                    pdf.text(`Weaknesses: ${comp.weaknesses.join(", ")}`, margin + 5, y + 21);
                    
                    if (comp.remediationRecommendation) {
                        pdf.setFont("helvetica", "italic");
                        pdf.setTextColor(79, 70, 229);
                        pdf.text(pdf.splitTextToSize(`" ${comp.remediationRecommendation} "`, contentWidth - 10), margin + 5, y + 28);
                    }
                    y += 42;
                });
                writeDivider();
            }

            // 8. REMEDIATION DELTA
            if (remediationSnapshot) {
                writeHeading("Remediation Delta");
                writeBody(`SoM movement: ${remediationSnapshot.baselineAvg}% to ${remediationSnapshot.currentAvg}% (${remediationSnapshot.deltaSom >= 0 ? "+" : ""}${remediationSnapshot.deltaSom} points)`);
                writeBody(`Hallucination-rate movement: ${remediationSnapshot.baselineHallucinationRate}% to ${remediationSnapshot.currentHallucinationRate}% (${remediationSnapshot.deltaHallucinationRate >= 0 ? "+" : ""}${remediationSnapshot.deltaHallucinationRate} points)`);
                writeDivider();
            }

            // 9. ENHANCED REMEDIATION PLAN
            writeHeading("Prescriptive Remediation Plan", [99, 102, 241]);
            const recs = (remediationRecommendations && remediationRecommendations.length > 0) ? remediationRecommendations : [];
            if (recs.length === 0) {
                writeBody("Simulation data implies baseline grounding. No immediate remediation actions generated.");
            } else {
                recs.slice(0, 3).forEach((item) => {
                    ensureSpace(50);
                    pdf.setFont("helvetica", "bold");
                    pdf.setFontSize(12);
                    pdf.setTextColor(30, 41, 59);
                    pdf.text(item.title, margin, y);
                    y += 6;
                    
                    pdf.setFontSize(9);
                    pdf.setTextColor(148, 163, 184);
                    pdf.text(`Winning competitor: ${item.winningCompetitor}`, margin, y);
                    y += 5;

                    writeBody(`Observed Outcome: ${item.observedOutcome}`, 9);
                    
                    // Page Targets
                    if (item.pageTargets && item.pageTargets.length > 0) {
                        pdf.setFont("helvetica", "bold");
                        pdf.setFontSize(9);
                        pdf.text("Page(s) to update:", margin, y);
                        y += 5;
                        item.pageTargets.forEach(target => {
                            writeBody(`• ${target.label}: ${target.url}`, 8, [79, 70, 229]);
                            writeBody(`  Reason: ${target.reason}`, 8);
                        });
                    }

                    // Copy Block
                    pdf.setFillColor(249, 250, 251);
                    const copyLines = pdf.splitTextToSize(`SUGGESTED UPDATE: ${item.copyBlock}`, contentWidth - 10);
                    pdf.rect(margin, y, contentWidth, (copyLines.length * 5) + 6, 'F');
                    pdf.setFont("helvetica", "italic");
                    pdf.setFontSize(9);
                    pdf.setTextColor(79, 70, 229);
                    pdf.text(copyLines, margin + 5, y + 6);
                    y += (copyLines.length * 5) + 12;

                    // Technical Suggestions
                    ensureSpace(15);
                    pdf.setFont("helvetica", "normal");
                    pdf.setFontSize(8);
                    pdf.setTextColor(100);
                    if (item.schemaSuggestion) writeBody(`• ${item.schemaSuggestion}`, 8);
                    if (item.faqSuggestion) writeBody(`• ${item.faqSuggestion}`, 8);
                    if (item.llmsSuggestion) writeBody(`• ${item.llmsSuggestion}`, 8);
                    y += 5;
                });
            }

            // 10. METHODOLOGY FOOTER
            ensureSpace(40);
            pdf.setDrawColor(226, 232, 240);
            pdf.line(margin, y, pageWidth - margin, y);
            y += 8;
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(9);
            pdf.setTextColor(71, 85, 105);
            pdf.text("SoM Formula", margin, y);
            pdf.text("Inference Audit", margin + colWidth, y);
            y += 5;
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            pdf.text("SoM = (0.4 × Semantic) + (0.6 × Claim Recall)", margin, y);
            pdf.text(`GPT-4o, Gemini 3 Flash, Claude 4.5 Sonnet`, margin + colWidth, y);
            y += 4;
            pdf.text("Aligned to: ISO/IEC 42001 · NIST AI RMF", margin, y);
            pdf.text(`Timestamp: ${isoTimestamp}`, margin + colWidth, y);

            // FOOTER BRANDING
            const footerY = pageHeight - 10;
            pdf.setFontSize(7);
            pdf.setTextColor(148, 163, 184);
            pdf.text("CONFIDENTIAL - FOR BOARD OF DIRECTORS ONLY", margin, footerY);
            pdf.text("© 2026 AUM CONTEXT FOUNDRY - ALL RIGHTS RESERVED", pageWidth - margin - 70, footerY);

            const fileName = `AUM-Executive-Report-${organizationName.replace(/\s+/g, "-")}.pdf`;
            pdf.save(fileName);
            setIsDownloading(false);
        } catch (err) {
            window.alert(`PDF generation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
            setIsDownloading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <motion.div
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="w-full max-w-2xl h-[100dvh] overflow-y-auto bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-white/10 shadow-2xl relative flex flex-col"
            >
                {/* Close button inside the drawer header */}
                <div className="sticky top-0 z-[110] flex justify-between items-center px-8 py-4 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <Logo size={28} isCapture={isDownloading} />
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Brand Health Report</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors bg-slate-100 dark:bg-slate-800/80 p-2 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 p-8 flex flex-col gap-8">
                    {/* THE CERTIFICATE TARGET FOR DOWNLOAD */}
                    <div
                        ref={certificateRef}
                        className="relative w-full bg-slate-50 dark:bg-slate-900/50 rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_0_80px_rgba(99,102,241,0.1)]"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                        {/* HEADER GRADIENT */}
                        <div className="absolute top-0 left-0 w-full h-56 bg-gradient-to-br from-indigo-500/10 dark:from-indigo-600/30 via-fuchsia-500/5 dark:via-fuchsia-600/15 to-transparent pointer-events-none" />
                        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-cyan-400/10 dark:from-cyan-500/10 to-transparent pointer-events-none rounded-full" />

                        <div className="relative p-8">
                            {/* HEADER ROW */}
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <Logo size={36} isCapture={isDownloading} />
                                    <div>
                                        <p className="text-[9px] text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] font-bold">AUM Context Foundry</p>
                                        <p className="text-slate-900 dark:text-white font-semibold text-sm">Brand Health Certificate</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Issued</p>
                                    <p className="text-slate-700 dark:text-slate-300 text-xs font-medium">{issuedDate}</p>
                                </div>
                            </div>

                            {/* ORGANIZATION + OVERALL SCORE */}
                            <div className="flex items-center gap-6 mb-10 p-6 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none">
                                <div className="flex-1">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Organization</p>
                                    <p className="text-2xl font-semibold text-slate-900 dark:text-white">{organizationName}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">AI Contextual Representation Audit</p>
                                    {activeContextName && (
                                        <p className="text-[10px] text-indigo-600 dark:text-indigo-300 mt-1">Context: {activeContextName}</p>
                                    )}
                                </div>
                                <div className="text-center">
                                    <div className="relative w-28 h-28">
                                        <svg className="w-full h-full -rotate-90">
                                            <circle cx="56" cy="56" r="48" fill="none" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="7" />
                                            <motion.circle
                                                cx="56" cy="56" r="48" fill="none"
                                                stroke={scoreColor(avgSom)} strokeWidth="7"
                                                strokeDasharray={2 * Math.PI * 48}
                                                initial={{ strokeDashoffset: 2 * Math.PI * 48 }}
                                                animate={{ strokeDashoffset: (2 * Math.PI * 48) * (1 - avgSom / 100) }}
                                                transition={{ duration: 1.8, ease: "easeOut" }}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-2xl font-bold text-slate-900 dark:text-white">{avgSom}%</span>
                                            <span className="text-[8px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg SoM</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* MODEL-BY-MODEL SoM BREAKDOWN */}
                            <div className="mb-8">
                                <div className="flex items-center gap-2 mb-4">
                                    <Cpu className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                                    <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">Multi-Model SoM Breakdown</p>
                                    <span className="ml-auto text-[9px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 px-2 py-0.5 rounded-full">Share of Model Score</span>
                                </div>
                                {loadingHistory ? (
                                    <div className="text-center text-slate-500 text-xs py-6">Loading simulation data...</div>
                                ) : error ? (
                                    <div className="text-center text-amber-500 text-xs py-6 border border-dashed border-amber-300 dark:border-amber-700/30 rounded-xl bg-amber-50/50 dark:bg-amber-500/5">
                                        <AlertTriangle className="w-4 h-4 mx-auto mb-2" />
                                        {error}
                                    </div>
                                ) : results.length === 0 ? (
                                    <div className="text-center text-slate-500 text-xs py-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                                        Run a simulation first to populate SoM data.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {results.map((r: ModelResult, i: number) => (
                                            <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8 shadow-sm dark:shadow-none">
                                                <div className="w-32 shrink-0">
                                                    <p className="text-xs font-semibold text-slate-900 dark:text-white">{r.model}</p>
                                                    {r.claimScore && <p className="text-[9px] text-slate-500 mt-0.5">{r.claimScore}</p>}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <motion.div
                                                            className="h-full rounded-full"
                                                            style={{ backgroundColor: scoreColor(r.accuracy) }}
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${r.accuracy}%` }}
                                                            transition={{ duration: 1, delay: i * 0.15 }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="w-14 text-right">
                                                    <span className="text-sm font-bold" style={{ color: scoreColor(r.accuracy) }}>{r.accuracy}%</span>
                                                </div>
                                                <div className="w-6 shrink-0">
                                                    {r.hasDisplacement ?? r.hasHallucination
                                                        ? <XCircle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                                                        : <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                                    }
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* PROMPT TESTED */}
                            {latestRecord?.prompt && (
                                <div className="mb-8 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-500/20">
                                    <p className="text-[9px] text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1.5">Query Tested</p>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 italic">&ldquo;{latestRecord.prompt}&rdquo;</p>
                                </div>
                            )}

                            {clusterInsights.length > 0 && (
                                <div className="mb-8 p-5 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-3">Winning and Losing Query Clusters</p>
                                    <div className="space-y-3">
                                        {clusterInsights.slice(0, 5).map((cluster) => (
                                            <div key={`${cluster.category}-${cluster.prompt}`} className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-white/5">
                                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
                                                    <div>
                                                        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{cluster.category}</p>
                                                        <p className="text-sm text-slate-800 dark:text-slate-200">{cluster.prompt}</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-lg font-semibold text-slate-900 dark:text-white">{cluster.avgAccuracy}%</p>
                                                        <p className="text-[10px] text-slate-500">avg fidelity</p>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{cluster.observedOutcome}</p>
                                                <p className="text-[11px] text-slate-500">Winner: {cluster.winnerModel} · Weakest: {cluster.weakestModel} · Competitor: {cluster.winningCompetitor}</p>
                                                <p className="text-[11px] text-slate-500 mt-1">Missing claims: {cluster.missingClaims.join(", ")}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* EXECUTIVE INTERPRETATION */}
                            <div className="mb-8 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5">
                                <div className="flex items-center gap-2 mb-3">
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">Executive Interpretation</p>
                                </div>
                                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                    {getExecutiveSummary(avgSom, organizationName)}
                                </p>
                            </div>

                            <div className="mb-8 p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-500/10">
                                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mb-3">How to read this report</p>
                                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                                    <p><span className="font-semibold text-slate-800 dark:text-slate-200">AI Visibility:</span> how strongly your brand shows up with the right narrative in model outputs.</p>
                                    <p><span className="font-semibold text-slate-800 dark:text-slate-200">Fidelity Rate:</span> the share of models that stayed grounded instead of drifting.</p>
                                    <p><span className="font-semibold text-slate-800 dark:text-slate-200">Competitive Displacement:</span> how many models recommended a competitor instead of you or omitted your material claims.</p>
                                    <p><span className="font-semibold text-slate-800 dark:text-slate-200">SoM Score:</span> a blended score using semantic alignment plus claim recall against your verified context.</p>
                                    <p><span className="font-semibold text-slate-800 dark:text-slate-200">Why Critical Drift can still happen at 0/3 displacement:</span> this usually means models stayed non-fabricated but missed too many required claims, so claim recall stayed low and SoM remained in drift territory.</p>
                                </div>
                            </div>

                            {results.length > 0 && (
                                <div className="mb-8 p-5 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-2">SoM Radar Context (5-D)</p>
                                    <p className="text-xs text-slate-500 mb-4">
                                        These contextual dimensions are derived from this exact run&apos;s observed accuracy, claim recall, and hallucination flags.
                                        They explain where narrative preservation is strong vs weak across model families.
                                    </p>
                                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                                        {CANONICAL_MODEL_ORDER.map((model) => (
                                            <p key={model}>
                                                <span className="font-semibold text-slate-800 dark:text-slate-200">{model}:</span>{" "}
                                                Consistency {radarMetrics[model].consistency} · Factuality {radarMetrics[model].factuality} · Sentiment {radarMetrics[model].sentiment} · Safety {radarMetrics[model].safety} · Authority {radarMetrics[model].authority}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(seoResult || competitors.length > 0) && (
                                <div className="mb-8 grid grid-cols-1 gap-4">
                                    {seoResult && (
                                        <div className="p-5 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-3">Search Readiness Snapshot</p>
                                    <div className="grid grid-cols-3 gap-3 mb-3">
                                                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 text-center">
                                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">SEO</p>
                                                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{seoResult.seoScore}%</p>
                                                </div>
                                                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 text-center">
                                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">GEO</p>
                                                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{seoResult.geoScore}%</p>
                                                </div>
                                                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 text-center">
                                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Overall</p>
                                                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{seoResult.overallScore}%</p>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-400">{seoResult.recommendation}</p>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-2">
                                                GEO method: {describeGeoMethod(seoResult.geoMethod)}
                                            </p>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-2">
                                                GEO reflects page-level generative readiness and manifest alignment, not the same thing as simulation drift on an individual prompt.
                                            </p>
                                        </div>
                                    )}
                                    {competitors.length > 0 && (
                                        <div className="p-5 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-3">Competitor Displacement Summary</p>
                                            <div className="space-y-3">
                                                {competitors.slice(0, 3).map((competitor) => (
                                                    <div key={competitor.name} className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-sm font-medium text-slate-900 dark:text-white">{competitor.name}</span>
                                                             <div className="group relative text-right">
                                                                <span className="text-sm font-semibold text-rose-500 block">{competitor.displacementRate}%</span>
                                                                <span className="text-[8px] text-slate-400 dark:text-slate-500 uppercase tracking-tighter">AI Rec. Frequency</span>
                                                             </div>
                                                         </div>
                                                         <p className="text-xs text-slate-500 mb-2">
                                                             Strengths: {competitor.strengths.join(", ") || "N/A"} · Weaknesses: {competitor.weaknesses.join(", ") || "N/A"}
                                                         </p>
                                                         {competitor.remediationRecommendation && (
                                                            <div className="mb-3 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                                                                <p className="text-[9px] uppercase tracking-widest text-indigo-400 font-bold mb-1">Actionable Remediation</p>
                                                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
                                                                    "{competitor.remediationRecommendation}"
                                                                </p>
                                                            </div>
                                                         )}
                                                                  <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                                                                <p>Winning category: {competitor.winningCategory || "Not available"}</p>
                                                                <p>Claims owned: {(competitor.claimsOwned || []).join(", ") || "Not available"}</p>
                                                             </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 3-TILE SUMMARY */}
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                <div className="p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8 text-center shadow-sm dark:shadow-none">
                                    <Globe className="w-5 h-5 mx-auto mb-2 text-indigo-500 dark:text-indigo-400" />
                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">AI Visibility</p>
                                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{asovScore}%</p>
                                    <p className="text-[9px] text-slate-500">Share of Model</p>
                                </div>
                                <div className="p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8 text-center shadow-sm dark:shadow-none">
                                    <Shield className="w-5 h-5 mx-auto mb-2 text-emerald-500 dark:text-emerald-400" />
                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Fidelity Rate</p>
                                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{fidelityPct}%</p>
                                    <p className="text-[9px] text-slate-500">{fidelityPct >= 80 ? "High Fidelity" : fidelityPct >= 55 ? "Drift detected" : "Critical drift"}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8 text-center shadow-sm dark:shadow-none">
                                    {hallucinationCount === 0
                                        ? <CheckCircle2 className="w-5 h-5 mx-auto mb-2 text-emerald-500 dark:text-emerald-400" />
                                        : <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-amber-500 dark:text-amber-400" />
                                    }
                                                                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">AI Rec. Proximity</p>
                                     <p className="text-lg font-semibold text-slate-900 dark:text-white">{hallucinationCount}/{results.length || "—"}</p>
                                     <p className="text-[9px] text-slate-500">models affected</p>
                                </div>
                            </div>

                            <div className="mb-8 p-5 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8">
                                <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-3">Remediation Delta</p>
                                {remediationSnapshot ? (
                                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                                        <p>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">SoM movement:</span>{" "}
                                            {remediationSnapshot.baselineAvg}% to {remediationSnapshot.currentAvg}% ({remediationSnapshot.deltaSom >= 0 ? "+" : ""}{remediationSnapshot.deltaSom} points)
                                        </p>
                                        <p>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">Hallucination-rate movement:</span>{" "}
                                            {remediationSnapshot.baselineHallucinationRate}% to {remediationSnapshot.currentHallucinationRate}% ({remediationSnapshot.deltaHallucinationRate >= 0 ? "+" : ""}{remediationSnapshot.deltaHallucinationRate} points)
                                        </p>
                                        <p>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">Baseline prompt:</span> {remediationSnapshot.baselinePrompt || "Not available"}
                                        </p>
                                        <p>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">Current prompt:</span> {remediationSnapshot.currentPrompt || "Not available"}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Baseline comparison will appear after at least two runs exist for this organization/context.
                                    </p>
                                )}
                            </div>

                            {remediationRecommendations.length > 0 && (
                                <div className="mb-8 p-5 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-3">Prescriptive Remediation Plan</p>
                                    <div className="space-y-4">
                                        {remediationRecommendations.slice(0, 3).map((item) => (
                                            <div key={`${item.category}-${item.title}`} className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-white/5">
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                                                <p className="text-xs text-slate-500 mt-1">Winning competitor: {item.winningCompetitor}</p>
                                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">{item.observedOutcome}</p>
                                                <div className="mt-2 space-y-2">
                                                    <p className="text-xs text-slate-500">Page(s) to update:</p>
                                                    {item.pageTargets.map((target) => (
                                                        <div key={`${target.label}-${target.url}`} className="text-xs text-slate-500">
                                                            <a
                                                                href={target.url || undefined}
                                                                target={target.url ? "_blank" : undefined}
                                                                rel={target.url ? "noreferrer" : undefined}
                                                                className="font-medium text-indigo-600 dark:text-indigo-300 hover:underline break-all"
                                                            >
                                                                {target.url ? `${target.label} — ${target.url}` : target.label}
                                                            </a>
                                                            <p className="mt-1">{target.reason}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-2">Suggested copy block: {item.copyBlock}</p>
                                                <div className="mt-3 space-y-1 text-[11px] text-slate-500">
                                                    <p>{item.schemaSuggestion}</p>
                                                    <p>{item.faqSuggestion}</p>
                                                    <p>{item.llmsSuggestion}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* GRADE BADGE */}
                            <div className="flex items-center justify-center mb-8">
                                <div className="flex items-center gap-3 px-6 py-3 rounded-full border bg-white dark:bg-transparent" style={{ borderColor: scoreColor(avgSom) + "40", backgroundColor: scoreColor(avgSom) + "0f" }}>
                                    <GradeBadgeIcon className="w-4 h-4" style={{ color: scoreColor(avgSom) }} />
                                    <span className="text-sm font-bold uppercase tracking-widest" style={{ color: scoreColor(avgSom) }}>
                                        {gradeLabel(avgSom)}
                                    </span>
                                </div>
                            </div>
                            {hasLowRecallCriticalDrift && (
                                <p className="text-center text-xs text-slate-500 dark:text-slate-400 -mt-5 mb-7">
                                    Drift is driven by low claim recall, not fabricated facts. Improve retrieval specificity in your manifest/context.
                                </p>
                            )}

                            {/* METHODOLOGY FOOTER */}
                            <div className="p-5 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 font-mono text-[9px] text-slate-500 dark:text-slate-400 leading-relaxed shadow-inner">
                                <div className="grid grid-cols-2 gap-4 mb-3">
                                    <div>
                                        <p className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest mb-1.5">SoM Formula</p>
                                        <p className="text-indigo-600 dark:text-indigo-300 font-bold text-[10px]">SoM = (0.4 × Semantic) + (0.6 × Claim Recall)</p>
                                        <p className="mt-1">Semantic = 1 − cosine_distance(manifest_vector, response_vector)</p>
                                        <p>Claim Recall = supported_claims / total_claims</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest mb-1.5">Inference Audit</p>
                                        {models.map((model) => (
                                            <p key={model.provider}>{model.provider}: {normalizeModelName(model.displayName)}</p>
                                        ))}
                                        <p className="mt-1">Embed: text-embedding-3-small</p>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-slate-300 dark:border-white/5 flex items-center justify-between">
                                    <span className="text-slate-500">Aligned to: ISO/IEC 42001 · NIST AI RMF · Zero-Retention Architecture</span>
                                    <span className="text-slate-400 dark:text-slate-600">{isoTimestamp}</span>
                                </div>
                            </div>
                        </div>

                        {/* BOTTOM TAGLINE */}
                        <div className="bg-slate-100 dark:bg-slate-950 py-3 text-center border-t border-slate-200 dark:border-white/5">
                            <p className="text-[9px] text-slate-500 dark:text-slate-600 uppercase tracking-[0.4em]">Precision Monitoring for the Agentic Era • AUM Context Foundry v1.2.0</p>
                        </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="flex gap-4 w-full">
                        {allowPdfDownload ? (
                            <button
                                onClick={handleDownload}
                                disabled={isDownloading}
                                className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-indigo-500/25"
                            >
                                <Download className="w-4 h-4" />
                                {isDownloading ? "Generating..." : "Download Report (PDF)"}
                            </button>
                        ) : (
                            <button
                                onClick={onUpgradeRequired}
                                className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-indigo-500/25"
                            >
                                <Lock className="w-4 h-4" />
                                Unlock PDF Reports
                            </button>
                        )}
                        <button
                            onClick={() => setShowMethodology(!showMethodology)}
                            className="flex items-center justify-center flex-1 gap-2 py-4 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-2xl font-semibold border-slate-200 border dark:border-white/10 transition-all shadow-sm dark:shadow-none"
                        >
                            <BookOpen className="w-4 h-4" />
                            How We Score
                        </button>
                    </div>

                    {/* METHODOLOGY EXPLAINER PANEL */}
                    <AnimatePresence>
                        {showMethodology && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="w-full bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-6 overflow-hidden mt-4"
                            >
                                <h3 className="text-slate-900 dark:text-white font-bold mb-4 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-indigo-500 dark:text-indigo-400" /> SoM Methodology
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                                    <div>
                                        <p className="text-indigo-600 dark:text-indigo-400 font-semibold mb-2">Formula</p>
                                        <code className="text-emerald-600 dark:text-emerald-400 font-mono text-xs bg-slate-200 dark:bg-black/30 px-3 py-2 rounded-lg block mb-3 overflow-x-auto">
                                            SoM = (0.4 × Semantic) + (0.6 × Claim Recall)
                                        </code>
                                        <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                                            <strong className="text-slate-800 dark:text-slate-300">Semantic (40%):</strong> Cosine similarity between your verified manifest vector and the AI&apos;s response vector. Measures directional alignment.
                                        </p>
                                        <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed mt-2">
                                            <strong className="text-slate-800 dark:text-slate-300">Claim Recall (60%):</strong> Ratio of factual claims from your manifest that were correctly reproduced in the AI&apos;s answer.
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-indigo-600 dark:text-indigo-400 font-semibold mb-2">Score Bands (SoM)</p>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex items-start gap-2"><span className="w-3 h-3 shrink-0 mt-0.5 rounded-full bg-emerald-500" /><span className="text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">&gt;85%</span><span className="text-slate-500">High Fidelity</span></div>
                                            <div className="flex items-start gap-2"><span className="w-3 h-3 shrink-0 mt-0.5 rounded-full bg-amber-500" /><span className="text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">66–85%</span><span className="text-slate-500">Minor Drift</span></div>
                                            <div className="flex items-start gap-2"><span className="w-3 h-3 shrink-0 mt-0.5 rounded-full bg-orange-500" /><span className="text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">40–65%</span><span className="text-slate-500">Severe Drift</span></div>
                                            <div className="flex items-start gap-2"><span className="w-3 h-3 shrink-0 mt-0.5 rounded-full bg-red-500" /><span className="text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">&lt;40%</span><span className="text-slate-500">Critical Drift</span></div>
                                        </div>
                                        <p className="text-indigo-600 dark:text-indigo-400 font-semibold mt-4 mb-2">Hallucination Flag Rule</p>
                                        <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                                            A model is flagged when verified contradictions are detected, or when claim recall is very low together with high semantic divergence. Low SoM alone does not automatically mean hallucination.
                                        </p>
                                        <p className="text-indigo-600 dark:text-indigo-400 font-semibold mt-4 mb-2">ASoV Radar (Contextual)</p>
                                        <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                                            The radar expands/collapses based on this run&apos;s observed consistency, factual recall, safety, sentiment alignment, and authority retention across GPT-4o, Gemini 3 Flash, and Claude 4.5 Sonnet.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>


            {/* OFF-SCREEN CAPTURE CONTAINER - NO LONGER USED (Switched to direct certificate capture v1.2.15) */}
        </motion.div>
    );
}
