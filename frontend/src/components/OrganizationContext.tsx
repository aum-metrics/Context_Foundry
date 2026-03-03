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

export interface OrgUser {
    uid: string;
    email: string;
    orgId: string;
    role: "admin" | "member";
}

export interface OrganizationContextType {
    organization: Organization | null;
    orgUser: OrgUser | null;
    loadingOrg: boolean;
    error: string | null;
}

const OrganizationContext = createContext<OrganizationContextType>({
    organization: null,
    orgUser: null,
    loadingOrg: true,
    error: null
});

export function OrganizationProvider({ children, user }: { children: React.ReactNode, user: User | null }) {
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [orgUser, setOrgUser] = useState<OrgUser | null>(null);
    const [loadingOrg, setLoadingOrg] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
                    // Auto-provision via backend (handles B2B API keys, Org creation, and strict security)
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

                        // Store provisioned B2B API key (shown once, user can retrieve from Settings)
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

                // Fetch the Organization details via safe backend endpoint (P0 Hardening)
                if (currentOrgUser.orgId) {
                    const token = await user.getIdToken();
                    const orgResponse = await fetch(`/api/workspaces/${currentOrgUser.orgId}/profile`, {
                        headers: {
                            "Authorization": `Bearer ${token}`
                        }
                    });

                    if (orgResponse.ok) {
                        const orgData = await orgResponse.json();
                        setOrganization(orgData);
                    } else {
                        console.error("Safe org fetch failed:", orgResponse.status);
                        // Fallback/Redundant check (if endpoint fails, we don't return partial state)
                        throw new Error("Failed to load organization profile safely.");
                    }
                }
            } catch (error) {
                console.error("Error fetching/provisioning org:", error);
                setError("Failed to initialize workspace. Please contact support.");
            }

            setLoadingOrg(false);
        };

        fetchOrProvisionOrg();
    }, [user]);

    return (
        <OrganizationContext.Provider value={{ organization, orgUser, loadingOrg, error }}>
            {children}
        </OrganizationContext.Provider>
    );
}

export const useOrganization = () => useContext(OrganizationContext);
