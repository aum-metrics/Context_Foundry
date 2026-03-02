"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "./OrganizationContext";
import { auth } from "@/lib/firebase";
import { Shield, Globe, CheckCircle, AlertTriangle, RefreshCw, Settings2 } from "lucide-react";

interface SSOStatus {
    enabled: boolean;
    provider?: string;
    provider_name?: string;
}

const SSO_PROVIDERS = [
    { id: "okta", name: "Okta", icon: "🔐" },
    { id: "azure_ad", name: "Azure Active Directory", icon: "☁️" },
    { id: "google", name: "Google Workspace", icon: "🌐" },
];

export default function SSOSettings() {
    const { organization, orgUser, loadingOrg } = useOrganization();
    const [ssoStatus, setSsoStatus] = useState<SSOStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [configuring, setConfiguring] = useState(false);
    const [showConfigForm, setShowConfigForm] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState("");
    const [formData, setFormData] = useState({
        domain: "",
        client_id: "",
        client_secret: "",
        tenant_id: "",
    });
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Fetch SSO status on mount
    useEffect(() => {
        if (!organization?.id || loadingOrg) return;

        const fetchStatus = async () => {
            setLoading(true);
            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) return;

                const resp = await fetch(`/api/sso/status/${organization.id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (resp.ok) {
                    const data = await resp.json();
                    setSsoStatus(data);
                }
            } catch (err) {
                console.error("SSO status fetch failed:", err);
            }
            setLoading(false);
        };

        fetchStatus();
    }, [organization?.id, loadingOrg]);

    const handleConfigure = async () => {
        if (!organization?.id || !selectedProvider) return;
        setConfiguring(true);
        setMessage(null);

        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("Not authenticated");

            const resp = await fetch("/api/sso/configure", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    organization_id: organization.id,
                    provider: selectedProvider,
                    domain: formData.domain || undefined,
                    client_id: formData.client_id || undefined,
                    client_secret: formData.client_secret || undefined,
                    tenant_id: formData.tenant_id || undefined,
                    is_active: true,
                }),
            });

            if (resp.ok) {
                const data = await resp.json();
                setMessage({ type: "success", text: data.message || "SSO configured successfully" });
                setSsoStatus({ enabled: true, provider: selectedProvider, provider_name: SSO_PROVIDERS.find(p => p.id === selectedProvider)?.name });
                setShowConfigForm(false);
            } else {
                const err = await resp.json();
                setMessage({ type: "error", text: err.detail || "Configuration failed" });
            }
        } catch (err) {
            setMessage({ type: "error", text: "Failed to configure SSO" });
        }
        setConfiguring(false);
    };

    if (loadingOrg || !organization) return null;

    // Only admins can configure SSO
    if (orgUser?.role !== "admin") {
        return (
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <Shield className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-lg font-semibold text-white">Enterprise SSO</h3>
                </div>
                <p className="text-slate-400 text-sm">Only organization admins can configure SSO.</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/5 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-lg font-semibold text-white">Enterprise SSO</h3>
                </div>
                {ssoStatus?.enabled && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Active
                    </span>
                )}
            </div>

            {/* Status or Loading */}
            {loading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Checking SSO status...
                </div>
            ) : ssoStatus?.enabled ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-emerald-400" />
                        <div>
                            <p className="text-white font-medium">
                                {ssoStatus.provider_name || ssoStatus.provider} SSO is active
                            </p>
                            <p className="text-slate-400 text-sm mt-1">
                                Team members can sign in with their corporate identity provider.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowConfigForm(!showConfigForm)}
                        className="mt-3 text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5"
                    >
                        <Settings2 className="w-3.5 h-3.5" />
                        Reconfigure
                    </button>
                </div>
            ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <div>
                            <p className="text-white font-medium">SSO not configured</p>
                            <p className="text-slate-400 text-sm mt-1">
                                Enable enterprise SSO for your team with Okta, Azure AD, or Google Workspace.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowConfigForm(true)}
                        className="mt-3 text-sm bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        Configure SSO
                    </button>
                </div>
            )}

            {/* Message */}
            {message && (
                <div className={`text-sm p-3 rounded-lg ${message.type === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                    {message.text}
                </div>
            )}

            {/* Configuration Form */}
            {showConfigForm && (
                <div className="border border-white/10 rounded-xl p-5 space-y-4 bg-slate-900/50">
                    <h4 className="text-white font-medium">SSO Provider Configuration</h4>

                    {/* Provider Selection */}
                    <div className="grid grid-cols-3 gap-3">
                        {SSO_PROVIDERS.map(provider => (
                            <button
                                key={provider.id}
                                onClick={() => setSelectedProvider(provider.id)}
                                className={`p-3 rounded-lg border text-sm text-left transition-colors ${selectedProvider === provider.id
                                        ? "border-indigo-500 bg-indigo-500/10 text-white"
                                        : "border-white/10 text-slate-400 hover:border-white/20"
                                    }`}
                            >
                                <span className="text-lg">{provider.icon}</span>
                                <p className="mt-1 font-medium">{provider.name}</p>
                            </button>
                        ))}
                    </div>

                    {selectedProvider && (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-400 uppercase tracking-wider">Domain</label>
                                <input
                                    type="text"
                                    placeholder="your-company.okta.com"
                                    value={formData.domain}
                                    onChange={e => setFormData(f => ({ ...f, domain: e.target.value }))}
                                    className="w-full mt-1 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 uppercase tracking-wider">Client ID</label>
                                <input
                                    type="text"
                                    placeholder="OAuth2 Client ID"
                                    value={formData.client_id}
                                    onChange={e => setFormData(f => ({ ...f, client_id: e.target.value }))}
                                    className="w-full mt-1 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 uppercase tracking-wider">Client Secret</label>
                                <input
                                    type="password"
                                    placeholder="OAuth2 Client Secret"
                                    value={formData.client_secret}
                                    onChange={e => setFormData(f => ({ ...f, client_secret: e.target.value }))}
                                    className="w-full mt-1 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                                />
                            </div>
                            {selectedProvider === "azure_ad" && (
                                <div>
                                    <label className="text-xs text-slate-400 uppercase tracking-wider">Tenant ID</label>
                                    <input
                                        type="text"
                                        placeholder="Azure AD Tenant ID"
                                        value={formData.tenant_id}
                                        onChange={e => setFormData(f => ({ ...f, tenant_id: e.target.value }))}
                                        className="w-full mt-1 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleConfigure}
                                    disabled={configuring || !formData.client_id}
                                    className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    {configuring && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    {configuring ? "Configuring..." : "Save Configuration"}
                                </button>
                                <button
                                    onClick={() => { setShowConfigForm(false); setSelectedProvider(""); }}
                                    className="text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
