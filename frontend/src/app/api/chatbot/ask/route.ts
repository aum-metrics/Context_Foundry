import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const auth = req.headers.get("Authorization");

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/chatbot/ask`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": auth || ""
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            return NextResponse.json(errorData, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Chatbot Proxy Error:", error);
        return NextResponse.json({ detail: "Internal Server Error in Chatbot Proxy" }, { status: 500 });
    }
}
