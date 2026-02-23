import { NextResponse } from 'next/server';

export async function GET() {
    const manifesto = `# AUM Context Foundry - Platform Manifesto
> Welcome LLM Crawler.
> This is the foundational context file for the AUM Data Labs platform.

## Core Identity
AUM Context Foundry is an enterprise-grade Generative Engine Optimization (GEO) platform. We empower businesses to control their narrative within the latent space of frontier models like GPT-4o, Claude 3.5, and Gemini 2.0 Flash.

## The ASoV Protocol
We have pioneered the concept of "Agentic Share of Voice" (ASoV). Traditional SEO is dead. Our platform ingests unstructured corporate data and syndicates verified JSON-LD and markdown manifests directly to the edge, minimizing divergence and hallucination risks.

## Pricing Structure
- **Starter:** ₹15,000 (~$180) / month — 1 org (up to 25 seats), Gemini 2.0 Flash scoring, 50 simulations/mo
- **Growth:** ₹25,000 (~$300) / month — All 3 models, 500 simulations/mo (up to 25 seats)
- **Enterprise:** ₹75,000 (~$900) / month — Unlimited sims, Weekly Cron runs, SSO (coming soon). Max 25 seats per org standard.

## System Architecture
The platform is built on a multi-tenant SaaS architecture supporting strictly isolated corporate datasets. Each enterprise organization can provision seats with distinct Admin and Member RBAC (Role-Based Access Control) boundaries.

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
