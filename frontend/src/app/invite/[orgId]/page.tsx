"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { CheckCircle, AlertCircle, Loader2, Home } from "lucide-react";
import { Logo } from "@/components/Logo";

import { Suspense } from "react";

function AcceptInviteContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const orgId = params.orgId as string;
    const inviteId = searchParams.get("inviteId");
    const router = useRouter();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("");
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!orgId) return;

        const acceptInvite = async () => {
            try {
                // P0 Fix: Ensure inviteId is present before attempting accept
                if (!inviteId) {
                    setStatus("error");
                    setMessage("Invitation ID is missing. Please use the link from your invitation email.");
                    return;
                }

                // If user not logged in, we can't accept via backend yet
                if (!auth.currentUser) {
                    setStatus("error");
                    setMessage("Please log in first to accept this invitation.");
                    return;
                }

                const token = await auth.currentUser.getIdToken();
                const response = await fetch(`/api/workspaces/${orgId}/accept-invite`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ inviteId }) // P0 Fix: Send the required inviteId
                });

                if (response.ok) {
                    setStatus("success");
                    setMessage("Welcome to the team! Your access has been provisioned.");
                } else {
                    const data = await response.json();
                    setStatus("error");
                    setMessage(data.detail || "Failed to join organization.");
                }
            } catch (err) {
                setStatus("error");
                setMessage("An unexpected error occurred.");
            }
        };

        if (user) {
            acceptInvite();
        }
    }, [orgId, inviteId, user]);

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent">
            <div className="w-full max-w-md p-8 rounded-3xl border border-slate-200 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl text-center">
                <div className="flex justify-center mb-8">
                    <Logo size={48} showText={false} />
                </div>

                {status === "loading" && (
                    <div className="space-y-4">
                        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto" />
                        <h1 className="text-xl font-medium text-slate-900 dark:text-white">Joining Workspace...</h1>
                        <p className="text-slate-500 text-sm">Reviewing authorization and provisioning seats.</p>
                    </div>
                )}

                {status === "success" && (
                    <div className="space-y-6">
                        <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
                        <h1 className="text-2xl font-light tracking-tight text-slate-900 dark:text-white">Access Granted</h1>
                        <p className="text-slate-600 dark:text-slate-400">{message}</p>
                        <button
                            onClick={() => router.push("/dashboard")}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-600/20"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                )}

                {status === "error" && (
                    <div className="space-y-6">
                        <AlertCircle className="w-16 h-16 text-rose-500 mx-auto" />
                        <h1 className="text-2xl font-light tracking-tight text-slate-900 dark:text-white">Invitation Issue</h1>
                        <p className="text-slate-600 dark:text-slate-400">{message}</p>
                        <div className="flex flex-col gap-3 pt-4">
                            {!user && (
                                <button
                                    onClick={() => router.push(`/login?redirect=/invite/${orgId}`)}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-600/20"
                                >
                                    Login to Continue
                                </button>
                            )}
                            <button
                                onClick={() => router.push("/")}
                                className="w-full py-3 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                            >
                                <Home className="w-4 h-4" /> Return Home
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function AcceptInvitePage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            </div>
        }>
            <AcceptInviteContent />
        </Suspense>
    );
}
