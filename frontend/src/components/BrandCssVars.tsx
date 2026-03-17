"use client";

import { useEffect } from "react";
import { applyBrandCssVars } from "@/lib/whitelabel";

export default function BrandCssVars() {
    useEffect(() => {
        applyBrandCssVars();
    }, []);
    return null;
}
