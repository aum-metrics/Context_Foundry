"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { CodeSquare, ShieldAlert, Key } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash") {
                // Local mock bypass when user hasn't setup Firebase
                setTimeout(() => {
                    localStorage.setItem("mock_auth_user", email);
                    window.dispatchEvent(new Event("mock_auth_change"));
                    router.push("/dashboard");
                }, 1000);
                return;
            }

            await signInWithEmailAndPassword(auth, email, password);
            router.push("/dashboard");
        } catch (err: any) {
            // If user not found, create them to allow easy demo testing
            if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found") {
                try {
                    await createUserWithEmailAndPassword(auth, email, password);
                    router.push("/dashboard");
                } catch (signupErr: any) {
                    setError(signupErr.message);
                    setLoading(false);
                }
            } else {
                setError(err.message);
                setLoading(false);
            }
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
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <CodeSquare className="w-6 h-6 text-white" />
                    </div>
                </div>

                <h1 className="text-2xl font-light text-slate-900 dark:text-white text-center mb-2 tracking-tight">Enterprise Access</h1>
                <p className="text-slate-500 text-sm text-center mb-8 uppercase tracking-widest">AUM Context Foundry</p>

                {error && (
                    <div className="mb-6 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center text-sm text-rose-600 dark:text-rose-400">
                        <ShieldAlert className="w-4 h-4 mr-2 shrink-0" />
                        <span className="leading-snug">{error}</span>
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Corporate Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700/50 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors shadow-sm dark:shadow-none"
                            placeholder="director@acme.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Authorization Token</label>
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                            <input
                                type="password"
                                required
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
                        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "Authenticate Entity"}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
