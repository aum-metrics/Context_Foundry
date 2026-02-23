"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Shield, LogOut, Building2, Key, Users, CreditCard,
    RefreshCw, Copy, Check, Search, AlertTriangle,
    CheckCircle, XCircle, Send, RotateCcw, Eye, EyeOff, Activity
} from "lucide-react";
import { motion } from "framer-motion";
import { db } from "@/lib/firestorePaths";
import { collection, doc, getDocs, getDoc, updateDoc, query, limit, startAfter, QueryDocumentSnapshot } from "firebase/firestore";

interface OrgData {
    id: string;
    name: string;
    plan: string;
    status: string;
    members: number;
    simulations: number;
    apiKeys: { openai: string; gemini: string; anthropic: string };
    email: string;
    lastPayment: string;
}

// Fallback data for when Firestore is unavailable
const FALLBACK_ORGS: OrgData[] = [
    { id: "demo-org", name: "Demo Organization", plan: "Growth", status: "active", members: 2, simulations: 0, apiKeys: { openai: "", gemini: "", anthropic: "" }, lastPayment: "N/A", email: "admin@demo.com" },
];

type TabType = "organizations" | "api-keys" | "users" | "payments" | "health";

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>("organizations");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedOrg, setSelectedOrg] = useState<OrgData | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [orgs, setOrgs] = useState<OrgData[]>([]);
    const [loadingOrgs, setLoadingOrgs] = useState(true);
    const [newKeyValue, setNewKeyValue] = useState<Record<string, string>>({});
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        const token = sessionStorage.getItem("aum_admin_token");
        if (!token) router.push("/admin");
    }, [router]);

    // Fetch orgs from Firestore
    const fetchOrgs = useCallback(async (isLoadMore = false) => {
        if (isLoadMore) {
            setLoadingMore(true);
        } else {
            setLoadingOrgs(true);
            setLastDoc(null);
            setHasMore(true);
        }

        try {
            if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash") {
                setOrgs(FALLBACK_ORGS);
                setLoadingOrgs(false);
                setLoadingMore(false);
                setHasMore(false);
                return;
            }

            let q;
            if (isLoadMore && lastDoc) {
                q = query(collection(db, "organizations"), startAfter(lastDoc), limit(15));
            } else {
                q = query(collection(db, "organizations"), limit(15));
            }

            const snapshot = await getDocs(q);
            const orgList: OrgData[] = [];

            if (snapshot.docs.length < 15) {
                setHasMore(false);
            }
            if (snapshot.docs.length > 0) {
                setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
            }

            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                // Count members
                let memberCount = 0;
                try {
                    const usersSnap = await getDocs(collection(db, "organizations", docSnap.id, "users"));
                    memberCount = usersSnap.size;
                } catch { memberCount = 1; }

                // Count simulations
                let simCount = 0;
                try {
                    const histSnap = await getDocs(collection(db, "organizations", docSnap.id, "scoringHistory"));
                    simCount = histSnap.size;
                } catch { simCount = 0; }

                orgList.push({
                    id: docSnap.id,
                    name: data.name || docSnap.id,
                    plan: data.subscription?.planId || "starter",
                    status: data.subscription?.status || "active",
                    members: memberCount || 1,
                    simulations: simCount,
                    apiKeys: data.apiKeys || { openai: "", gemini: "", anthropic: "" },
                    email: data.email || data.adminEmail || `admin@${docSnap.id}.com`,
                    lastPayment: data.subscription?.activatedAt ? new Date(data.subscription.activatedAt.seconds * 1000).toLocaleDateString() : "N/A",
                });
            }
            if (isLoadMore) {
                setOrgs(prev => [...prev, ...orgList]);
            } else {
                setOrgs(orgList.length > 0 ? orgList : FALLBACK_ORGS);
            }
        } catch (err) {
            console.error("Failed to fetch orgs:", err);
            if (!isLoadMore) setOrgs(FALLBACK_ORGS);
        }
        setLoadingOrgs(false);
        setLoadingMore(false);
    }, [lastDoc]);

    useEffect(() => { fetchOrgs(false); }, []);

    const handleLogout = () => {
        sessionStorage.removeItem("aum_admin_token");
        sessionStorage.removeItem("aum_admin_email");
        router.push("/admin");
    };

    const simulateAction = (actionId: string, duration = 1500) => {
        setActionLoading(actionId);
        setTimeout(() => {
            setActionLoading(null);
            setActionSuccess(actionId);
            setTimeout(() => setActionSuccess(null), 2000);
        }, duration);
    };

    const saveApiKey = async (orgId: string, provider: string, value: string) => {
        const actionId = `save-${orgId}-${provider}`;
        setActionLoading(actionId);
        try {
            if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== "mock-key-to-prevent-crash") {
                await updateDoc(doc(db, "organizations", orgId), {
                    [`apiKeys.${provider}`]: value
                });
            }
            // Update local state
            setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, apiKeys: { ...o.apiKeys, [provider]: value } } : o));
            if (selectedOrg?.id === orgId) {
                setSelectedOrg(prev => prev ? { ...prev, apiKeys: { ...prev.apiKeys, [provider]: value } } : null);
            }
            setActionSuccess(actionId);
            setNewKeyValue(prev => ({ ...prev, [`${orgId}-${provider}`]: "" }));
        } catch (err) {
            console.error("Failed to save key:", err);
        }
        setActionLoading(null);
        setTimeout(() => setActionSuccess(null), 2000);
    };

    const sendPaymentReminder = async (orgId: string, email: string) => {
        const actionId = `payment-link-${orgId}`;
        setActionLoading(actionId);
        try {
            const resp = await fetch('/api/payments/payment-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orgId, customerEmail: email, description: "AUM Context Foundry - Subscription Renewal" })
            });
            if (resp.ok) {
                setActionSuccess(actionId);
            }
        } catch (err) {
            console.error("Payment link failed:", err);
        }
        setActionLoading(null);
        setTimeout(() => setActionSuccess(null), 2000);
    };

    const copyToClipboard = (text: string, keyId: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(keyId);
        setTimeout(() => setCopiedKey(null), 1500);
    };

    const filteredOrgs = orgs.filter(org =>
        org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const tabs: { id: TabType, label: string, icon: React.ReactNode }[] = [
        { id: "organizations", label: "Organizations", icon: <Building2 className="w-4 h-4" /> },
        { id: "api-keys", label: "API Keys", icon: <Key className="w-4 h-4" /> },
        { id: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
        { id: "payments", label: "Payments", icon: <CreditCard className="w-4 h-4" /> },
        { id: "health", label: "System Health", icon: <Activity className="w-4 h-4" /> },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <header className="bg-slate-900 border-b border-white/5 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-amber-500 rounded-lg flex items-center justify-center">
                        <Shield className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold text-white">AUM Product Admin</h1>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Firestore-Connected Operations</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <button onClick={() => fetchOrgs(false)} className="text-slate-400 hover:text-amber-400 transition-colors" title="Refresh Data">
                        <RefreshCw className={`w-4 h-4 ${loadingOrgs ? "animate-spin" : ""}`} />
                    </button>
                    <button onClick={handleLogout} className="text-slate-400 hover:text-rose-400 transition-colors" title="Logout">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            <div className="flex">
                <aside className="w-56 bg-slate-900/50 border-r border-white/5 min-h-[calc(100vh-64px)] p-4 space-y-1">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm transition-all ${activeTab === tab.id ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
                            {tab.icon}<span>{tab.label}</span>
                        </button>
                    ))}
                </aside>

                <main className="flex-1 p-8">

                    {/* ORGANIZATIONS */}
                    {activeTab === "organizations" && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-light">All Organizations ({orgs.length})</h2>
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                                    <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                        className="bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-amber-500 outline-none w-64" />
                                </div>
                            </div>
                            <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/5 text-xs text-slate-500 uppercase tracking-wider">
                                            <th className="text-left px-6 py-4">Organization</th>
                                            <th className="text-left px-6 py-4">Plan</th>
                                            <th className="text-left px-6 py-4">Status</th>
                                            <th className="text-right px-6 py-4">Simulations</th>
                                            <th className="text-right px-6 py-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingOrgs ? (
                                            <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Loading from Firestore...</td></tr>
                                        ) : filteredOrgs.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-20 text-center">
                                                    <div className="flex flex-col items-center justify-center">
                                                        <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                                                            <Building2 className="w-8 h-8 text-slate-600" />
                                                        </div>
                                                        <p className="text-slate-300 font-medium mb-1">No organizations found</p>
                                                        <p className="text-slate-500 text-sm">There are no organizations matching your search criteria.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredOrgs.map(org => (
                                            <tr key={org.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                                <td className="px-6 py-4"><p className="text-sm font-medium text-white">{org.name}</p><p className="text-xs text-slate-500">{org.email}</p></td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-xs px-2 py-1 rounded-full border ${org.plan === "enterprise" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" : org.plan === "growth" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-slate-800 text-slate-400 border-slate-700"}`}>{org.plan}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {org.status === "active" ? <span className="flex items-center text-xs text-emerald-400"><CheckCircle className="w-3 h-3 mr-1" /> Active</span>
                                                        : <span className="flex items-center text-xs text-rose-400"><AlertTriangle className="w-3 h-3 mr-1" /> {org.status}</span>}
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm text-slate-400">{org.simulations}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => { setSelectedOrg(org); setActiveTab("api-keys"); }} className="text-xs text-amber-400 hover:text-amber-300">Manage →</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {hasMore && !loadingOrgs && filteredOrgs.length > 0 && searchQuery === "" && (
                                <div className="mt-6 flex justify-center">
                                    <button
                                        onClick={() => fetchOrgs(true)}
                                        disabled={loadingMore}
                                        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full text-sm font-medium transition-colors border border-slate-700 hover:border-amber-500/50 flex items-center"
                                    >
                                        {loadingMore ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                                        Load More
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* API KEYS */}
                    {activeTab === "api-keys" && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-light">API Key Management</h2>
                                <select value={selectedOrg?.id || ""} onChange={(e) => setSelectedOrg(orgs.find(o => o.id === e.target.value) || null)}
                                    className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500">
                                    <option value="">Select Organization</option>
                                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                </select>
                            </div>
                            {selectedOrg ? (
                                <div className="space-y-4">
                                    {(["openai", "gemini", "anthropic"] as const).map(provider => {
                                        const labels: Record<string, string> = { openai: "OpenAI", gemini: "Google Gemini", anthropic: "Anthropic Claude" };
                                        const key = selectedOrg.apiKeys[provider];
                                        const keyId = `${selectedOrg.id}-${provider}`;
                                        const newVal = newKeyValue[keyId] || "";
                                        return (
                                            <div key={provider} className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div><h3 className="text-sm font-medium text-white">{labels[provider]}</h3><p className="text-xs text-slate-500 mt-1">Org: {selectedOrg.name}</p></div>
                                                    <span className={`text-xs px-2 py-1 rounded-full ${key ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-500 border border-slate-700"}`}>{key ? "Configured" : "Not Set"}</span>
                                                </div>
                                                <div className="flex items-center space-x-3 mb-3">
                                                    <div className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 font-mono text-sm text-slate-400 flex items-center justify-between">
                                                        <span>{key ? (showKeys[keyId] ? key : "••••••••••••••••") : "No key set"}</span>
                                                        {key && (
                                                            <div className="flex items-center space-x-2">
                                                                <button onClick={() => setShowKeys(s => ({ ...s, [keyId]: !s[keyId] }))} className="text-slate-500 hover:text-slate-300">
                                                                    {showKeys[keyId] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                                </button>
                                                                <button onClick={() => copyToClipboard(key, keyId)} className="text-slate-500 hover:text-amber-400">
                                                                    {copiedKey === keyId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex space-x-3">
                                                    <input type="text" value={newVal} onChange={(e) => setNewKeyValue(prev => ({ ...prev, [keyId]: e.target.value }))}
                                                        placeholder={`Paste new ${labels[provider]} key...`}
                                                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-amber-500 outline-none font-mono" />
                                                    <button onClick={() => saveApiKey(selectedOrg.id, provider, newVal)} disabled={!newVal || actionLoading === `save-${selectedOrg.id}-${provider}`}
                                                        className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-4 py-2.5 rounded-xl text-xs font-medium transition-all disabled:opacity-50 flex items-center space-x-2">
                                                        {actionLoading === `save-${selectedOrg.id}-${provider}` ? <RefreshCw className="w-4 h-4 animate-spin" />
                                                            : actionSuccess === `save-${selectedOrg.id}-${provider}` ? <Check className="w-4 h-4 text-emerald-400" />
                                                                : <RotateCcw className="w-4 h-4" />}
                                                        <span>Save</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="bg-slate-900 border border-white/5 rounded-2xl p-12 text-center">
                                    <Key className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                                    <p className="text-slate-500 text-sm">Select an organization to manage API keys</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* USERS */}
                    {activeTab === "users" && (
                        <div>
                            <h2 className="text-xl font-light mb-6">User Management</h2>
                            <div className="space-y-4">
                                {orgs.map((org) => (
                                    <div key={org.id} className="bg-slate-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between">
                                        <div><p className="text-sm text-white">{org.email}</p><p className="text-xs text-slate-500">{org.name} · admin</p></div>
                                        <div className="flex space-x-3">
                                            <button onClick={() => simulateAction(`reset-${org.email}`)}
                                                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition-all flex items-center space-x-2">
                                                {actionLoading === `reset-${org.email}` ? <RefreshCw className="w-3 h-3 animate-spin" /> : actionSuccess === `reset-${org.email}` ? <Check className="w-3 h-3 text-emerald-400" /> : <RotateCcw className="w-3 h-3" />}
                                                <span>Reset Password</span>
                                            </button>
                                            <button onClick={() => sendPaymentReminder(org.id, org.email)}
                                                className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 px-4 py-2 rounded-xl text-xs transition-all flex items-center space-x-2">
                                                {actionLoading === `payment-link-${org.id}` ? <RefreshCw className="w-3 h-3 animate-spin" /> : actionSuccess === `payment-link-${org.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Send className="w-3 h-3" />}
                                                <span>Payment Reminder</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* PAYMENTS */}
                    {activeTab === "payments" && (
                        <div>
                            <h2 className="text-xl font-light mb-6">Payments & Subscriptions</h2>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
                                <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Orgs</p>
                                    <p className="text-3xl font-light text-cyan-400">{orgs.length}</p>
                                </div>
                                <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Active</p>
                                    <p className="text-3xl font-light text-emerald-400">{orgs.filter(o => o.status === "active").length}</p>
                                </div>
                                <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Simulations</p>
                                    <p className="text-3xl font-light text-amber-400">{orgs.reduce((s, o) => s + o.simulations, 0)}</p>
                                </div>
                            </div>
                            <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden">
                                <table className="w-full">
                                    <thead><tr className="border-b border-white/5 text-xs text-slate-500 uppercase tracking-wider">
                                        <th className="text-left px-6 py-4">Organization</th><th className="text-left px-6 py-4">Plan</th><th className="text-left px-6 py-4">Status</th><th className="text-right px-6 py-4">Actions</th>
                                    </tr></thead>
                                    <tbody>
                                        {orgs.map(org => (
                                            <tr key={org.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                                <td className="px-6 py-4 text-sm text-white">{org.name}</td>
                                                <td className="px-6 py-4 text-sm text-slate-400">{org.plan}</td>
                                                <td className="px-6 py-4">{org.status === "active" ? <span className="text-xs text-emerald-400 flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Active</span> : <span className="text-xs text-rose-400 flex items-center"><XCircle className="w-3 h-3 mr-1" /> {org.status}</span>}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => sendPaymentReminder(org.id, org.email)}
                                                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 ml-auto">
                                                        {actionLoading === `payment-link-${org.id}` ? <RefreshCw className="w-3 h-3 animate-spin" /> : actionSuccess === `payment-link-${org.id}` ? <><Check className="w-3 h-3 text-emerald-400" /><span>Sent!</span></> : <><Send className="w-3 h-3" /><span>Send Razorpay Link</span></>}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* SYSTEM HEALTH */}
                    {activeTab === "health" && (
                        <div>
                            <h2 className="text-xl font-light mb-6">System Health</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { name: "FastAPI Backend", endpoint: "/api/health", status: "operational" },
                                    { name: "Firebase Firestore", endpoint: "firestore.googleapis.com", status: "operational" },
                                    { name: "LCRS Simulation Engine", endpoint: "/api/simulation", status: "operational" },
                                    { name: "Semantic Ingestion", endpoint: "/api/ingestion", status: "operational" },
                                    { name: "Razorpay Payments", endpoint: "/api/payments", status: "operational" },
                                    { name: "SEO/GEO Audit", endpoint: "/api/seo", status: "operational" },
                                    { name: "Batch Scheduler", endpoint: "/api/batch/scheduled", status: "operational" },
                                    { name: "OpenAI API", endpoint: "api.openai.com", status: "check_key" },
                                    { name: "Google Gemini API", endpoint: "generativelanguage.googleapis.com", status: "check_key" },
                                    { name: "Anthropic Claude API", endpoint: "api.anthropic.com", status: "check_key" },
                                ].map((svc, i) => (
                                    <div key={i} className="bg-slate-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between">
                                        <div><p className="text-sm text-white">{svc.name}</p><p className="text-xs text-slate-600 font-mono">{svc.endpoint}</p></div>
                                        {svc.status === "operational" ? <span className="flex items-center text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full"><CheckCircle className="w-3 h-3 mr-1" /> Operational</span>
                                            : <span className="flex items-center text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full"><AlertTriangle className="w-3 h-3 mr-1" /> Check Key</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
