import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

async function getAdminToken(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get("aum_admin_session")?.value || null;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ org_id: string }> }) {
    const adminToken = await getAdminToken();
    if (!adminToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { org_id } = await context.params;
    try {
        const resp = await fetch(`${BACKEND_URL}/api/admin/orgs/${org_id}/details`, {
            headers: { "X-Admin-Token": adminToken },
            cache: "no-store",
        });
        const data = await resp.json();
        return NextResponse.json(data, { status: resp.status });
    } catch {
        return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
    }
}
