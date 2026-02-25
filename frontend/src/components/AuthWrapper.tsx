"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";
import { OrganizationProvider } from "./OrganizationContext";

const PUBLIC_PATHS = ["/", "/login", "/llms.txt", "/privacy", "/terms", "/contact", "/status"];

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const isPublicPath = PUBLIC_PATHS.includes(pathname);

    useEffect(() => {
        if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash") {
            const checkMockAuth = () => {
                const mockUserEmail = localStorage.getItem("mock_auth_user");

                if (isPublicPath) {
                    setLoading(false);
                    return;
                }

                if (mockUserEmail) {
                    setUser({ email: mockUserEmail } as User);
                    setLoading(false);
                    if (pathname === "/login") router.push("/dashboard");
                } else {
                    setUser(null);
                    setLoading(false);
                    if (pathname !== "/login") router.push("/login");
                }
            };

            checkMockAuth();
            window.addEventListener("mock_auth_change", checkMockAuth);
            return () => window.removeEventListener("mock_auth_change", checkMockAuth);
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
