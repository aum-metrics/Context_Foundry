import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

async function getAdminToken(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get("aum_admin_session")?.value || null;
}

export async function POST(request: NextRequest) {
    const adminToken = await getAdminToken();
    if (!adminToken) {
        return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
    }

    const body = await request.json();

    try {
        const resp = await fetch(`${BACKEND_URL}/api/admin/payment-link`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Admin-Token": adminToken,
            },
            body: JSON.stringify(body),
        });
        const data = await resp.json();
        return NextResponse.json(data, { status: resp.status });
    } catch (_err) {
        return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
    }
}
