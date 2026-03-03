import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get("aum_admin_session")?.value;

    if (token) {
        return NextResponse.json({ success: true, verified: true });
    }

    return NextResponse.json({ success: false, verified: false }, { status: 401 });
}
