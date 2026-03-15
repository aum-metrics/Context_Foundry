"use client";

import { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { auth } from "@/lib/firebase";

export default function AuthErrorCard({
    title = "Session expired",
    description = "We couldn’t validate your session. Please re-authenticate to continue.",
    actionLabel = "Re-authenticate",
    onAction,
}: {
    title?: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => Promise<void> | void;
}) {
    const [working, setWorking] = useState(false);

    const handleAction = async () => {
        if (working) return;
        setWorking(true);
        try {
            if (onAction) {
                await onAction();
            } else {
                try {
                    await auth.signOut();
                } catch (_err) {
                    // Best-effort sign-out; redirect regardless
                }
            }
        } finally {
            window.location.href = "/login?error=session_expired";
        }
    };

    return (
        <div className="w-full rounded-3xl border border-rose-200 dark:border-rose-500/20 bg-white dark:bg-slate-900 p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-4 text-rose-500">
                <AlertTriangle className="w-5 h-5" />
                <h2 className="text-lg font-bold">{title}</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{description}</p>
            <button
                onClick={handleAction}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-rose-500/30 transition-all hover:bg-rose-600 active:scale-95"
            >
                <RefreshCw className={`h-4 w-4 ${working ? "animate-spin" : ""}`} />
                {working ? "Reconnecting..." : actionLabel}
            </button>
        </div>
    );
}
