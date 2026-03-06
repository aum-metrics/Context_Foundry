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
    const normalizedPathname = pathname.replace(/\/$/, "") || "/";
    const isPublicPath = PUBLIC_PATHS.includes(normalizedPathname);

    useEffect(() => {
        const savedMockUser = typeof window !== 'undefined' ? localStorage.getItem("mock_auth_user") : null;
        const isDemoUser = savedMockUser === "demo@demo.com";
        const isMockMode = (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
            process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash");

        if (isDemoUser || isMockMode) {
            console.warn(isDemoUser ? "👤 DEMO ACCOUNT ACTIVE" : "🔓 MOCK AUTH MODE ACTIVE");

            const mockUser = {
                uid: isDemoUser ? "demo_uid" : "mock_uid_dev",
                email: isDemoUser ? "demo@demo.com" : (savedMockUser || "dev@localhost"),
                displayName: isDemoUser ? "Demo Account" : "Dev User",
                getIdToken: async () => isDemoUser ? "mock-demo-token" : "mock-dev-token",
                getIdTokenResult: async () => ({
                    claims: {
                        org_role: "admin",
                        org_id: isDemoUser ? "demo_org_id" : "mock_org_id"
                    }
                }),
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
