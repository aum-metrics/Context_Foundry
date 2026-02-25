import { Logo } from "@/components/Logo";

export default function Loading() {
    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
            <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
                <div className="relative flex flex-col items-center space-y-6">
                    <Logo size={80} showText={false} />
                    <div className="flex flex-col items-center space-y-2">
                        <h2 className="text-xl font-light text-slate-900 dark:text-white tracking-widest uppercase">
                            Context Foundry
                        </h2>
                        <div className="flex items-center space-x-2">
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
