"use client";

import { useState } from "react";
import Image from "next/image";
import { Logo } from "@/components/Logo";
import { LayoutDashboard, Database, RadioReceiver, Cpu, Settings, LogOut, Sun, Moon } from "lucide-react";
import SoMCommandCenter from "@/components/SoMCommandCenter";
import SemanticIngestion from "@/components/SemanticIngestion";
import AgentManifest from "@/components/AgentManifest";
import CoIntelligenceSimulator from "@/components/CoIntelligenceSimulator";
import { useTheme } from "@/components/ThemeProvider";
import { useOrganization } from "@/components/OrganizationContext";
import TeamSettings from "@/components/TeamSettings";
import { auth } from "@/lib/firebase";

export default function AUMContextFoundry() {
  const [activeView, setActiveView] = useState("asov");
  const { theme, toggleTheme } = useTheme();
  const { orgUser } = useOrganization();

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-hidden font-sans transition-colors duration-300">

      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-white/5 bg-slate-900/30 backdrop-blur-xl flex flex-col justify-between shrink-0">
        <div>
          <div className="p-6 pb-2">
            <div className="flex items-center space-x-3 mb-8">
              <Logo size={36} showText={true} />
            </div>
          </div>

          <nav className="flex flex-col space-y-1.5 px-3">
            <button
              onClick={() => setActiveView("som")}
              className={`flex items-center text-sm px-3 py-2.5 rounded-xl transition-all ${activeView === "som"
                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium border border-indigo-500/20"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent"
                }`}
            >
              <LayoutDashboard className="w-4 h-4 mr-3" /> Dashboard (SoM)
            </button>
            <button
              onClick={() => setActiveView("ingestion")}
              className={`flex items-center text-sm px-3 py-2.5 rounded-xl transition-all ${activeView === "ingestion"
                ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-medium border border-cyan-500/20"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent"
                }`}
            >
              <Database className="w-4 h-4 mr-3" /> Data Ingestion
            </button>
            <button
              onClick={() => setActiveView("manifest")}
              className={`flex items-center text-sm px-3 py-2.5 rounded-xl transition-all ${activeView === "manifest"
                ? "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 font-medium border border-fuchsia-500/20"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent"
                }`}
            >
              <RadioReceiver className="w-4 h-4 mr-3" /> Agent Manifest
            </button>
            <button
              onClick={() => setActiveView("simulator")}
              className={`flex items-center text-sm px-3 py-2.5 rounded-xl transition-all ${activeView === "simulator"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium border border-amber-500/20"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent"
                }`}
            >
              <Cpu className="w-4 h-4 mr-3" /> Co-Intelligence
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-white/5 space-y-1">
          <button
            onClick={toggleTheme}
            className="flex items-center tracking-wide text-sm px-3 py-2 w-full rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 mr-3" /> : <Moon className="w-4 h-4 mr-3" />}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          {orgUser?.role === "admin" && (
            <button
              onClick={() => setActiveView("team")}
              className={`flex items-center tracking-wide text-sm px-3 py-2 w-full rounded-md transition-colors ${activeView === "team" ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium" : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"}`}
            >
              <Settings className="w-4 h-4 mr-3" /> Team Settings
            </button>
          )}
          <button
            onClick={() => auth.signOut()}
            className="flex items-center tracking-wide text-sm px-3 py-2 w-full rounded-md text-slate-500 dark:text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-3" /> Disconnect
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-10 relative">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none -translate-y-20"></div>
        {activeView === "asov" && <SoMCommandCenter />}
        {activeView === "ingestion" && <SemanticIngestion />}
        {activeView === "manifest" && <AgentManifest />}
        {activeView === "simulator" && <CoIntelligenceSimulator />}
        {activeView === "team" && <TeamSettings />}
      </main>

    </div>
  );
}