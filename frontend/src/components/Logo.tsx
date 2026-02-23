import React from 'react';

export const Logo = ({
    className = '',
    size = 32,
    showText = false,
}: {
    className?: string;
    size?: number;
    showText?: boolean;
}) => {
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {/* Logo Icon */}
            <div
                className="relative flex items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 shrink-0 shadow-lg shadow-indigo-500/20"
                style={{ width: size, height: size }}
            >
                {/* Green dot */}
                <div
                    className="absolute rounded-full bg-green-500 border-2 border-slate-900"
                    style={{
                        top: -size * 0.08,
                        right: -size * 0.08,
                        width: size * 0.25,
                        height: size * 0.25,
                        borderWidth: Math.max(1, size * 0.05),
                    }}
                />
                {/* SVG Note */}
                <svg
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    className="fill-white"
                    style={{ width: size * 0.5, height: size * 0.5 }}
                >
                    <path d="M12 1L3 5v14l9 4 9-4V5l-9-4zm0 18l-7-3.11V8.11L12 11.22l7-3.11v7.78L12 19z" />
                </svg>
            </div>

            {/* Logo Text */}
            {showText && (
                <div className="flex flex-col justify-center">
                    <div
                        className="font-bold text-slate-900 dark:text-white leading-none tracking-tight whitespace-nowrap"
                        style={{ fontSize: size * 0.6 }}
                    >
                        AUM Context Foundry
                    </div>
                    <div
                        className="font-semibold text-slate-500 dark:text-slate-400 tracking-wider whitespace-nowrap"
                        style={{ fontSize: size * 0.25, marginTop: size * 0.1 }}
                    >
                        BY AUM DATA LABS
                    </div>
                </div>
            )}
        </div>
    );
};
