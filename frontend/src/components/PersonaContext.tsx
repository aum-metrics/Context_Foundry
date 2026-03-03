"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Persona = "CTO" | "CMO";

interface PersonaContextType {
    persona: Persona;
    setPersona: (persona: Persona) => void;
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

export function PersonaProvider({ children }: { children: React.ReactNode }) {
    const [persona, setPersona] = useState<Persona>("CMO"); // Default to marketing for public pages
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem("aum_persona") as Persona;
        if (saved) setPersona(saved);
        else localStorage.setItem("aum_persona", "CMO");
    }, []);

    const handleSetPersona = (p: Persona) => {
        setPersona(p);
        localStorage.setItem("aum_persona", p);
    };

    // Prevent hydration mismatch by returning a stable wrapper before mounting
    // Wait, if we return children before mount, any child using `persona` will render the default state (CMO) on the server,
    // which is perfectly fine for Next.js hydration as long as it aligns.

    return (
        <PersonaContext.Provider value={{ persona, setPersona: handleSetPersona }}>
            {children}
        </PersonaContext.Provider>
    );
}

export function usePersona() {
    const context = useContext(PersonaContext);
    if (context === undefined) {
        throw new Error("usePersona must be used within a PersonaProvider");
    }
    return context;
}
