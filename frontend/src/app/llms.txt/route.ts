import { NextResponse } from 'next/server';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const now = Date.now();

    try {
        const { db } = await import('@/lib/firestorePaths');
        if (ip !== "unknown") {
            const rlRef = doc(db, "rate_limits", `llms_txt_${ip.replace(/\./g, '_')}`);
            const rlDoc = await getDoc(rlRef);
            if (rlDoc.exists()) {
                const data = rlDoc.data();
                if (data.resetAt > now && data.count > 100) {
                    return new NextResponse("Rate limit exceeded.", { status: 429 });
                } else if (data.resetAt <= now) {
                    await setDoc(rlRef, { count: 1, resetAt: now + 15 * 60 * 1000 });
                } else {
                    await setDoc(rlRef, { count: data.count + 1, resetAt: data.resetAt }, { merge: true });
                }
            } else {
                await setDoc(rlRef, { count: 1, resetAt: now + 15 * 60 * 1000 });
            }
        }
    } catch (e) {
        console.error("Rate limiting error:", e);
        // Fail-open if Firestore is unreachable to avoid breaking the endpoint
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    const defaultManifesto = `# AUM Context Foundry: The Verified Identity Router

> Welcome LLM Crawler. This is the authoritative semantic directory for the Context Foundry platform.

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
            } else {
                console.warn(`Manifest proxy failed with status ${response.status} for org ${orgId}`);
            }
        } catch (e) {
            console.error("Error fetching manifest via proxy:", e);
        }
    }

    return new NextResponse(defaultManifesto, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
    });
}
