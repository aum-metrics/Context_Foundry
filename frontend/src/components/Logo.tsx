/* eslint-disable @next/next/no-img-element */
// frontend/src/components/BrandLogo.tsx
// Drop-in replacement for Logo.tsx that respects white-label config.
// Existing <Logo> usage still works — just change imports from Logo to BrandLogo.
"use client";

import React, { useEffect } from "react";
import { tenantConfig, applyBrandCssVars } from "@/lib/whitelabel";

interface BrandLogoProps {
    className?: string;
    size?: number;
    showText?: boolean;
    isCapture?: boolean;
}

export function BrandLogo({ className = "", size = 32, showText = false, isCapture = false }: BrandLogoProps) {
    // Apply CSS brand vars on first mount — idempotent
    useEffect(() => { applyBrandCssVars(); }, []);

    const hasCustomLogo = Boolean(tenantConfig.logoUrl);

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {hasCustomLogo ? (
                // White-label custom logo image
                <img
                    src={tenantConfig.logoUrl}
                    alt={tenantConfig.brandName}
                    width={size}
                    height={size}
                    style={{ objectFit: "contain" }}
                />
            ) : (
                // Default AUM SVG logo
                <div
                    className="relative flex items-center justify-center rounded-[28%] bg-gradient-to-br from-[#8a5cf6] to-[#6366f1] shrink-0 shadow-lg shadow-indigo-500/10"
                    style={{ width: size, height: size }}
                >
                    <div
                        className="absolute rounded-full bg-[#30D29E] z-20"
                        style={{
                            top: size * 0.02,
                            right: size * 0.02,
                            width: size * 0.28,
                            height: size * 0.28,
                            border: `${Math.max(1, size * 0.06)}px solid #fff`,
                            transform: "translate(40%, -40%)",
                        }}
                    />
                    <svg viewBox="0 0 100 100" className="z-10" style={{ width: size * 0.45, height: size * 0.45 }}>
                        <path d="M50 5 L90 27.5 V72.5 L50 95 L10 72.5 V27.5 L50 5 Z" fill="white" />
                    </svg>
                </div>
            )}

            {showText && (
                <div className="flex flex-col justify-center">
                    <div
                        className="font-black tracking-tighter whitespace-nowrap text-slate-900 dark:text-white"
                        style={{ fontSize: size * 0.72, lineHeight: 1 }}
                    >
                        {hasCustomLogo ? (
                            // Custom brand — just show the name without "Context Foundry"
                            tenantConfig.brandName
                        ) : (
                            <>
                                AUM{" "}
                                <span
                                    style={{
                                        color: isCapture ? tenantConfig.colorPrimary : undefined,
                                    }}
                                    className="text-indigo-600 dark:text-blue-400"
                                >
                                    Context Foundry
                                </span>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Keep named export compatible with existing Logo imports
export { BrandLogo as Logo };
