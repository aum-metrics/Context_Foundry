"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { LayoutDashboard, Database, Cpu, Settings, LogOut, Sun, Moon, Shield, Lock, ArrowRight, Layers3 } from "lucide-react";
import SoMCommandCenter from "@/components/SoMCommandCenter";
import CoIntelligenceSimulator from "@/components/CoIntelligenceSimulator";
import { useTheme } from "@/components/ThemeProvider";
import { useOrganization } from "@/components/OrganizationContext";
import TeamSettings from "@/components/TeamSettings";
import SSOSettings from "@/components/SSOSettings";
import { UpgradeModal } from "@/components/UpgradeModal";
import { auth } from "@/lib/firebase";
import { useSearchParams } from "next/navigation";
import { useRazorpay } from "@/hooks/useRazorpay";
import ContextStudio from "@/components/ContextStudio";

interface AdminOrgOption {
  id: string;
  name: string;
}

export default function AUMContextFoundry() {
  const [activeView, setActiveView] = useState("som");
  const [contextStudioTab, setContextStudioTab] = useState<"ingestion" | "manifest">("ingestion");
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeFeatureName, setUpgradeFeatureName] = useState("Premium Features");
  const { theme, toggleTheme } = useTheme();
  const { orgUser, organization, activeOrgId, isPlatformAdmin, setActiveOrgId, analysisContexts, activeManifestVersion, activeContextName, setActiveManifestVersion } = useOrganization();
  const [adminOrgs, setAdminOrgs] = useState<AdminOrgOption[]>([]);
  const searchParams = useSearchParams();
  const { checkout } = useRazorpay();
  const autoCheckoutTriggeredRef = useRef(false);

  useEffect(() => {
    if (!isPlatformAdmin) {
      setAdminOrgs([]);
      return;
    }

    const loadAdminOrgs = async () => {
      try {
        const resp = await fetch("/api/admin/orgs?page_size=100", { credentials: "include" });
        if (!resp.ok) return;
        const data = await resp.json();
        const options = (data.orgs || [])
          .map((org: { id: string; name: string }) => ({ id: org.id, name: org.name }))
          .filter((org: AdminOrgOption) => org.id !== "system_admin_org");
        setAdminOrgs(options);
      } catch (error) {
        console.error("Failed to load admin tenant options", error);
      }
    };

    loadAdminOrgs();
  }, [isPlatformAdmin]);

  useEffect(() => {
    if (organization?.subscriptionTier === "explorer" && activeView === "som") {
      setActiveView("simulator");
    }
  }, [organization?.subscriptionTier, activeView]);

  const openWorkspaceView = (view: string) => {
    if (view === "ingestion" || view === "manifest") {
      setContextStudioTab(view);
      setActiveView("context");
      return;
    }
    setActiveView(view);
  };

  const workspaceViews = [
    {
      id: "som",
      label: "Command Center",
      icon: LayoutDashboard,
      locked: organization?.subscriptionTier === "explorer",
    },
    {
      id: "context",
      label: "Context Studio",
      icon: Layers3,
      locked: false,
    },
    {
      id: "simulator",
      label: "Co-Intelligence",
      icon: Cpu,
      locked: false,
    },
  ];

  useEffect(() => {
    if (autoCheckoutTriggeredRef.current) return;
    if (!organization?.id || !orgUser?.email) return;

    const requestedPlan = searchParams.get("upgrade");
    const requestedCurrency = (searchParams.get("currency") || "INR").toUpperCase();
    const normalizedPlan = requestedPlan === "growth" || requestedPlan === "scale" ? requestedPlan : null;
    const normalizedCurrency = requestedCurrency === "USD" ? "USD" : "INR";

    if (!normalizedPlan) return;
    autoCheckoutTriggeredRef.current = true;

    checkout(
      normalizedPlan,
      organization.id,
      orgUser.email,
      normalizedCurrency,
      () => window.location.reload(),
      (error) => {
        console.error("Auto checkout from upgrade intent failed", error);
      }
    );

    // Remove transient intent params so refresh/back doesn't relaunch checkout.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("upgrade");
      url.searchParams.delete("currency");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, organization?.id, orgUser?.email, checkout]);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-hidden font-sans transition-colors duration-300">

      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-white/5 bg-slate-900/30 backdrop-blur-xl flex flex-col justify-between shrink-0">
        <div>
          <div className="p-6 pb-2">
            <div className="flex items-center space-x-3 mb-8">
              <Logo size={36} showText={true} theme="auto" />
            </div>
            {isPlatformAdmin && (
              <div className="mb-6">
                <label className="block text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-500 mb-2">
                  Active Tenant
                </label>
                <select
                  value={activeOrgId || "system_admin_org"}
                  onChange={(e) => setActiveOrgId(e.target.value === "system_admin_org" ? null : e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="system_admin_org">System Admin Org</option>
                  {adminOrgs.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
                  Workspace surfaces will operate on {organization?.name || "the selected tenant"}.
                </p>
              </div>
            )}
            <div className="mb-6">
              <label className="block text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-500 mb-2">
                Analysis Context
              </label>
              <select
                value={activeManifestVersion}
                onChange={(e) => setActiveManifestVersion(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-500"
              >
                <option value="latest">Latest Context ({organization?.name || "Current"})</option>
                {analysisContexts.map((context) => (
                  <option key={context.version} value={context.version}>
                    {context.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
                You are analyzing {activeContextName || organization?.name || "the selected context"}.
              </p>
            </div>
          </div>

          <nav className="flex flex-col space-y-1.5 px-3">
            <button
              onClick={() => {
                if (organization?.subscriptionTier === "explorer") {
                  setUpgradeFeatureName("SoM Dashboard + Historical Trends");
                  setIsUpgradeModalOpen(true);
                  return;
                }
                openWorkspaceView("som");
              }}
              className={`flex items-center text-sm px-3 py-2.5 rounded-xl transition-all ${activeView === "som"
                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium border border-indigo-500/20"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent"
                }`}
            >
              {organization?.subscriptionTier === "explorer" ? <Lock className="w-4 h-4 mr-3" /> : <LayoutDashboard className="w-4 h-4 mr-3" />} Dashboard (SoM)
            </button>
            <button
              onClick={() => openWorkspaceView("context")}
              className={`flex items-center text-sm px-3 py-2.5 rounded-xl transition-all ${activeView === "context"
                ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-medium border border-cyan-500/20"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent"
                }`}
            >
              <Layers3 className="w-4 h-4 mr-3" /> Context Studio
            </button>
            <button
              onClick={() => openWorkspaceView("simulator")}
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
          {orgUser?.role === "admin" && (
            <button
              onClick={() => setActiveView("sso")}
              className={`flex items-center tracking-wide text-sm px-3 py-2 w-full rounded-md transition-colors ${activeView === "sso" ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium" : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"}`}
            >
              <Shield className="w-4 h-4 mr-3" /> SSO Settings
            </button>
          )}
          <button
            onClick={async () => {
              if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash") {
                localStorage.removeItem("mock_auth_user");
                window.dispatchEvent(new Event("mock_auth_change"));
              } else {
                try {
                  await auth.signOut();
                } catch (error) {
                  console.error("Failed to sign out", error);
                }
              }
            }}
            className="flex items-center tracking-wide text-sm px-3 py-2 w-full rounded-md text-slate-500 dark:text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-3" /> Disconnect
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-10 relative">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none -translate-y-20"></div>
        <div className="relative z-10 mb-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Enterprise Workspace</p>
              <h2 className="mt-1 text-lg font-medium text-slate-900 dark:text-white">One operating surface for context, market evidence, and buyer-facing reporting</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 dark:border-white/10 px-3 py-1 text-xs text-slate-500">
                Plan: {organization?.subscriptionTier || "explorer"}
              </span>
              <span className="rounded-full border border-slate-200 dark:border-white/10 px-3 py-1 text-xs text-slate-500">
                Context: {activeContextName || organization?.name || "Current"}
              </span>
              <span className="rounded-full border border-slate-200 dark:border-white/10 px-3 py-1 text-xs text-slate-500">
                Version: {activeManifestVersion}
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {workspaceViews.map((view) => {
              const Icon = view.icon;
              const isActive = activeView === view.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => {
                    if (view.locked) {
                      setUpgradeFeatureName("SoM Dashboard + Historical Trends");
                      setIsUpgradeModalOpen(true);
                      return;
                    }
                    openWorkspaceView(view.id);
                  }}
                  className={`inline-flex items-center rounded-xl border px-3 py-2 text-sm transition-all ${
                    isActive
                      ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:bg-white/5"
                  }`}
                >
                  {view.locked ? <Lock className="mr-2 h-4 w-4" /> : <Icon className="mr-2 h-4 w-4" />}
                  {view.label}
                </button>
              );
            })}
            <div className="ml-auto hidden items-center gap-2 text-xs text-slate-500 xl:flex">
              <Database className="h-3.5 w-3.5" />
              Ingest
              <ArrowRight className="h-3.5 w-3.5" />
              Manifest
              <ArrowRight className="h-3.5 w-3.5" />
              Simulation
              <ArrowRight className="h-3.5 w-3.5" />
              Executive report
            </div>
          </div>
        </div>
        {activeView === "som" && organization?.subscriptionTier !== "explorer" && <SoMCommandCenter setActiveView={openWorkspaceView} />}
        {activeView === "context" && <ContextStudio initialTab={contextStudioTab} onReturnToInsights={() => openWorkspaceView("som")} />}
        {activeView === "simulator" && <CoIntelligenceSimulator />}
        {activeView === "team" && <TeamSettings />}
        {activeView === "sso" && <SSOSettings />}
        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          featureHighlight={upgradeFeatureName}
        />
      </main>

    </div>
  );
}
