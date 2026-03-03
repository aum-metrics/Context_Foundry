"use client";

import React from 'react';

export const Logo = ({
    className = '',
    size = 32,
    showText = false,
    theme = 'dark', // 'dark' | 'light' | 'auto'
}: {
    className?: string;
    size?: number;
    showText?: boolean;
    theme?: 'dark' | 'light' | 'auto';
}) => {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => {
        setMounted(true);
    }, []);

    const isDark = mounted ? (theme === 'dark' || (theme === 'auto' && document.documentElement.classList.contains('dark'))) : false;

    // Prevent hydration mismatch by rendering a stable placeholder
    if (!mounted) {
        return <div style={{ width: size, height: size }} className={className} />;
    }

    return (
        <div className={`flex items-center gap-4 ${className}`}>
            {/* Logo Icon */}
            <div
                className="relative flex items-center justify-center rounded-[28%] bg-gradient-to-br from-[#8a5cf6] to-[#6366f1] shrink-0 shadow-lg shadow-indigo-500/10"
                style={{ width: size, height: size }}
            >
                {/* Green Notification Dot */}
                <div
                    className="absolute rounded-full bg-[#30D29E] z-20"
                    style={{
                        top: size * 0.02,
                        right: size * 0.02,
                        width: size * 0.28,
                        height: size * 0.28,
                        border: `${Math.max(1, size * 0.06)}px solid ${isDark ? '#000' : '#fff'}`,
                        transform: 'translate(40%, -40%)'
                    }}
                />

                {/* Solid Hexagon */}
                <svg
                    viewBox="0 0 100 100"
                    className="z-10"
                    style={{ width: size * 0.45, height: size * 0.45 }}
                >
                    <path
                        d="M50 5 L90 27.5 V72.5 L50 95 L10 72.5 V27.5 L50 5 Z"
                        fill="white"
                    />
                </svg>
            </div>

            {/* Logo Text */}
            {showText && (
                <div className="flex flex-col justify-center">
                    <div
                        className={`font-black tracking-tighter whitespace-nowrap ${isDark ? 'text-white' : 'text-slate-900'}`}
                        style={{ fontSize: size * 0.72, lineHeight: 1 }}
                    >
                        AUM <span className="text-blue-500">CONTEXT FOUNDRY</span>
                    </div>
                </div>
            )}
        </div>
    );
};
