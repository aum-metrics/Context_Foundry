"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught runtime application error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 font-sans">
                    <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xl text-center space-y-4">
                        <div className="w-16 h-16 bg-red-100 dark:bg-rose-500/20 text-red-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-8 h-8" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Something went wrong</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            AUM Context Foundry encountered an unexpected UI render error. You can attempt to recover by refreshing the application.
                        </p>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 p-4 rounded-lg text-left overflow-hidden">
                            <p className="text-xs font-mono text-slate-600 dark:text-slate-400 break-words line-clamp-3">
                                {this.state.error?.message || "Unknown rendering exception."}
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null });
                                window.location.reload();
                            }}
                            className="mt-6 w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
