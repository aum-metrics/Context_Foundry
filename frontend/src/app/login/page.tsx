"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { CodeSquare, ShieldAlert, Key, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSignUp, setIsSignUp] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (process.env.NODE_ENV === "development" && (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash")) {
                // Local mock bypass when user hasn't setup Firebase
                setTimeout(() => {
                    localStorage.setItem("mock_auth_user", email);
                    window.dispatchEvent(new Event("mock_auth_change"));
                    router.push("/dashboard");
                }, 1000);
                return;
            }

            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            router.push("/dashboard");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Authentication failed");
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 font-sans items-center justify-center relative overflow-hidden transition-colors duration-300">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative w-full max-w-md z-10 p-8 rounded-3xl border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl dark:shadow-2xl"
            >
                <div className="flex justify-center mb-6">
                    <Logo size={48} showText={false} theme="auto" />
                </div>

                <h1 className="text-2xl font-light text-slate-900 dark:text-white text-center mb-2 tracking-tight">
                    {isSignUp ? "Create Account" : "Enterprise Access"}
                </h1>
                <p className="text-slate-500 text-sm text-center mb-8 uppercase tracking-widest">AUM CONTEXT</p>

                {error && (
                    <div className="mb-6 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center text-sm text-rose-600 dark:text-rose-400">
                        <ShieldAlert className="w-4 h-4 mr-2 shrink-0" />
                        <span className="leading-snug">{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                            {isSignUp ? "Email Address" : "Corporate Email"}
                        </label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700/50 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors shadow-sm dark:shadow-none"
                            placeholder={isSignUp ? "you@company.com" : "you@company.com"}
                        />
                    </div>
                    <div>
                        <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                            {isSignUp ? "Create Password" : "Password"}
                        </label>
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700/50 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors shadow-sm dark:shadow-none"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-3 text-sm font-medium transition-colors disabled:opacity-50 flex justify-center items-center shadow-lg shadow-indigo-600/20"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : isSignUp ? (
                            <><UserPlus className="w-4 h-4 mr-2" /> Create Account</>
                        ) : (
                            "Sign In"
                        )}
                    </button>

                    {!isSignUp && (
                        <div className="relative pt-2">
                            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-slate-200 dark:border-white/5 h-px"></div>
                            <span className="relative z-10 bg-white dark:bg-slate-900 px-3 text-[10px] uppercase tracking-[0.2em] text-slate-400 mx-auto block w-max">Or</span>
                        </div>
                    )}

                    {!isSignUp && (
                        <button
                            type="button"
                            onClick={() => {
                                // For MVP persona flow, we initiate login assuming the organization has Okta configured
                                // In a full implementation, we'd lookup provider by domain first
                                const domain = email.split('@')[1];
                                if (!domain) {
                                    setError("Please enter your corporate email to initiate SSO.");
                                    return;
                                }
                                router.push(`/api/login?provider=google&domain=${domain}`);
                            }}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                        >
                            <Logo size={16} showText={false} /> Enterprise SSO
                        </button>
                    )}
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                        className="text-sm text-indigo-500 hover:text-indigo-400 transition-colors"
                    >
                        {isSignUp ? "Already have an account? Sign In" : "New here? Create an Account"}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
