import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get("aum_admin_session")?.value;

    if (!token) {
        return NextResponse.json({ success: false, verified: false }, { status: 401 });
    }

    try {
        const backendRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/admin/verify-session`, {
            method: 'GET',
            headers: {
                'X-Admin-Token': token
            },
            cache: 'no-store'
        });

        if (backendRes.ok) {
            return NextResponse.json({ success: true, verified: true });
        }
    } catch (e) {
        console.error("Backend verify failed", e);
    }

    return NextResponse.json({ success: false, verified: false }, { status: 401 });
}
