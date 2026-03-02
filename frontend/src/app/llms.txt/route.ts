import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

const rateLimit = new Map<string, { count: number, resetAt: number }>();

export async function GET(request: Request) {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const now = Date.now();

    let limitData = rateLimit.get(ip);
    if (!limitData || limitData.resetAt < now) {
        limitData = { count: 1, resetAt: now + 15 * 60 * 1000 };
    } else {
        limitData.count++;
        if (limitData.count > 100) return new NextResponse("Rate limit exceeded.", { status: 429 });
    }
    rateLimit.set(ip, limitData);

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
            const { db } = await import('@/lib/firestorePaths');
            const manifestDoc = await getDoc(doc(db, "organizations", orgId, "manifests", "default"));
            if (manifestDoc.exists()) {
                const data = manifestDoc.data();
                if (data.content) {
                    return new NextResponse(data.content, {
                        status: 200,
                        headers: {
                            'Content-Type': 'text/plain; charset=utf-8',
                            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
                        },
                    });
                }
            }
        } catch (e) {
            console.error("Error fetching manifest:", e);
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
