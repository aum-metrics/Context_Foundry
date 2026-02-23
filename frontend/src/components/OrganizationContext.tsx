"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "firebase/auth";
import { db } from "@/lib/firestorePaths";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

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
}

const OrganizationContext = createContext<OrganizationContextType>({
    organization: null,
    orgUser: null,
    loadingOrg: true,
});

export function OrganizationProvider({ children, user }: { children: React.ReactNode, user: User | null }) {
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [orgUser, setOrgUser] = useState<OrgUser | null>(null);
    const [loadingOrg, setLoadingOrg] = useState(true);

    useEffect(() => {
        const fetchOrProvisionOrg = async () => {
            if (!user) {
                setOrganization(null);
                setOrgUser(null);
                setLoadingOrg(false);
                return;
            }

            if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash") {
                // Mock organization for local demo without Firebase
                setOrganization({
                    id: "mock_org_123",
                    name: "Acme Corp",
                    activeSeats: 1,
                    subscriptionTier: "enterprise",
                    apiKeys: {
                        openai: "sk-mock-acme-openai-key",
                        gemini: "g-mock-acme-gemini-key"
                    }
                });
                setOrgUser({
                    uid: user.uid || "mock_uid",
                    email: user.email || "",
                    orgId: "mock_org_123",
                    role: "admin",
                });
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
                    // Auto-provision an Organization and User for the first login
                    const newOrgId = `org_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

                    const newOrg: Organization = {
                        id: newOrgId,
                        name: `${user.email?.split('@')[0]}'s Organization`,
                        activeSeats: 1,
                        subscriptionTier: "trial",
                    };

                    await setDoc(doc(db, "organizations", newOrgId), {
                        ...newOrg,
                        createdAt: serverTimestamp(),
                    });

                    currentOrgUser = {
                        uid: user.uid,
                        email: user.email || "",
                        orgId: newOrgId,
                        role: "admin",
                    };

                    await setDoc(userDocRef, currentOrgUser);
                }

                setOrgUser(currentOrgUser);

                // Fetch the Organization details
                if (currentOrgUser.orgId) {
                    const orgDocRef = doc(db, "organizations", currentOrgUser.orgId);
                    const orgDocSnap = await getDoc(orgDocRef);
                    if (orgDocSnap.exists()) {
                        setOrganization({ id: orgDocSnap.id, ...orgDocSnap.data() } as Organization);
                    }
                }
            } catch (error) {
                console.error("Error fetching/provisioning org:", error);
            }

            setLoadingOrg(false);
        };

        fetchOrProvisionOrg();
    }, [user]);

    return (
        <OrganizationContext.Provider value={{ organization, orgUser, loadingOrg }}>
            {children}
        </OrganizationContext.Provider>
    );
}

export const useOrganization = () => useContext(OrganizationContext);
