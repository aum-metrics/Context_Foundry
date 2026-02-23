"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firestorePaths";
import { doc, getDoc } from "firebase/firestore";

interface AuthContextType {
    user: any;
    loading: boolean;
    signup: (email: string, password: string) => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    profile: any;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const auth = getAuth();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);

            if (firebaseUser?.email) {
                localStorage.setItem("user_email", firebaseUser.email);
                localStorage.setItem("user_uid", firebaseUser.uid);

                // Fetch subscription/tier from Firestore
                try {
                    const ref = doc(db, "users", firebaseUser.email);
                    const snap = await getDoc(ref);
                    if (snap.exists()) {
                        const data = snap.data();
                        localStorage.setItem("user_tier", data.tier || "free");
                        setProfile(data);
                    } else {
                        localStorage.setItem("user_tier", "free");
                        setProfile({ tier: "free" });
                    }
                } catch (err) {
                    console.error("Failed to load profile:", err);
                }
            } else {
                localStorage.removeItem("user_email");
                localStorage.removeItem("user_uid");
                localStorage.setItem("user_tier", "free");
            }
        });

        return () => unsubscribe();
    }, []);

    const signup = async (email: string, password: string) => {
        await createUserWithEmailAndPassword(auth, email, password);
    };

    const login = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const logout = async () => {
        await signOut(auth);
        localStorage.clear();
    };

    return (
        <AuthContext.Provider value={{ user, loading, signup, login, logout, profile }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
