import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password } = body;

        // STRICT AUDIT FIX: No hardcoded fallbacks for admin credentials
        const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
        const ADMIN_PASS = process.env.ADMIN_PASS;

        if (!ADMIN_EMAIL || !ADMIN_PASS) {
            console.error("❌ CRITICAL: ADMIN_EMAIL or ADMIN_PASS environment variables are missing.");
            return NextResponse.json({ success: false, error: "System configuration error." }, { status: 500 });
        }

        if (!ADMIN_SESSION_SECRET) {
            console.error("❌ CRITICAL: ADMIN_SESSION_SECRET environment variable is missing.");
            return NextResponse.json({ success: false, error: "System configuration error." }, { status: 500 });
        }

        if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
            const cookieStore = await cookies();
            cookieStore.set("aum_admin_session", ADMIN_SESSION_SECRET, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                path: "/",
                maxAge: 60 * 60 * 8
            });
            return NextResponse.json({ success: true, token: "admin_authenticated" });
        }

        return NextResponse.json({ success: false, error: "Invalid credentials. Product admin access only." }, { status: 401 });
    } catch (_error) {
        return NextResponse.json({ success: false, error: "Authentication failed" }, { status: 500 });
    }
}
