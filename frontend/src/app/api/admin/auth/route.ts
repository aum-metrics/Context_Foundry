import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { token } = body; // This is the client-side idToken from Firebase

        // 🛡️ SECURITY HARDENING (P1): Enterprise Admin Auth
        // Instead of storing the raw client token, we exchange it for a true 
        // Firebase Server Session Cookie to prevent client-side forgery and allow revocation.
        if (token) {
            // First, call our own backend to mint the session cookie.
            // (We have to do this because the Firebase Admin SDK is in Python)
            const backendRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/admin/mint-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!backendRes.ok) {
                return NextResponse.json({ success: false, error: "Failed to mint secure session." }, { status: 403 });
            }

            const sessionData = await backendRes.json();
            const sessionCookie = sessionData.session_cookie;

            const cookieStore = await cookies();
            const maxAge = 60 * 60 * 24; // 24 hours

            // Set the new Session Cookie instead of the raw idToken
            cookieStore.set("aum_admin_session", sessionCookie, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge
            });

            cookieStore.set("X-Admin-Token", sessionCookie, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge
            });

            return NextResponse.json({
                success: true,
                message: "Secure Admin session established."
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

export async function DELETE() {
    try {
        const cookieStore = await cookies();
        cookieStore.delete("aum_admin_session");
        cookieStore.delete("X-Admin-Token");

        return NextResponse.json({
            success: true,
            message: "Admin session securely terminated."
        });
    } catch (_error) {
        return NextResponse.json({ success: false, error: "Failed to terminate session" }, { status: 500 });
    }
}
