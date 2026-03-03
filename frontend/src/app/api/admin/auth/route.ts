import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password } = body;

        const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
        const ADMIN_PASS = process.env.ADMIN_PASS;

        // 🛡️ SECURITY HARDENING (P0): Reconciliation of Admin Auth models.
        // During the transition to pure Firebase Admin Claims, we support administrative 
        // session establishment via the ADMIN_SESSION_SECRET.
        if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
            const cookieStore = await cookies();
            cookieStore.set("aum_admin_session", ADMIN_SESSION_SECRET, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 // 24 hours
            });

            return NextResponse.json({
                success: true,
                message: "Admin session established."
            });
        }

        return NextResponse.json({
            success: false,
            error: "Authentication failed. Please use secure Admin credentials."
        }, { status: 403 });
    } catch (_error) {
        return NextResponse.json({ success: false, error: "Authentication failed" }, { status: 500 });
    }
}
