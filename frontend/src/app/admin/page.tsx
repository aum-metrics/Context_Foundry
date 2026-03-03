"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/Logo";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AdminLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Check if already authenticated via server cookie
    useEffect(() => {
        fetch("/api/admin/verify")
            .then(res => res.json())
            .then(data => {
                if (data.verified) router.push("/admin/dashboard");
            })
            .catch(() => { });
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            // First authenticate with Firebase
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const token = await userCredential.user.getIdToken();

            const res = await fetch("/api/admin/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    router.push("/admin/dashboard");
                } else {
                    setError(data.error || "Invalid credentials. Product admin access only.");
                }
            } else {
                setError("Invalid credentials. Product admin access only.");
            }
        } catch (_err) {
            setError("Authentication failed or service unavailable.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-slate-900 dark:text-slate-200">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-xl border border-slate-200 dark:border-slate-800">
                <div className="flex justify-center mb-6">
                    <Logo size={64} showText={false} />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 text-center">Admin Access</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 text-center">Sign in to manage the platform</p>

                {error && (
                    <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-lg text-sm flex items-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="text-xs text-slate-400 uppercase tracking-wider font-medium block mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@aumdatalabs.com"
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-xs text-slate-400 uppercase tracking-wider font-medium block mb-2">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2.5 font-medium transition-colors disabled:opacity-50 mt-6"
                    >
                        {loading ? "Authenticating..." : "Access Admin Panel"}
                    </button>
                </form>

                <p className="text-center text-xs text-slate-600 mt-6">
                    This panel is for AUM product administrators only.
                </p>
            </div>
        </div>
    );
}
