import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    const cookieStore = await cookies();
    cookieStore.delete("aum_admin_session");
    cookieStore.delete("X-Admin-Token");
    return NextResponse.json({ success: true });
}
