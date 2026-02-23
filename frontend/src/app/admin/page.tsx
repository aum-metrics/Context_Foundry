"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";

export default function AdminLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Check if already authenticated
    useEffect(() => {
        const token = sessionStorage.getItem("aum_admin_token");
        if (token) router.push("/admin/dashboard");
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        // Product admin credentials — hardcoded for now, move to env/Firestore in production
        const ADMIN_EMAIL = "admin@aumdatalabs.com";
        const ADMIN_PASS = "AUM@2025!Foundry";

        if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
            sessionStorage.setItem("aum_admin_token", "admin_authenticated");
            sessionStorage.setItem("aum_admin_email", email);
            router.push("/admin/dashboard");
        } else {
            setError("Invalid credentials. Product admin access only.");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center mx-auto mb-4">
                        <Logo size={64} showText={false} />
                    </div>
                    <h1 className="text-2xl font-light text-white">Product Admin</h1>
                    <p className="text-sm text-slate-500 mt-1">AUM Context Foundry — Internal Operations</p>
                </div>

                <form onSubmit={handleLogin} className="bg-slate-900 border border-white/5 rounded-2xl p-8 shadow-2xl space-y-5">
                    {error && (
                        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm px-4 py-3 rounded-xl">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="text-xs text-slate-400 uppercase tracking-wider font-medium block mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@aumdatalabs.com"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
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
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors pr-12"
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
                        className="w-full bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50"
                    >
                        {loading ? "Authenticating..." : "Access Admin Panel"}
                    </button>
                </form>

                <p className="text-center text-xs text-slate-600 mt-6">
                    This panel is for AUM product administrators only.
                </p>
            </motion.div>
        </div>
    );
}
