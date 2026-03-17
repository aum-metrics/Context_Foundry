"use client";

import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { User } from "firebase/auth";
import { db } from "@/lib/firestorePaths";
import { doc, getDoc } from "firebase/firestore";
import { getLocalMockSession, isLocalMockMode } from "@/lib/localMockMode";

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
    renameOrganization: (newName: string) => Promise<boolean>;
}

const ACTIVE_ORG_OVERRIDE_KEY = "aum_active_org_override";
const ACTIVE_MANIFEST_VERSION_KEY = "aum_active_manifest_version";

const OrganizationContext = createContext<OrganizationContextType>({
    organization: null,
    orgUser: null,
    loadingOrg: true,
    error: null,
    activeOrgId: null,
    baseOrgId: null,
    isPlatformAdmin: false,
    refreshKey: 0,
    analysisContexts: [],
    activeManifestVersion: "latest",
    activeContextName: null,
    setActiveOrgId: () => undefined,
    setActiveManifestVersion: () => undefined,
    renameOrganization: async () => false,
});

export function OrganizationProvider({ children, user }: { children: React.ReactNode, user: User | null }) {
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [orgUser, setOrgUser] = useState<OrgUser | null>(null);
    const [loadingOrg, setLoadingOrg] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [analysisContexts, setAnalysisContexts] = useState<AnalysisContext[]>([]);
    // FIX 1: Keep manifest version in a ref to avoid triggering the fetch loop.
    // The state version is the source of truth for rendering; the ref is used
    // inside the fetch effect without it becoming a dependency.
    const [activeManifestVersion, setActiveManifestVersionState] = useState<string>("latest");
    const activeManifestVersionRef = useRef<string>("latest");
    const lastFetchKeyRef = useRef<string>("");

    const setActiveManifestVersion = useCallback((version: string) => {
        activeManifestVersionRef.current = version;
        setActiveManifestVersionState(version);
        if (typeof window !== "undefined") {
            const orgId = activeOrgId || orgUser?.orgId;
            if (orgId) {
                const key = `${ACTIVE_MANIFEST_VERSION_KEY}:${orgId}`;
                localStorage.setItem(key, version);
            }
        }
    }, [activeOrgId, orgUser?.orgId]);

    const setActiveOrgId = useCallback((orgId: string | null) => {
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
    }, [activeOrgId]);

    const renameOrganization = async (newName: string): Promise<boolean> => {
        const targetOrgId = activeOrgId || orgUser?.orgId;
        if (!targetOrgId || !user) return false;
        try {
            const token = await user.getIdToken();
            const response = await fetch(`/api/workspaces/${targetOrgId}/rename`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ name: newName })
            });
            if (response.ok) {
                setOrganization(prev => prev ? { ...prev, name: newName } : null);
                setRefreshKey(prev => prev + 1);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    };

    // Listen for manifest updates dispatched by SemanticIngestion
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

    // FIX 1 continued: This effect does NOT include activeManifestVersion in deps.
    // It uses the ref instead. This breaks the loop while still reading the correct value.
    useEffect(() => {
        const fetchOrProvisionOrg = async () => {
            if (!user) {
                setOrganization(null);
                setOrgUser(null);
                setLoadingOrg(false);
                lastFetchKeyRef.current = "";
                return;
            }

            try {
                setLoadingOrg(true);
                let currentOrgUser: OrgUser;
                const isMockMode = isLocalMockMode();

                if (isMockMode) {
                    const mockSession = getLocalMockSession();
                    currentOrgUser = {
                        uid: mockSession.orgId === "demo_org_id" ? "demo_uid" : "mock_uid_dev",
                        email: mockSession.email,
                        orgId: mockSession.orgId,
                        role: "admin",
                    };
                } else {
                    const userDocRef = doc(db, "users", user.uid);
                    const userDocSnap = await getDoc(userDocRef);

                    if (userDocSnap.exists()) {
                        currentOrgUser = userDocSnap.data() as OrgUser;
                    } else {
                        const token = await user.getIdToken();
                        const response = await fetch("/api/workspaces/provision", {
                            method: "POST",
                            headers: { "Authorization": `Bearer ${token}` }
                        });
                        if (!response.ok) throw new Error("Failed to provision organization");
                        const provisionData = await response.json();
                        currentOrgUser = {
                            uid: user.uid,
                            email: user.email || "",
                            orgId: provisionData.orgId,
                            role: "admin",
                        };
                    }
                }

                setOrgUser(currentOrgUser);
                const isPlatformAdmin = currentOrgUser.role === "admin" && currentOrgUser.orgId === "system_admin_org";
                let targetOrgId = currentOrgUser.orgId;

                if (isPlatformAdmin && typeof window !== "undefined") {
                    const params = new URLSearchParams(window.location.search);
                    const queryOrgId = params.get("orgId");
                    const storedOverride = localStorage.getItem(ACTIVE_ORG_OVERRIDE_KEY);
                    const requestedOrgId = queryOrgId || storedOverride;
                    if (requestedOrgId && requestedOrgId !== currentOrgUser.orgId) {
                        targetOrgId = requestedOrgId;
                        localStorage.setItem(ACTIVE_ORG_OVERRIDE_KEY, requestedOrgId);
                    }
                }

                setActiveOrgIdState(targetOrgId);

                // Restore persisted manifest version for this org WITHOUT triggering a loop
                if (typeof window !== "undefined") {
                    const key = `${ACTIVE_MANIFEST_VERSION_KEY}:${targetOrgId}`;
                    const persisted = localStorage.getItem(key);
                    if (persisted && persisted !== activeManifestVersionRef.current) {
                        activeManifestVersionRef.current = persisted;
                        setActiveManifestVersionState(persisted);
                    }
                }

                if (targetOrgId) {
                    const localMock = isLocalMockMode() ? getLocalMockSession() : null;
                    const token = localMock?.token || await user.getIdToken();

                    // Use ref here — avoids stale closure + avoids dep loop
                    const manifestVersion = activeManifestVersionRef.current;
                    const fetchKey = `${user.uid}|${targetOrgId}|${refreshKey}|${manifestVersion}`;
                    if (fetchKey === lastFetchKeyRef.current) {
                        setLoadingOrg(false);
                        return;
                    }
                    lastFetchKeyRef.current = fetchKey;
                    const orgResponse = await fetch(
                        `/api/workspaces/${targetOrgId}/profile?version=${encodeURIComponent(manifestVersion)}`,
                        { headers: { "Authorization": `Bearer ${token}` } }
                    );

                    if (orgResponse.ok) {
                        setOrganization(await orgResponse.json());
                    } else {
                        throw new Error("Failed to load organization profile.");
                    }

                    const contextsResponse = await fetch(`/api/workspaces/${targetOrgId}/contexts`, {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    if (contextsResponse.ok) {
                        const { contexts = [] } = await contextsResponse.json();
                        setAnalysisContexts(contexts);

                        // If no version is pinned yet, auto-select the latest
                        if (activeManifestVersionRef.current === "latest" && contexts.length > 0) {
                            const latestCtx = contexts.find((c: AnalysisContext) => c.isLatest) || contexts[0];
                            if (latestCtx?.version) {
                                setActiveManifestVersion(latestCtx.version);
                            }
                        }
                    } else {
                        setAnalysisContexts([]);
                    }
                }
            } catch (err) {
                console.error("Error fetching/provisioning org:", err);
                setError("Failed to initialize workspace. Please contact support.");
            }
            setLoadingOrg(false);
        };

        fetchOrProvisionOrg();
    }, [user, activeOrgId, refreshKey, activeManifestVersion]);

    const isPlatformAdmin = orgUser?.role === "admin" && orgUser?.orgId === "system_admin_org";
    const activeContextName =
        analysisContexts.find((ctx) => ctx.version === activeManifestVersion)?.name ||
        (activeManifestVersion === "latest" ? organization?.name || null : null);

    return (
        <OrganizationContext.Provider value={{
            organization, orgUser, loadingOrg, error,
            activeOrgId, baseOrgId: orgUser?.orgId || null,
            isPlatformAdmin, refreshKey,
            analysisContexts, activeManifestVersion, activeContextName,
            setActiveOrgId, setActiveManifestVersion, renameOrganization,
        }}>
            {children}
        </OrganizationContext.Provider>
    );
}

export const useOrganization = () => useContext(OrganizationContext);
