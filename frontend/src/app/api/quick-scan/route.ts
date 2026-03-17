// frontend/src/app/api/quick-scan/route.ts
//
// Proxy layer: forwards the public quick-scan POST to FastAPI backend.
// IMPORTANT: forwards the real client IP so backend rate limiting works.
//
// Deploy to: frontend/src/app/api/quick-scan/route.ts

import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_BASE_URL
    ?? process.env.NEXT_PUBLIC_API_URL
    ?? "http://127.0.0.1:8000";

export const runtime = "edge"; // Use edge runtime for lowest latency

export async function POST(req: NextRequest) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Extract real client IP for backend rate limiting
    const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        "unknown";

    try {
        const upstream = await fetch(`${BACKEND}/api/quick-scan`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Forwarded-For": clientIp,
                "X-Real-IP": clientIp,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(28_000), // 28s — backend has 25s timeout
        });

        const data = await upstream.json();
        return NextResponse.json(data, { status: upstream.status });
    } catch (err) {
        const isTimeout = err instanceof Error && err.name === "TimeoutError";
        const fallbackName = (body as { company_name?: string } | undefined)?.company_name ?? "Your company";
        return NextResponse.json(
            {
                company_name: fallbackName,
                score: 32,
                score_label: "Weak AI Presence",
                low_visibility: true,
                top_competitor: "A larger, better-documented competitor",
                key_gap: "No verified enterprise transformation case studies found",
                winning_category: "General B2B services",
                summary: `AI systems have limited verified data about ${fallbackName} and default to more prominent alternatives.`,
                scanned_at: new Date().toISOString(),
                demo: true,
                error: isTimeout ? "timeout" : "upstream_error",
                message: isTimeout
                    ? "The scan took too long. Please try again."
                    : "Scan service temporarily unavailable.",
            },
            { status: isTimeout ? 504 : 502 }
        );
    }
}
