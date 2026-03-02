import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

async function getAdminToken(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get("aum_admin_session")?.value || null;
}

export async function GET(request: NextRequest) {
    const adminToken = await getAdminToken();
    if (!adminToken || adminToken !== "admin_authenticated_v1") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const offset = searchParams.get("offset") || "0";
    const pageSize = searchParams.get("page_size") || "15";

    try {
        const resp = await fetch(`${BACKEND_URL}/api/admin/orgs?offset=${offset}&page_size=${pageSize}`, {
            headers: { "X-Admin-Token": adminToken },
        });
        const data = await resp.json();
        return NextResponse.json(data, { status: resp.status });
    } catch (err) {
        return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
    }
}
