import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
        return new NextResponse("Tenant manifest requires an orgId.", {
            status: 400,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }

    try {
        const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const response = await fetch(`${backendUrl}/api/workspaces/${orgId}/manifest-full`, {
            method: "GET",
            cache: "no-store",
        });

        if (!response.ok) {
            return new NextResponse(
                "Service temporarily unavailable. Tenant full manifest could not be retrieved.",
                { status: response.status === 404 ? 404 : 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
            );
        }

        const content = await response.text();
        return new NextResponse(content, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'public, max-age=3600, s-maxage=86400',
            },
        });
    } catch (e) {
        console.error("Error fetching full manifest via proxy:", e);
        return new NextResponse(
            "Service temporarily unavailable. Tenant full manifest could not be retrieved.",
            { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
        );
    }
}
