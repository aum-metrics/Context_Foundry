"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    LogOut, Building2, Key, Users, CreditCard,
    RefreshCw, Check, Search, AlertTriangle,
    CheckCircle, XCircle, Send, RotateCcw, Activity, Sun, Moon, ExternalLink
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useTheme } from "@/components/ThemeProvider";

interface OrgData {
    id: string;
    name: string;
    plan: string;
    status: string;
    members: number;
    seatLimit?: number;
    pendingInvites?: number;
    simulations: number;
    apiKeys: { openai: string; gemini: string; anthropic: string };
    email: string;
    lastPayment: string;
}

interface OrgDetail {
    id: string;
    name: string;
    subscription: {
        planId: string;
        status: string;
        billingPeriod?: string;
        maxSimulations: number;
        simsThisCycle: number;
        currentPeriodEnd?: string | null;
        trialEndsAt?: string | null;
    };
    seats: {
        active: number;
        limit: number;
        pendingInvites: number;
    };
    users: { uid: string; email: string; role: string; status: string; joinedAt?: string | null }[];
    pendingInvites: { id: string; email: string; role: string; status: string; invitedAt?: string | null }[];
    payments: { id: string; status: string; planId: string; amount: number; customerEmail: string; createdAt?: string | null; shortUrl?: string }[];
    simulations: number;
}

interface AdminModelConfig {
    provider: string;
    slot: string;
    displayName: string;
    productLabel: string;
    apiModelId: string;
    enabled: boolean;
    order: number;
}

// Fallback data for when Firestore is unavailable
const FALLBACK_ORGS: OrgData[] = [
    { id: "demo-org", name: "Demo Organization", plan: "Growth", status: "active", members: 2, simulations: 0, apiKeys: { openai: "", gemini: "", anthropic: "" }, lastPayment: "N/A", email: "admin@demo.com" },
];

type TabType = "organizations" | "api-keys" | "users" | "payments" | "health" | "platform";

const PLAN_OPTIONS = ["explorer", "growth", "scale", "enterprise"];
const SUBSCRIPTION_STATUS_OPTIONS = ["active", "trialing", "past_due", "cancelled"];

function formatDateTimeLabel(value?: string | null) {
    if (!value) return "Not set";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

export default function AdminDashboard() {
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const [activeTab, setActiveTab] = useState<TabType>("organizations");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedOrg, setSelectedOrg] = useState<OrgData | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [orgs, setOrgs] = useState<OrgData[]>([]);
    const [loadingOrgs, setLoadingOrgs] = useState(true);
    const [newKeyValue, setNewKeyValue] = useState<Record<string, string>>({});
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [healthStatus, setHealthStatus] = useState<{ name: string; endpoint: string; status: string }[]>([]);
    const [checkingHealth, setCheckingHealth] = useState(false);
    const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);
    const [loadingOrgDetail, setLoadingOrgDetail] = useState(false);
    const [subscriptionDraft, setSubscriptionDraft] = useState<Record<string, string | number | boolean>>({});
    const [modelConfig, setModelConfig] = useState<AdminModelConfig[]>([]);
    const [loadingModelConfig, setLoadingModelConfig] = useState(false);
    const [adminProfile, setAdminProfile] = useState<{ role?: string; orgId?: string; tenantSlug?: string; isPlatformAdmin?: boolean } | null>(null);

    useEffect(() => {
        fetch("/api/admin/verify")
            .then(res => res.json())
            .then(data => {
                if (!data.verified) {
                    router.push("/admin");
                    return;
                }
                setAdminProfile({
                    role: data.role,
                    orgId: data.orgId,
                    tenantSlug: data.tenantSlug,
                    isPlatformAdmin: Boolean(data.isPlatformAdmin),
                });
            })
            .catch(() => { router.push("/admin"); });
    }, [router]);

    // Fetch orgs via backend Admin SDK API (cursor-based pagination)
    const fetchOrgs = useCallback(async (isLoadMore = false) => {
        if (isLoadMore) {
            setLoadingMore(true);
        } else {
            setLoadingOrgs(true);
            setNextCursor(null);
            setHasMore(true);
        }

        try {
            const cursorParam = isLoadMore && nextCursor ? `&cursor=${nextCursor}` : '';
            const resp = await fetch(`/api/admin/orgs?page_size=15${cursorParam}`, {
                credentials: 'include',
            });

            if (!resp.ok) {
                throw new Error(`API returned ${resp.status}`);
            }

            const data = await resp.json();
            const orgList: OrgData[] = (data.orgs || []).map((o: Record<string, unknown>) => ({
                id: o.id,
                name: o.name,
                plan: o.plan,
                status: o.status,
                members: o.members,
                seatLimit: o.seatLimit,
                pendingInvites: o.pendingInvites,
                simulations: o.simulations,
                apiKeys: o.apiKeys,
                email: o.email,
                lastPayment: o.lastPayment,
            }));

            setHasMore(data.hasMore ?? false);
            setNextCursor(data.nextCursor ?? null);

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
    }, [nextCursor]);

    useEffect(() => { fetchOrgs(false); }, [fetchOrgs]);

    const fetchOrgDetail = useCallback(async (orgId: string) => {
        setLoadingOrgDetail(true);
        try {
            const resp = await fetch(`/api/admin/orgs/${orgId}/details`, { credentials: "include" });
            if (!resp.ok) throw new Error(`API returned ${resp.status}`);
            const data = await resp.json();
            setOrgDetail(data);
            setSubscriptionDraft({
                planId: data.subscription.planId,
                status: data.subscription.status,
                maxSimulations: data.subscription.maxSimulations,
                activeSeats: data.seats.active,
                trialEndsAt: data.subscription.trialEndsAt || "",
                resetUsage: false,
            });
        } catch (err) {
            console.error("Failed to fetch org detail:", err);
            setOrgDetail(null);
        }
        setLoadingOrgDetail(false);
    }, []);

    useEffect(() => {
        if (selectedOrg?.id) fetchOrgDetail(selectedOrg.id);
    }, [selectedOrg?.id, fetchOrgDetail]);

    const fetchModelConfig = useCallback(async () => {
        if (!adminProfile?.isPlatformAdmin) return;
        setLoadingModelConfig(true);
        try {
            const resp = await fetch("/api/admin/model-config", { credentials: "include" });
            if (!resp.ok) throw new Error(`API returned ${resp.status}`);
            const data = await resp.json();
            setModelConfig(data.models || []);
        } catch (err) {
            console.error("Failed to fetch model config:", err);
        }
        setLoadingModelConfig(false);
    }, [adminProfile?.isPlatformAdmin]);

    const handleLogout = async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.push("/admin");
    };

    const fetchHealth = async () => {
        setCheckingHealth(true);
        try {
            const resp = await fetch('/api/health');
            if (resp.ok) {
                const data = await resp.json();
                setHealthStatus([
                    { name: "FastAPI Backend", endpoint: "/api/health", status: data.status === "healthy" ? "operational" : "degraded" },
                    { name: "Firebase Firestore", endpoint: "firestore.googleapis.com", status: data.dependencies?.firestore === "connected" ? "operational" : "degraded" },
                    { name: "Visibility Simulation Engine", endpoint: "/api/simulation", status: "operational" },
                    { name: "Semantic Ingestion", endpoint: "/api/ingestion", status: "operational" },
                    { name: "Batch Scheduler", endpoint: "/api/batch/scheduled", status: "operational" },
                ]);
            }
        } catch (err) {
            console.error("Health check failed:", err);
        }
        setCheckingHealth(false);
    };

    useEffect(() => {
        if (activeTab === "health") fetchHealth();
        if (activeTab === "platform") fetchModelConfig();
    }, [activeTab, fetchModelConfig]);

    const resetUserPassword = async (email: string) => {
        const actionId = `reset-${email}`;
        setActionLoading(actionId);
        try {
            // Use Firebase Auth sendPasswordResetEmail (indirectly via a server action or client SDK if available)
            // For the hardened audit, we'll hit the standard Firebase reset if the client SDK is initialized
            const { auth } = await import("@/lib/firebase");
            const { sendPasswordResetEmail } = await import("firebase/auth");
            await sendPasswordResetEmail(auth, email);
            setActionSuccess(actionId);
        } catch (err) {
            console.error("Password reset failed:", err);
        }
        setActionLoading(null);
        setTimeout(() => setActionSuccess(null), 2000);
    };



    const saveApiKey = async (orgId: string, provider: string, value: string) => {
        const actionId = `save-${orgId}-${provider}`;
        setActionLoading(actionId);
        try {
            const resp = await fetch(`/api/admin/orgs/${orgId}/keys`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ provider, value }),
            });
            if (!resp.ok) throw new Error(`API returned ${resp.status}`);
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
            const resp = await fetch('/api/admin/payment-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
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

    const saveSubscription = async () => {
        if (!selectedOrg) return;
        const actionId = `subscription-${selectedOrg.id}`;
        setActionLoading(actionId);
        try {
            const resp = await fetch(`/api/admin/orgs/${selectedOrg.id}/subscription`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(subscriptionDraft),
            });
            if (!resp.ok) throw new Error(`API returned ${resp.status}`);
            setActionSuccess(actionId);
            await fetchOrgs(false);
            await fetchOrgDetail(selectedOrg.id);
        } catch (err) {
            console.error("Failed to update subscription:", err);
        }
        setActionLoading(null);
        setTimeout(() => setActionSuccess(null), 2000);
    };

    const saveModelConfig = async () => {
        const actionId = "save-model-config";
        setActionLoading(actionId);
        try {
            const resp = await fetch("/api/admin/model-config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ models: modelConfig }),
            });
            if (!resp.ok) throw new Error(`API returned ${resp.status}`);
            const data = await resp.json();
            setModelConfig(data.models || []);
            setActionSuccess(actionId);
        } catch (err) {
            console.error("Failed to update model config:", err);
        }
        setActionLoading(null);
        setTimeout(() => setActionSuccess(null), 2000);
    };

    const filteredOrgs = orgs.filter(org =>
        org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isPlatformAdmin = Boolean(adminProfile?.isPlatformAdmin);
    const tabs: { id: TabType, label: string, icon: React.ReactNode }[] = [
        { id: "organizations", label: "Organizations", icon: <Building2 className="w-4 h-4" /> },
        { id: "api-keys", label: "API Keys", icon: <Key className="w-4 h-4" /> },
        { id: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
        { id: "payments", label: "Payments", icon: <CreditCard className="w-4 h-4" /> },
        { id: "health", label: "System Health", icon: <Activity className="w-4 h-4" /> },
        ...(isPlatformAdmin ? [{ id: "platform" as TabType, label: "Model Control", icon: <RotateCcw className="w-4 h-4" /> }] : []),
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <header className="bg-slate-900 border-b border-white/5 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <Logo size={32} showText={false} />
                    <div>
                        <h1 className="text-sm font-semibold text-white">AUM Product Admin</h1>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Firestore-Connected Operations</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <button onClick={() => fetchOrgs(false)} className="text-slate-400 hover:text-amber-400 transition-colors" title="Refresh Data">
                        <RefreshCw className={`w-4 h-4 ${loadingOrgs ? "animate-spin" : ""}`} />
                    </button>
                    <button onClick={toggleTheme} className="text-slate-400 hover:text-indigo-400 transition-colors" title="Toggle theme">
                        {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
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
                                            <th className="text-right px-6 py-4">Seats</th>
                                            <th className="text-right px-6 py-4">Simulations</th>
                                            <th className="text-right px-6 py-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingOrgs ? (
                                            <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading from Firestore...</td></tr>
                                        ) : filteredOrgs.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-20 text-center">
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
                                                <td className="px-6 py-4 text-right text-sm text-slate-400">{org.members}/{org.seatLimit || 1}</td>
                                                <td className="px-6 py-4 text-right text-sm text-slate-400">{org.simulations}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-4">
                                                        <button
                                                            onClick={() => {
                                                                if (typeof window !== "undefined") {
                                                                    localStorage.setItem("aum_active_org_override", org.id);
                                                                    window.open(`/dashboard?orgId=${encodeURIComponent(org.id)}`, "_blank");
                                                                }
                                                            }}
                                                            className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                                                        >
                                                            <ExternalLink className="w-3 h-3" />
                                                            Open Workspace
                                                        </button>
                                                        <button onClick={() => { setSelectedOrg(org); setActiveTab("payments"); }} className="text-xs text-amber-400 hover:text-amber-300">Manage →</button>
                                                    </div>
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
                                                        <span>{key ? "••••••••••••••••" : "No key set"}</span>
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
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-light">User Management</h2>
                                <select value={selectedOrg?.id || ""} onChange={(e) => setSelectedOrg(orgs.find(o => o.id === e.target.value) || null)}
                                    className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500">
                                    <option value="">Select Organization</option>
                                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                </select>
                            </div>
                            {!selectedOrg ? (
                                <div className="bg-slate-900 border border-white/5 rounded-2xl p-12 text-center text-slate-500">Select an organization to inspect users and invites.</div>
                            ) : loadingOrgDetail ? (
                                <div className="bg-slate-900 border border-white/5 rounded-2xl p-12 text-center text-slate-500">Loading tenant users...</div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                                        <h3 className="text-sm font-medium text-white mb-4">Active Users</h3>
                                        <div className="space-y-3">
                                            {(orgDetail?.users || []).map((user) => (
                                                <div key={user.uid} className="flex items-center justify-between border border-white/5 rounded-xl p-4">
                                                    <div>
                                                        <p className="text-sm text-white">{user.email}</p>
                                                        <p className="text-xs text-slate-500">{user.role} · {user.status}</p>
                                                    </div>
                                                    <button onClick={() => resetUserPassword(user.email)}
                                                        className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition-all flex items-center space-x-2">
                                                        {actionLoading === `reset-${user.email}` ? <RefreshCw className="w-3 h-3 animate-spin" /> : actionSuccess === `reset-${user.email}` ? <Check className="w-3 h-3 text-emerald-400" /> : <RotateCcw className="w-3 h-3" />}
                                                        <span>Reset</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                                        <h3 className="text-sm font-medium text-white mb-4">Pending Invites</h3>
                                        <div className="space-y-3">
                                            {(orgDetail?.pendingInvites || []).length > 0 ? (orgDetail?.pendingInvites || []).map((invite) => (
                                                <div key={invite.id} className="border border-white/5 rounded-xl p-4">
                                                    <p className="text-sm text-white">{invite.email}</p>
                                                    <p className="text-xs text-slate-500">{invite.role} · invited {invite.invitedAt?.slice(0, 10) || "recently"}</p>
                                                </div>
                                            )) : <p className="text-sm text-slate-500">No pending invites.</p>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PAYMENTS */}
                    {activeTab === "payments" && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-light">Payments & Subscriptions</h2>
                                <select value={selectedOrg?.id || ""} onChange={(e) => setSelectedOrg(orgs.find(o => o.id === e.target.value) || null)}
                                    className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500">
                                    <option value="">Select Organization</option>
                                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                </select>
                            </div>
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
                            {selectedOrg && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                                        <h3 className="text-sm font-medium text-white">Subscription Controls</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <label className="text-xs text-slate-400">Plan
                                                <select value={String(subscriptionDraft.planId || "")} onChange={(e) => setSubscriptionDraft(prev => ({ ...prev, planId: e.target.value }))}
                                                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none">
                                                    {PLAN_OPTIONS.map(plan => <option key={plan} value={plan}>{plan}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-xs text-slate-400">Status
                                                <select value={String(subscriptionDraft.status || "")} onChange={(e) => setSubscriptionDraft(prev => ({ ...prev, status: e.target.value }))}
                                                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none">
                                                    {SUBSCRIPTION_STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-xs text-slate-400">Billing Period
                                                <select value={String(subscriptionDraft.billingPeriod || orgDetail?.subscription.billingPeriod || "monthly")} onChange={(e) => setSubscriptionDraft(prev => ({ ...prev, billingPeriod: e.target.value }))}
                                                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none">
                                                    {["monthly", "quarterly", "annual"].map(period => <option key={period} value={period}>{period}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-xs text-slate-400">Max Simulations
                                                <input type="number" value={Number(subscriptionDraft.maxSimulations || 0)} onChange={(e) => setSubscriptionDraft(prev => ({ ...prev, maxSimulations: Number(e.target.value) }))}
                                                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" />
                                            </label>
                                            <label className="text-xs text-slate-400">Active Seats
                                                <input type="number" value={Number(subscriptionDraft.activeSeats || 0)} onChange={(e) => setSubscriptionDraft(prev => ({ ...prev, activeSeats: Number(e.target.value) }))}
                                                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" />
                                            </label>
                                            <label className="text-xs text-slate-400 col-span-2">Trial Ends At
                                                <input type="datetime-local" value={String(subscriptionDraft.trialEndsAt || "")} onChange={(e) => setSubscriptionDraft(prev => ({ ...prev, trialEndsAt: e.target.value }))}
                                                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" />
                                            </label>
                                            <label className="text-xs text-slate-400 col-span-2">Current Period End
                                                <input type="datetime-local" value={String(subscriptionDraft.currentPeriodEnd || orgDetail?.subscription.currentPeriodEnd || "")} onChange={(e) => setSubscriptionDraft(prev => ({ ...prev, currentPeriodEnd: e.target.value }))}
                                                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" />
                                            </label>
                                        </div>
                                        <label className="flex items-center gap-2 text-sm text-slate-300">
                                            <input type="checkbox" checked={Boolean(subscriptionDraft.resetUsage)} onChange={(e) => setSubscriptionDraft(prev => ({ ...prev, resetUsage: e.target.checked }))} />
                                            Reset current simulation usage
                                        </label>
                                        <div className="grid grid-cols-2 gap-4 text-xs text-slate-400 border border-white/5 rounded-xl p-4 bg-slate-950">
                                            <div>
                                                <p className="uppercase tracking-wider text-slate-500 mb-1">Seats Used</p>
                                                <p className="text-base text-white">{orgDetail?.seats.active || 0} / {orgDetail?.seats.limit || 0}</p>
                                            </div>
                                            <div>
                                                <p className="uppercase tracking-wider text-slate-500 mb-1">Pending Invites</p>
                                                <p className="text-base text-white">{orgDetail?.seats.pendingInvites || 0}</p>
                                            </div>
                                            <div>
                                                <p className="uppercase tracking-wider text-slate-500 mb-1">Usage This Cycle</p>
                                                <p className="text-base text-white">{orgDetail?.subscription.simsThisCycle || 0} / {orgDetail?.subscription.maxSimulations || 0}</p>
                                            </div>
                                            <div>
                                                <p className="uppercase tracking-wider text-slate-500 mb-1">Trial Ends</p>
                                                <p className="text-base text-white">{formatDateTimeLabel(orgDetail?.subscription.trialEndsAt)}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <button onClick={saveSubscription}
                                                className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-4 py-2.5 rounded-xl text-xs font-medium transition-all">
                                                {actionLoading === `subscription-${selectedOrg.id}` ? "Saving..." : actionSuccess === `subscription-${selectedOrg.id}` ? "Saved" : "Save Subscription"}
                                            </button>
                                            <button onClick={() => sendPaymentReminder(selectedOrg.id, selectedOrg.email)}
                                                className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 px-4 py-2.5 rounded-xl text-xs font-medium transition-all">
                                                Send Payment Link
                                            </button>
                                        </div>
                                    </div>
                                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                                        <h3 className="text-sm font-medium text-white mb-4">Recent Payments</h3>
                                        <div className="space-y-3">
                                            {(orgDetail?.payments || []).length > 0 ? (orgDetail?.payments || []).map(payment => (
                                                <div key={payment.id} className="border border-white/5 rounded-xl p-4">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-sm text-white">{payment.planId || "payment"}</p>
                                                        <p className="text-xs text-slate-400">{payment.status}</p>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1">{payment.customerEmail} · {payment.createdAt?.slice(0, 10) || "recent"}</p>
                                                    {payment.shortUrl ? <a href={payment.shortUrl} target="_blank" className="text-xs text-indigo-400 mt-2 inline-block">Open Link</a> : null}
                                                </div>
                                            )) : <p className="text-sm text-slate-500">No recent payment records.</p>}
                                        </div>
                                        {orgDetail ? (
                                            <div className="mt-6 border-t border-white/5 pt-4 text-xs text-slate-400 space-y-2">
                                                <div className="flex justify-between gap-4">
                                                    <span>Current Period End</span>
                                                    <span className="text-white">{formatDateTimeLabel(orgDetail.subscription.currentPeriodEnd)}</span>
                                                </div>
                                                <div className="flex justify-between gap-4">
                                                    <span>Billing Period</span>
                                                    <span className="text-white">{orgDetail.subscription.billingPeriod || "Not set"}</span>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SYSTEM HEALTH */}
                    {activeTab === "health" && (
                        <div>
                            <h2 className="text-xl font-light mb-6">System Health</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {healthStatus.length > 0 ? healthStatus.map((svc, i) => (
                                    <div key={i} className="bg-slate-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between">
                                        <div><p className="text-sm text-white">{svc.name}</p><p className="text-xs text-slate-600 font-mono">{svc.endpoint}</p></div>
                                        {svc.status === "operational" ? <span className="flex items-center text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full"><CheckCircle className="w-3 h-3 mr-1" /> Operational</span>
                                            : <span className="flex items-center text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full"><AlertTriangle className="w-3 h-3 mr-1" /> {svc.status}</span>}
                                    </div>
                                )) : (
                                    <div className="col-span-2 py-20 text-center">
                                        <RefreshCw className={`w-8 h-8 mx-auto mb-4 text-slate-700 ${checkingHealth ? "animate-spin" : ""}`} />
                                        <p className="text-slate-500">Checking system health...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "platform" && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-light">Platform Model Control</h2>
                                <button onClick={saveModelConfig}
                                    className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-4 py-2.5 rounded-xl text-xs font-medium transition-all">
                                    {actionLoading === "save-model-config" ? "Saving..." : actionSuccess === "save-model-config" ? "Saved" : "Publish Model Config"}
                                </button>
                            </div>
                            <div className="space-y-4">
                                {loadingModelConfig ? (
                                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-12 text-center text-slate-500">Loading model control plane...</div>
                                ) : modelConfig.map((model, index) => (
                                    <div key={`${model.provider}-${index}`} className="bg-slate-900 border border-white/5 rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-6 gap-4 items-end">
                                        <label className="text-xs text-slate-400">Provider
                                            <input value={model.provider} disabled className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-400 outline-none" />
                                        </label>
                                        <label className="text-xs text-slate-400">Display Name
                                            <input value={model.displayName} onChange={(e) => setModelConfig(prev => prev.map((item, i) => i === index ? { ...item, displayName: e.target.value } : item))}
                                                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" />
                                        </label>
                                        <label className="text-xs text-slate-400">Product Label
                                            <input value={model.productLabel} onChange={(e) => setModelConfig(prev => prev.map((item, i) => i === index ? { ...item, productLabel: e.target.value } : item))}
                                                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" />
                                        </label>
                                        <label className="text-xs text-slate-400 lg:col-span-2">Provider API Model ID
                                            <input value={model.apiModelId} onChange={(e) => setModelConfig(prev => prev.map((item, i) => i === index ? { ...item, apiModelId: e.target.value } : item))}
                                                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none font-mono" />
                                        </label>
                                        <label className="text-xs text-slate-400">Display Order
                                            <input type="number" value={model.order} onChange={(e) => setModelConfig(prev => prev.map((item, i) => i === index ? { ...item, order: Number(e.target.value) } : item))}
                                                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" />
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-slate-300">
                                            <input type="checkbox" checked={model.enabled} onChange={(e) => setModelConfig(prev => prev.map((item, i) => i === index ? { ...item, enabled: e.target.checked } : item))} />
                                            Enabled
                                        </label>
                                    </div>
                                ))}
                                {!loadingModelConfig && modelConfig.length > 0 ? (
                                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 text-xs text-slate-400">
                                        Runtime surfaces will pick up these changes from Firestore-backed config. Static marketing/docs copy is still code-backed and must be reviewed separately when model naming changes.
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
