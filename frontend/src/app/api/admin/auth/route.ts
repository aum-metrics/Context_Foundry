import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password } = body;

        // Ensure environment variables are set strings, defaulting to prevent accidental match on empty
        const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@aumdatalabs.com";
        const ADMIN_PASS = process.env.ADMIN_PASS || "AUM@2025!Foundry"; // Fallback only if missing in env

        if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
            return NextResponse.json({ success: true, token: "admin_authenticated" });
        }

        return NextResponse.json({ success: false, error: "Invalid credentials. Product admin access only." }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Authentication failed" }, { status: 500 });
    }
}
