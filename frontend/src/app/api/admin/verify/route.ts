import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "";

export async function GET() {
    if (!ADMIN_SESSION_SECRET) {
        return NextResponse.json({ success: false, verified: false }, { status: 500 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("aum_admin_session")?.value;

    if (token && token === ADMIN_SESSION_SECRET) {
        return NextResponse.json({ success: true, verified: true });
    }

    return NextResponse.json({ success: false, verified: false }, { status: 401 });
}
