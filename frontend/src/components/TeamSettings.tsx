"use client";

import { useState, useEffect } from "react";
import { useOrganization, OrgUser } from "./OrganizationContext";
import { Users, UserPlus, Shield, ShieldAlert, Check } from "lucide-react";
import { auth } from "@/lib/firebase";

export default function TeamSettings() {
    const { organization, orgUser, loadingOrg } = useOrganization();
    const [members, setMembers] = useState<OrgUser[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviting, setInviting] = useState(false);
    const [inviteSuccess, setInviteSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);



    useEffect(() => {
        const fetchMembers = async () => {
            if (!organization || !orgUser) return;

            if (process.env.NODE_ENV === "development" && (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash")) {
                setMembers([
                    orgUser,
                    { uid: "mock_user_2", email: `colleague@${organization.name.toLowerCase().replace(/\s+/g, '')}.com`, role: "member", orgId: organization.id }
                ]);
                setLoadingMembers(false);
                return;
            }

            try {
                // Fetch Org Members via backend (Admin SDK bypasses Firestore client rules)
                const token = await auth.currentUser?.getIdToken();
                if (!token) throw new Error("No auth session");
                const res = await fetch(`/api/workspaces/${organization.id}/members`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setMembers(data.members || []);
                } else {
                    console.warn("Member listing failed:", res.status);
                }
            } catch (err) {
                console.error("Failed to fetch initial team data", err);
            }
            setLoadingMembers(false);
        };
        fetchMembers();
    }, [organization, orgUser]);

    if (loadingOrg || loadingMembers) {
        return <div className="p-8 animate-pulse text-slate-500">Loading Team Directory...</div>;
    }

    if (!organization || !orgUser) return null;

    if (orgUser.role !== "admin") {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
                <ShieldAlert className="w-12 h-12 mb-4 text-slate-300 dark:text-slate-600" />
                <h2 className="text-xl font-light text-slate-900 dark:text-white mb-2">Insufficient Privileges</h2>
                <p className="text-sm">You must be an Organization Admin to manage enterprise seats.</p>
            </div>
        );
    }

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (organization.activeSeats >= 25) {
            setError("You have reached the maximum cap of 25 enterprise seats.");
            return;
        }

        setInviting(true);
        try {
            if (process.env.NODE_ENV === "development" && (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash")) {
                await new Promise(r => setTimeout(r, 1000));
                setMembers([...members, { uid: `mock_${String(new Date().getTime())}`, email: inviteEmail, role: "member", orgId: organization.id }]);
            } else {
                if (!auth.currentUser) throw new Error("No active session");

                const token = await auth.currentUser.getIdToken();
                const response = await fetch(`/api/workspaces/${organization.id}/members`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ email: inviteEmail, role: "member" })
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.detail || "Failed to provision access");
                }

                const data = await response.json();

                // Add to local state using the newly provisioned backend placeholder
                if (data.member) {
                    setMembers([...members, data.member]);
                } else {
                    const newUserId = `invited_${String(new Date().getTime())}`;
                    setMembers([...members, { uid: newUserId, email: inviteEmail, role: "member", orgId: organization.id }]);
                }

                // Force a reload of the organization context if parent-level sync is needed
                // (Direct mutation removed per review findings)
            }

            setInviteSuccess(true);
            setInviteEmail("");
            setTimeout(() => setInviteSuccess(false), 3000);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to provision access.");
        }
        setInviting(false);
    };



    return (
        <div className="w-full h-full animate-fade-in font-sans">
            <header className="mb-10 pb-6 border-b border-slate-200 dark:border-white/5 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-light tracking-tight text-slate-900 dark:text-white flex items-center mb-1">
                        <Users className="w-8 h-8 mr-3 text-indigo-500" />
                        Team Settings
                    </h1>
                    <p className="text-sm text-slate-500 uppercase tracking-widest pl-11">{organization.name}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Active Seats</p>
                    <div className="flex items-baseline space-x-1">
                        <span className="text-3xl font-light text-indigo-500">{organization.activeSeats}</span>
                        <span className="text-slate-500 text-lg">/ {organization.subscriptionTier === 'scale' ? 25 : organization.subscriptionTier === 'growth' ? 5 : 1}</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-6 shadow-xl dark:shadow-none">
                        <h2 className="text-lg font-medium text-slate-900 dark:text-white mb-6">Directory</h2>
                        <div className="space-y-4">
                            {members.map(member => (
                                <div key={member.uid} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-white dark:bg-slate-950/50">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-medium">
                                            {member.email.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-900 dark:text-white">{member.email}</p>
                                            <p className="text-xs text-slate-500">{member.uid === orgUser.uid ? "You" : "Seat Active"}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 text-xs rounded-full uppercase tracking-wider ${member.role === 'admin' ? 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                        {member.role === 'admin' ? <Shield className="w-3 h-3 inline mr-1" /> : null}
                                        {member.role}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>


                </div>

                <div>
                    <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-6 shadow-xl dark:shadow-none sticky top-6">
                        <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center mb-6">
                            <UserPlus className="w-4 h-4 mr-2 text-indigo-500" />
                            Provision Access
                        </h2>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-sm text-rose-600 dark:text-rose-400">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleInvite}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Corporate Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700/50 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                                        placeholder="colleague@company.com"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={inviting || inviteSuccess || organization.activeSeats >= (organization.subscriptionTier === 'scale' ? 25 : organization.subscriptionTier === 'growth' ? 5 : 1)}
                                    className={`w-full py-3 rounded-lg text-sm font-medium transition-colors flex justify-center items-center ${inviteSuccess ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/50' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50'}`}
                                >
                                    {inviting ? "Provisioning..." : inviteSuccess ? <><Check className="w-4 h-4 mr-2" /> Invitation Sent</> : "Send Invite Link"}
                                </button>

                                <p className="text-center text-xs text-slate-500 px-2 leading-relaxed">
                                    Inviting a user will automatically grant them access to <b>{organization.name}</b>'s isolated datasets.<br />
                                    <span className="text-amber-500/80 italic mt-1 block">(Note: In demo mode, this provisions a simulated seat.)</span>
                                </p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
