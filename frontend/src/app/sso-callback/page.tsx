"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signInWithCustomToken } from "firebase/auth";
import { Loader2 } from "lucide-react";

function SSOCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    useEffect(() => {
        if (error) {
            console.error("SSO Error:", error);
            router.push("/login?error=sso_failed");
            return;
        }

        if (token) {
            signInWithCustomToken(auth, token)
                .then(() => {
                    router.push("/dashboard");
                })
                .catch((err) => {
                    console.error("Firebase Custom Token Auth Failed:", err);
                    router.push("/login?error=auth_failed");
                });
        } else {
            router.push("/login");
        }
    }, [token, error, router]);

    return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white p-6">
            <div className="text-center space-y-6">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto" />
                <h1 className="text-2xl font-bold tracking-tight">Finalizing SSO Secure Login...</h1>
                <p className="text-slate-400">Please wait while we establish your enterprise session.</p>
            </div>
        </div>
    );
}

export default function SSOCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <SSOCallbackContent />
        </Suspense>
    );
}
