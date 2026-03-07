"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "firebase/auth";
import { db } from "@/lib/firestorePaths";
import { doc, getDoc } from "firebase/firestore";

export interface Organization {
    id: string;
    name: string;
    activeSeats: number;
    subscriptionTier: string;
    apiKeys?: {
        openai?: string;
        gemini?: string;
        claude?: string;
    };
}

export interface AnalysisContext {
    id: string;
    version: string;
    name: string;
    sourceUrl?: string | null;
    createdAt?: string | null;
    isLatest?: boolean;
}

export interface OrgUser {
    uid: string;
    email: string;
    orgId: string;
    role: "admin" | "member";
    status?: string;
}

export interface OrganizationContextType {
    organization: Organization | null;
    orgUser: OrgUser | null;
    loadingOrg: boolean;
    error: string | null;
    activeOrgId: string | null;
    baseOrgId: string | null;
    isPlatformAdmin: boolean;
    refreshKey: number;
    analysisContexts: AnalysisContext[];
    activeManifestVersion: string;
    activeContextName: string | null;
    setActiveOrgId: (orgId: string | null) => void;
    setActiveManifestVersion: (version: string) => void;
}

const ACTIVE_ORG_OVERRIDE_KEY = "aum_active_org_override";
const ACTIVE_MANIFEST_VERSION_KEY = "aum_active_manifest_version";

const OrganizationContext = createContext<OrganizationContextType>({
    organization: null,
    orgUser: null,
    loadingOrg: true,
    error: null
    ,
    activeOrgId: null,
    baseOrgId: null,
    isPlatformAdmin: false,
    refreshKey: 0,
    analysisContexts: [],
    activeManifestVersion: "latest",
    activeContextName: null,
    setActiveOrgId: () => undefined,
    setActiveManifestVersion: () => undefined,
});

export function OrganizationProvider({ children, user }: { children: React.ReactNode, user: User | null }) {
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [orgUser, setOrgUser] = useState<OrgUser | null>(null);
    const [loadingOrg, setLoadingOrg] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [analysisContexts, setAnalysisContexts] = useState<AnalysisContext[]>([]);
    const [activeManifestVersion, setActiveManifestVersionState] = useState<string>("latest");

    const setActiveOrgId = (orgId: string | null) => {
        if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            if (orgId) {
                localStorage.setItem(ACTIVE_ORG_OVERRIDE_KEY, orgId);
                url.searchParams.set("orgId", orgId);
            } else {
                localStorage.removeItem(ACTIVE_ORG_OVERRIDE_KEY);
                url.searchParams.delete("orgId");
            }
            window.history.replaceState({}, "", url.toString());
        }
        setActiveOrgIdState(orgId);
    };

    const setActiveManifestVersion = (version: string) => {
        if (typeof window !== "undefined") {
            const storageKey = `${ACTIVE_MANIFEST_VERSION_KEY}:${activeOrgId || orgUser?.orgId || "default"}`;
            localStorage.setItem(storageKey, version);
        }
        setActiveManifestVersionState(version);
    };

    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleManifestUpdated = (event: Event) => {
            const customEvent = event as CustomEvent<{ orgId?: string }>;
            const updatedOrgId = customEvent.detail?.orgId;
            if (!updatedOrgId) return;
            if (updatedOrgId === activeOrgId || updatedOrgId === orgUser?.orgId) {
                setRefreshKey((prev) => prev + 1);
            }
        };

        window.addEventListener("aum_manifest_updated", handleManifestUpdated);
        return () => window.removeEventListener("aum_manifest_updated", handleManifestUpdated);
    }, [activeOrgId, orgUser?.orgId]);

    useEffect(() => {
        const fetchOrProvisionOrg = async () => {
            if (!user) {
                setOrganization(null);
                setOrgUser(null);
                setLoadingOrg(false);
                return;
            }

            try {
                // Fetch the user's document
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                let currentOrgUser: OrgUser;

                if (userDocSnap.exists()) {
                    currentOrgUser = userDocSnap.data() as OrgUser;
                } else {
                    // Auto-provision via backend
                    if (user && typeof window !== 'undefined') {
                        const token = await user.getIdToken();
                        const response = await fetch("/api/workspaces/provision", {
                            method: "POST",
                            headers: {
                                "Authorization": `Bearer ${token}`
                            }
                        });

                        if (!response.ok) {
                            throw new Error("Failed to provision organization");
                        }
                        const provisionData = await response.json();

                        if (provisionData.apiKey && typeof window !== 'undefined') {
                            localStorage.setItem('aum_b2b_api_key', provisionData.apiKey);
                        }

                        currentOrgUser = {
                            uid: user.uid,
                            email: user.email || "",
                            orgId: provisionData.orgId,
                            role: "admin",
                        };
                    } else {
                        throw new Error("Cannot provision without user session");
                    }
                }

                setOrgUser(currentOrgUser);
                const isPlatformAdmin = currentOrgUser.role === "admin" && currentOrgUser.orgId === "system_admin_org";
                let targetOrgId = currentOrgUser.orgId;

                if (isPlatformAdmin && typeof window !== "undefined") {
                    const params = new URLSearchParams(window.location.search);
                    const queryOrgId = params.get("orgId");
                    const storedOverride = localStorage.getItem(ACTIVE_ORG_OVERRIDE_KEY);
                    const requestedOrgId = queryOrgId || activeOrgId || storedOverride;

                    if (requestedOrgId && requestedOrgId !== currentOrgUser.orgId) {
                        targetOrgId = requestedOrgId;
                        if (storedOverride !== requestedOrgId) {
                            localStorage.setItem(ACTIVE_ORG_OVERRIDE_KEY, requestedOrgId);
                        }
                        if (queryOrgId !== requestedOrgId) {
                            params.set("orgId", requestedOrgId);
                            const nextUrl = `${window.location.pathname}?${params.toString()}`;
                            window.history.replaceState({}, "", nextUrl);
                        }
                    } else {
                        localStorage.removeItem(ACTIVE_ORG_OVERRIDE_KEY);
                        params.delete("orgId");
                        const nextUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
                        window.history.replaceState({}, "", nextUrl);
                    }
                }

                setActiveOrgIdState(targetOrgId);

                // Fetch the Organization details via safe backend endpoint (P0 Hardening)
                if (targetOrgId) {
                    const token = await user.getIdToken();
                    const orgResponse = await fetch(`/api/workspaces/${targetOrgId}/profile?version=${encodeURIComponent(activeManifestVersion)}`, {
                        headers: {
                            "Authorization": `Bearer ${token}`
                        }
                    });

                    if (orgResponse.ok) {
                        const orgData = await orgResponse.json();
                        setOrganization(orgData);
                    } else {
                        console.error("Safe org fetch failed:", orgResponse.status);
                        if (targetOrgId !== currentOrgUser.orgId) {
                            const fallbackResponse = await fetch(`/api/workspaces/${currentOrgUser.orgId}/profile`, {
                                headers: {
                                    "Authorization": `Bearer ${token}`
                                }
                            });
                            if (fallbackResponse.ok) {
                                localStorage.removeItem(ACTIVE_ORG_OVERRIDE_KEY);
                                setActiveOrgIdState(currentOrgUser.orgId);
                                const fallbackOrgData = await fallbackResponse.json();
                                setOrganization(fallbackOrgData);
                                return;
                            }
                        }
                        throw new Error("Failed to load organization profile safely.");
                    }

                    const contextsResponse = await fetch(`/api/workspaces/${targetOrgId}/contexts`, {
                        headers: {
                            "Authorization": `Bearer ${token}`
                        }
                    });
                    if (contextsResponse.ok) {
                        const contextsData = await contextsResponse.json();
                        const contexts: AnalysisContext[] = contextsData.contexts || [];
                        setAnalysisContexts(contexts);
                    } else {
                        setAnalysisContexts([]);
                    }
                }
            } catch (error) {
                console.error("Error fetching/provisioning org:", error);
                setError("Failed to initialize workspace. Please contact support.");
            }

            setLoadingOrg(false);
        };

        fetchOrProvisionOrg();
    }, [user, activeOrgId, refreshKey, activeManifestVersion]);

    // Reconcile version separately to break the dependency loop
    useEffect(() => {
        if (!activeOrgId || typeof window === "undefined") return;

        const manifestStorageKey = `${ACTIVE_MANIFEST_VERSION_KEY}:${activeOrgId}`;
        const persistedVersion = localStorage.getItem(manifestStorageKey);
        const knownVersions = new Set(["latest", ...analysisContexts.map((ctx) => ctx.version)]);

        // Find the best version to activate
        const nextVersion = persistedVersion && knownVersions.has(persistedVersion)
            ? persistedVersion
            : (analysisContexts.find(ctx => ctx.isLatest)?.version || analysisContexts[0]?.version || "latest");

        if (nextVersion !== activeManifestVersion) {
            setActiveManifestVersionState(nextVersion);
            localStorage.setItem(manifestStorageKey, nextVersion);
        }
    }, [analysisContexts, activeOrgId, activeManifestVersion]);

    const isPlatformAdmin = orgUser?.role === "admin" && orgUser?.orgId === "system_admin_org";
    const activeContextName = analysisContexts.find((ctx) => ctx.version === activeManifestVersion)?.name
        || (activeManifestVersion === "latest" ? organization?.name || null : null);

    return (
        <OrganizationContext.Provider
            value={{
                organization,
                orgUser,
                loadingOrg,
                error,
                activeOrgId,
                baseOrgId: orgUser?.orgId || null,
                isPlatformAdmin,
                refreshKey,
                analysisContexts,
                activeManifestVersion,
                activeContextName,
                setActiveOrgId,
                setActiveManifestVersion,
            }}
        >
            {children}
        </OrganizationContext.Provider>
    );
}

export const useOrganization = () => useContext(OrganizationContext);
