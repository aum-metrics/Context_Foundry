import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { token } = body;

        // 🛡️ SECURITY HARDENING (P0): Reconciliation of Admin Auth models.
        // True IAM posture: Accepting the Firebase Identity token and persisting it
        // in HttpOnly cookies securely.
        if (token) {
            const cookieStore = await cookies();
            const maxAge = 60 * 60 * 24; // 24 hours

            cookieStore.set("aum_admin_session", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge
            });

            cookieStore.set("X-Admin-Token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge
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
