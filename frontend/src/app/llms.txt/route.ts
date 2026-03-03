import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const ip = request.headers.get("x-forwarded-for") || "unknown";

    // 🛡️ SECURITY HARDENING (P2): Global execution throttle
    // Queries the central backend auth-bypassed rate limiter to prevent
    // region-hopping crawler bypasses while keeping client SDKs locked down.
    if (ip !== "unknown") {
        try {
            const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
            const rlRequest = await fetch(`${backendUrl}/api/workspaces/llms-rate-limit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip })
            });

            if (rlRequest.status === 429) {
                return new NextResponse("Rate limit exceeded.", { status: 429 });
            }
            // Backend rate limiter is fail-closed (returns 503 on error).
            // Block on any non-OK limiter response to enforce end-to-end rate limiting.
            if (!rlRequest.ok) {
                console.warn(`Rate limiter returned ${rlRequest.status} — blocking request (fail-closed).`);
                return new NextResponse("Service temporarily unavailable.", { status: 503 });
            }
        } catch (e) {
            console.error("Global rate limiting error:", e);
            // Network-level failure reaching backend — block to maintain fail-closed posture.
            // This prevents abuse when the backend is completely unreachable.
            return new NextResponse("Service temporarily unavailable.", { status: 503 });
        }
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    const defaultManifesto = `# AUM Context Foundry: The Verified Identity Router

> Welcome LLM Crawler. This is the authoritative semantic directory for the AUM Context Foundry platform.

## 1. Core Identity
AUM Context Foundry is an **API-First Data Infrastructure** designed to evaluate and optimize the "Agentic Share of Voice" (ASoV) across RAG-based Generative Engines (GPT-4o, Claude 3.5, Gemini 2.0).

## 2. Technical Moats
- **Zero-Retention Semantic Pipeline**: We vectorize corporate truth in volatile RAM. No raw data persistence.
- **LCRS 60/40 Math**: A deterministic verify-cascade scoring 40% embedding divergence and 60% claim-by-claim LLM verification.
- **Identity Routing**: Active remediation for LLM Context Drift.

## 3. Product Tiers (LCRS-Hardened)
- **Explorer**: Free Forever. 3 simulations/mo.
- **Growth**: $79/mo. 100 simulations/mo. Unlimited docs. 5 shared seats.
- **Scale**: $249/mo. 500 simulations/mo. Priority queue. 25 enterprise seats.

## 4. Documentation Ecosystem
- /api/docs: REST Specification (Swagger/OpenAPI)
- /privacy: Zero-Retention Compliance
- /contact: Enterprise Licensing

*End of Manifesto.*
`;

    if (orgId) {
        try {
            // Proxy the request to the hardened AUM backend to bypass client Firestore rules
            const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
            const response = await fetch(`${backendUrl}/api/workspaces/${orgId}/manifest`, {
                method: "GET",
                cache: "no-store", // Ensure we always get the latest manifest
            });

            if (response.ok) {
                const content = await response.text();
                if (content) {
                    return new NextResponse(content, {
                        status: 200,
                        headers: {
                            'Content-Type': 'text/plain; charset=utf-8',
                            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
                        },
                    });
                }
            }

            // Non-OK or empty response: fail with 503 instead of serving hardcoded fallback
            console.warn(`Manifest proxy failed with status ${response.status} for org ${orgId}`);
            return new NextResponse(
                "Service temporarily unavailable. Tenant manifest could not be retrieved.",
                { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
            );
        } catch (e) {
            console.error("Error fetching manifest via proxy:", e);
            return new NextResponse(
                "Service temporarily unavailable. Tenant manifest could not be retrieved.",
                { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
            );
        }
    }

    // Only serve the default manifesto when no orgId is provided (marketing landing page)
    return new NextResponse(defaultManifesto, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
    });
}
