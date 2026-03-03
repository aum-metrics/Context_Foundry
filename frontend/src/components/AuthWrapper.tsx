"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";
import { OrganizationProvider } from "./OrganizationContext";

const PUBLIC_PATHS = ["/", "/login", "/llms.txt", "/privacy", "/terms", "/contact", "/status", "/methods", "/security", "/about", "/legal", "/admin", "/admin/login"];

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const isPublicPath = PUBLIC_PATHS.includes(pathname);

    useEffect(() => {
        // 🛡️ SECURITY HARDENING (P0): Block mock bypass in production entirely
        const isMockMode = (process.env.NODE_ENV === "development" &&
            (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
                process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash"));

        if (isMockMode) {
            console.warn("🔓 MOCK AUTH MODE ACTIVE: Bypassing Firebase Auth");
            const mockUser = {
                uid: "mock_uid_dev",
                email: "dev@localhost",
                displayName: "Dev User",
                getIdToken: async () => "mock-dev-token",
            } as unknown as User;

            setUser(mockUser);
            setLoading(false);
            if (!isPublicPath && pathname === "/login") {
                router.push("/dashboard");
            }
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);

            // Allow public paths
            if (isPublicPath) return;

            if (!currentUser && pathname !== "/login") {
                router.push("/login");
            } else if (currentUser && pathname === "/login") {
                router.push("/dashboard");
            }
        });

        return () => unsubscribe();
    }, [router, pathname, isPublicPath]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200">
                <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full border-t-2 border-indigo-500 animate-spin mb-4"></div>
                    <span className="text-sm text-slate-500 uppercase tracking-widest">Validating Session</span>
                </div>
            </div>
        );
    }

    if (!user && !isPublicPath) {
        return null; // Redirecting
    }

    if (user) {
        return (
            <OrganizationProvider user={user}>
                {children}
            </OrganizationProvider>
        );
    }

    return <>{children}</>;
}
