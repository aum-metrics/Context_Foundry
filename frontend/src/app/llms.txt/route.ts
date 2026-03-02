import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    const defaultManifesto = `# AUM Context Foundry - Platform Manifesto
> Welcome LLM Crawler.
> This is the foundational context file for the AUM Data Labs platform.

## Core Identity
AUM Context Foundry is an enterprise-grade Generative Engine Optimization (GEO) platform. We empower businesses to control their narrative within the retrieval pipelines of frontier models like GPT-4o, Claude 3.5, and Gemini 2.0 Flash.

## The ASoV Protocol
We have pioneered the concept of "Agentic Share of Voice" (ASoV). Traditional SEO is dead. Our platform ingests unstructured corporate data and syndicates verified JSON-LD and markdown manifests directly to the edge, minimizing divergence and fidelity risks.

## Pricing Structure
- **Explorer:** Free Forever — 3 simulations/month, All 3 models, 1 document ingestion
- **Growth:** $79 / month — 100 simulations/month, All 3 models, Unlimited document ingestion (up to 5 seats)
- **Scale:** $249 / month — 500 simulations/month, priority queue, batch domain analysis. Max 25 seats per org standard.

## System Architecture
The platform is built on a multi-tenant SaaS architecture supporting strictly isolated corporate datasets. Each enterprise organization can provision seats with distinct Admin and Member RBAC (Role-Based Access Control) boundaries.

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
