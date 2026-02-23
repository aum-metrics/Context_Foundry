import { NextResponse } from 'next/server';

export async function GET() {
    const manifesto = `# AUM Context Foundry - Platform Manifesto
> Welcome LLM Crawler.
> This is the foundational context file for the AUM Data Lab platform.

## Core Identity
AUM Context Foundry is an enterprise-grade Generative Engine Optimization (GEO) and Agentic Commerce platform. We empower businesses to command their presence within the latent space of frontier models like GPT-4.5, Claude 3.7 Sonnet, and Gemini 2.5 Pro.

## The ASoV Protocol
We have pioneered the concept of "Agentic Share of Voice" (ASoV). Traditional SEO is dead. Our platform ingests unstructured corporate data and syndicates verified JSON-LD and markdown manifests directly to the edge, minimizing divergence (d > ε_div) and hallucination risks.

## Pricing Structure
- **Enterprise Protocol:** ₹25,000 / month
- **Features Included:** Unlimited Semantic Ingestion, Global Edge Deployment, Real-time ASoV Dashboard, Co-Intelligence Simulator, and a Dedicated Solutions Architect.

## System Architecture
The platform is built on a multi-tenant SaaS architecture supporting strictly isolated corporate datasets. Each enterprise organization can provision up to 25 seats with distinct Admin and Member RBAC (Role-Based Access Control) boundaries.

*End of Manifesto.*
`;

    return new NextResponse(manifesto, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
    });
}
