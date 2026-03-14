"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Logo } from "@/components/Logo";
import { Settings, LogOut, Sun, Moon, Shield, Database, RadioReceiver, Activity, Award, ChevronDown, ChevronUp, Check, X, Pencil } from "lucide-react";
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
import SemanticIngestion from "@/components/SemanticIngestion";
import AgentManifest from "@/components/AgentManifest";

interface AdminOrgOption {
  id: string;
  name: string;
}

const PIPELINE_STEPS = [
  { id: "ingest", label: "1. Ingest", sublabel: "Source material", icon: Database },
  { id: "manifest", label: "2. Manifest", sublabel: "AI context review", icon: RadioReceiver },
  { id: "intelligence", label: "3. Intelligence", sublabel: "Competitor ranking", icon: Activity },
  { id: "simulate", label: "4. Simulate", sublabel: "Buyer queries", icon: Activity },
  { id: "report", label: "5. Report", sublabel: "Executive output", icon: Award },
];

export default function AUMContextFoundry() {
  const [activeSettingsView, setActiveSettingsView] = useState<"workspace" | "team" | "sso">("workspace");
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeFeatureName, setUpgradeFeatureName] = useState("Premium Features");
  const [activeStep, setActiveStep] = useState("ingest");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const { theme, toggleTheme } = useTheme();
  const { orgUser, organization, activeOrgId, isPlatformAdmin, setActiveOrgId, analysisContexts, activeManifestVersion, activeContextName, setActiveManifestVersion, renameOrganization } = useOrganization();
  const [adminOrgs, setAdminOrgs] = useState<AdminOrgOption[]>([]);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const searchParams = useSearchParams();
  const { checkout } = useRazorpay();
  const autoCheckoutTriggeredRef = useRef(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const isManualScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleRename = async () => {
    if (!renameValue.trim() || renameValue === (activeContextName || organization?.name)) {
      setIsRenaming(false);
      return;
    }
    const success = await renameOrganization(renameValue.trim());
    if (success) setIsRenaming(false);
  };

  useEffect(() => {
    if (!isPlatformAdmin) { setAdminOrgs([]); return; }
    const loadAdminOrgs = async () => {
      try {
        const resp = await fetch("/api/admin/orgs?page_size=100", { credentials: "include" });
        if (!resp.ok) return;
        const data = await resp.json();
        const options = (data.orgs || [])
          .map((org: { id: string; name: string }) => ({ id: org.id, name: org.name }))
          .filter((org: AdminOrgOption) => org.id !== "system_admin_org");
        setAdminOrgs(options);
      } catch (error) { console.error("Failed to load admin tenant options", error); }
    };
    loadAdminOrgs();
  }, [isPlatformAdmin]);

  useEffect(() => {
    if (autoCheckoutTriggeredRef.current) return;
    if (!organization?.id || !orgUser?.email) return;
    const requestedPlan = searchParams.get("upgrade");
    const requestedCurrency = (searchParams.get("currency") || "INR").toUpperCase();
    const normalizedPlan = requestedPlan === "growth" || requestedPlan === "scale" ? requestedPlan : null;
    const normalizedCurrency = requestedCurrency === "USD" ? "USD" : "INR";
    if (!normalizedPlan) return;
    autoCheckoutTriggeredRef.current = true;
    checkout(normalizedPlan, organization.id, orgUser.email, normalizedCurrency,
      () => window.location.reload(),
      (error) => { console.error("Auto checkout from upgrade intent failed", error); }
    );
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("upgrade"); url.searchParams.delete("currency");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, organization?.id, orgUser?.email, checkout]);

  const scrollToStep = useCallback((stepId: string) => {
    isManualScrollingRef.current = true;
    setActiveStep(stepId);
    
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    
    const el = sectionRefs.current[stepId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Release the manual scroll lock after the smooth scroll finishes (~800ms)
    scrollTimeoutRef.current = setTimeout(() => {
      isManualScrollingRef.current = false;
    }, 1000);
  }, []);

  const toggleSection = (id: string) =>
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));

  const setSectionRef = (id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  };

  const isExplorer = organization?.subscriptionTier === "explorer";

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-hidden font-sans transition-colors duration-300">

      {/* Sidebar */}
      <aside className="w-60 border-r border-white/5 bg-slate-900/30 backdrop-blur-xl flex flex-col justify-between shrink-0">
        <div>
          <div className="p-5 pb-2">
            <div className="flex items-center space-x-3 mb-6">
              <Logo size={32} showText={true} theme="auto" />
            </div>
            {isPlatformAdmin && (
              <div className="mb-4">
                <label className="block text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">Active Tenant</label>
                <select
                  value={activeOrgId || "system_admin_org"}
                  onChange={(e) => setActiveOrgId(e.target.value === "system_admin_org" ? null : e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="system_admin_org">System Admin Org</option>
                  {adminOrgs.map((org) => (<option key={org.id} value={org.id}>{org.name}</option>))}
                </select>
              </div>
            )}
              <div className="mt-1.5 flex flex-col gap-1 group">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Analysis Context</p>
                  {!isRenaming && (
                    <button
                      onClick={() => {
                        setRenameValue(activeContextName || organization?.name || "");
                        setIsRenaming(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded"
                      title="Rename Organization"
                    >
                      <Pencil className="w-2.5 h-2.5 text-slate-400" />
                    </button>
                  )}
                </div>
                {isRenaming ? (
                  <div className="flex items-center gap-1 w-full bg-white dark:bg-slate-800 border border-indigo-500 rounded p-1 shadow-lg shadow-indigo-500/10">
                    <input
                      autoFocus
                      className="bg-transparent text-[10px] w-full outline-none px-1"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename();
                        if (e.key === "Escape") setIsRenaming(false);
                      }}
                    />
                    <div className="flex items-center gap-0.5 border-l border-slate-200 dark:border-slate-700 pl-1">
                      <button onClick={handleRename} className="p-0.5 hover:bg-emerald-500/20 text-emerald-500 rounded transition-colors" title="Save">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={() => setIsRenaming(false)} className="p-0.5 hover:bg-rose-500/20 text-rose-500 rounded transition-colors" title="Cancel">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <select
                      value={activeManifestVersion}
                      onChange={(e) => setActiveManifestVersion(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-500"
                    >
                      <option value="latest">Latest — {organization?.name || "Current"}</option>
                      {analysisContexts
                        .filter(ctx => ctx.id !== "latest") // Safety check
                        .map((context) => {
                          const dateObj = context.createdAt ? new Date(context.createdAt) : null;
                          const dateStr = dateObj ? dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                          return (
                            <option key={context.version} value={context.version}>
                              {context.name} {dateStr ? `(${dateStr})` : ''}
                            </option>
                          );
                        })}
                    </select>
                    <p className="mt-1.5 text-[10px] text-indigo-500 font-medium truncate">
                      {activeContextName || organization?.name || "—"}
                    </p>
                  </div>
                )}
              </div>
          </div>

          {/* Pipeline Nav */}
          <div className="px-3 mt-2">
            <p className="text-[9px] uppercase tracking-[0.25em] text-slate-500 mb-2 px-2">Workflow Pipeline</p>
            {PIPELINE_STEPS.map((step) => {
              const isActive = activeStep === step.id;
              return (
                <button
                  key={step.id}
                  onClick={() => scrollToStep(step.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-0.5 text-left transition-all ${isActive
                    ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${isActive ? "bg-indigo-500 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                    {step.label.split(".")[0]}
                  </div>
                  <div>
                    <p className="text-xs font-medium leading-none">{step.label.split(". ")[1]}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">{step.sublabel}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 border-t border-slate-200 dark:border-white/5 space-y-0.5">
          <button onClick={toggleTheme} className="flex items-center text-xs px-2.5 py-2 w-full rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
            {theme === "dark" ? <Sun className="w-3.5 h-3.5 mr-2.5" /> : <Moon className="w-3.5 h-3.5 mr-2.5" />}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          {orgUser?.role === "admin" && (
            <button onClick={() => setActiveSettingsView("team")} className={`flex items-center text-xs px-2.5 py-2 w-full rounded-lg transition-colors ${activeSettingsView === "team" ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"}`}>
              <Settings className="w-3.5 h-3.5 mr-2.5" /> Team Settings
            </button>
          )}
          {orgUser?.role === "admin" && (
            <button onClick={() => setActiveSettingsView("sso")} className={`flex items-center text-xs px-2.5 py-2 w-full rounded-lg transition-colors ${activeSettingsView === "sso" ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"}`}>
              <Shield className="w-3.5 h-3.5 mr-2.5" /> SSO Settings
            </button>
          )}
          <button
            onClick={async () => {
              if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash") {
                localStorage.removeItem("mock_auth_user"); window.dispatchEvent(new Event("mock_auth_change"));
              } else { try { await auth.signOut(); } catch (error) { console.error("Failed to sign out", error); } }
            }}
            className="flex items-center text-xs px-2.5 py-2 w-full rounded-lg text-slate-500 dark:text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 mr-2.5" /> Disconnect
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative" id="main-scroll">
        {/* Sticky Pipeline Progress Bar */}
        <div className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {PIPELINE_STEPS.map((step, i) => {
                const isActive = activeStep === step.id;
                const steps = PIPELINE_STEPS.map(s => s.id);
                const activeIdx = steps.indexOf(activeStep);
                const isPast = i < activeIdx;
                return (
                  <div key={step.id} className="flex items-center">
                    <button
                      onClick={() => scrollToStep(step.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${isActive
                        ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30"
                        : isPast
                          ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                          : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${isActive ? "bg-white/20" : isPast ? "bg-emerald-200 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-slate-200 dark:bg-slate-800"}`}>
                        {isPast ? "✓" : step.label.split(".")[0]}
                      </span>
                      <span className="hidden sm:block font-medium">{step.label.split(". ")[1]}</span>
                    </button>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <div className={`w-6 h-px mx-0.5 ${i < activeIdx ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-800"}`} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="hidden md:block">{activeContextName || organization?.name || "No context"}</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 capitalize">{organization?.subscriptionTier || "explorer"}</span>
            </div>
          </div>
        </div>

        {activeSettingsView === "workspace" && (
          <div className="px-8 py-8 max-w-[1400px] mx-auto space-y-0">

            {/* STEP 1: Ingest */}
            <WorkflowSection
              id="ingest"
              stepNumber={1}
              title="Ingest Source Material"
              description="Upload or link your company's verified content — product pages, case studies, whitepapers. This becomes the ground truth AI models are scored against."
              accentColor="cyan"
              isCollapsed={!!collapsedSections["ingest"]}
              onToggle={() => toggleSection("ingest")}
              onStepVisible={() => setActiveStep("ingest")}
              sectionRef={setSectionRef("ingest")}
              isManualScrollingRef={isManualScrollingRef}
            >
              <SemanticIngestion />
            </WorkflowSection>

            <PipelineConnector label="Context processed → AI manifest generated" />

            {/* STEP 2: Manifest */}
            <WorkflowSection
              id="manifest"
              stepNumber={2}
              title="Review AI Manifest"
              description="Your llms.txt and llms-full.txt files define what AI engines know about you. Review and confirm these are accurate before running competitive analysis."
              accentColor="fuchsia"
              isCollapsed={!!collapsedSections["manifest"]}
              onToggle={() => toggleSection("manifest")}
              onStepVisible={() => setActiveStep("manifest")}
              sectionRef={setSectionRef("manifest")}
              isManualScrollingRef={isManualScrollingRef}
            >
              <AgentManifest />
            </WorkflowSection>

            <PipelineConnector label="Manifest verified → Running competitor ranking" />

            {/* STEP 3: Intelligence */}
            <WorkflowSection
              id="intelligence"
              stepNumber={3}
              title="Competitor Ranking & Share of Model"
              description="Run enterprise batch analysis to see which buyer-intent queries your competitors win and why. Get prescriptive remediation down to exact copy blocks and schema markup."
              accentColor="indigo"
              isCollapsed={!!collapsedSections["intelligence"]}
              onToggle={() => toggleSection("intelligence")}
              onStepVisible={() => setActiveStep("intelligence")}
              sectionRef={setSectionRef("intelligence")}
              isManualScrollingRef={isManualScrollingRef}
              locked={isExplorer}
              onUnlock={() => { setUpgradeFeatureName("Competitor Rankings & Prescriptive Remediation"); setIsUpgradeModalOpen(true); }}
              lockedMessage="Upgrade to Growth to unlock continuous Share of Model tracking, competitor displacement rates, and prescriptive remediation copy."
            >
              <SoMCommandCenter setActiveView={() => {}} />
            </WorkflowSection>

            <PipelineConnector label="Intelligence complete → Validate with buyer queries" />

            {/* STEP 4: Simulate */}
            <WorkflowSection
              id="simulate"
              stepNumber={4}
              title="Enterprise Buyer Query Simulation"
              description="Test live buyer queries across GPT-4o, Gemini, and Claude. See which model recommends you, which recommends a competitor, and exactly what they say."
              accentColor="amber"
              isCollapsed={!!collapsedSections["simulate"]}
              onToggle={() => toggleSection("simulate")}
              onStepVisible={() => setActiveStep("simulate")}
              sectionRef={setSectionRef("simulate")}
              isManualScrollingRef={isManualScrollingRef}
            >
              <CoIntelligenceSimulator />
            </WorkflowSection>

            <PipelineConnector label="Simulations scored → Executive report ready" />

            {/* STEP 5: Report */}
            <WorkflowSection
              id="report"
              stepNumber={5}
              title="Executive Report"
              description="Export a boardroom-ready PDF with SoM scores, competitor displacement evidence, and the exact site copy needed to reclaim AI-recommended market position."
              accentColor="emerald"
              isCollapsed={!!collapsedSections["report"]}
              onToggle={() => toggleSection("report")}
              onStepVisible={() => setActiveStep("report")}
              sectionRef={setSectionRef("report")}
              isManualScrollingRef={isManualScrollingRef}
            >
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-10 text-center">
                <Award className="w-10 h-10 mx-auto text-emerald-500 mb-4" />
                <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-2">Generate Executive Report</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">Open the Command Center above and use the <strong>&quot;Open Executive Report&quot;</strong> button to generate and download your boardroom PDF.</p>
              </div>
            </WorkflowSection>

            {/* Bottom padding */}
            <div className="h-24" />
          </div>
        )}

        {activeSettingsView === "team" && (
          <div className="px-8 py-8"><TeamSettings /></div>
        )}
        {activeSettingsView === "sso" && (
          <div className="px-8 py-8"><SSOSettings /></div>
        )}

        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          featureHighlight={upgradeFeatureName}
        />
      </main>
    </div>
  );
}

// --- Sub-components ---

interface WorkflowSectionProps {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  accentColor: "cyan" | "fuchsia" | "indigo" | "amber" | "emerald";
  isCollapsed: boolean;
  onToggle: () => void;
  onStepVisible: () => void;
  sectionRef: (el: HTMLElement | null) => void;
  children: React.ReactNode;
  locked?: boolean;
  onUnlock?: () => void;
  lockedMessage?: string;
  isManualScrollingRef: React.RefObject<boolean>;
}

const accentMap = {
  cyan:    { badge: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20", bar: "bg-cyan-500", ring: "ring-cyan-500/20", connector: "border-cyan-500/30" },
  fuchsia: { badge: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/20", bar: "bg-fuchsia-500", ring: "ring-fuchsia-500/20", connector: "border-fuchsia-500/30" },
  indigo:  { badge: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20", bar: "bg-indigo-500", ring: "ring-indigo-500/20", connector: "border-indigo-500/30" },
  amber:   { badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20", bar: "bg-amber-500", ring: "ring-amber-500/20", connector: "border-amber-500/30" },
  emerald: { badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20", bar: "bg-emerald-500", ring: "ring-emerald-500/20", connector: "border-emerald-500/30" },
};

function WorkflowSection({ id, stepNumber, title, description, accentColor, isCollapsed, onToggle, onStepVisible, sectionRef, children, locked, onUnlock, lockedMessage, isManualScrollingRef }: WorkflowSectionProps) {
  const accent = accentMap[accentColor];
  const observerRef = useRef<HTMLElement | null>(null);

  const setRef = (el: HTMLElement | null) => {
    observerRef.current = el;
    sectionRef(el);
  };

  useEffect(() => {
    if (!observerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { 
        if (entry.isIntersecting && !isManualScrollingRef.current) {
          onStepVisible(); 
        }
      },
      { threshold: 0.2, rootMargin: "-10% 0px -80% 0px" }
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [onStepVisible, isManualScrollingRef]);

  return (
    <section ref={setRef} id={id} className="relative scroll-mt-16">
      <div className={`rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden transition-all duration-300`}>
        {/* Section header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5 cursor-pointer group`} onClick={onToggle}>
          <div className="flex items-center gap-4">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 border ${accent.badge}`}>
              {stepNumber}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
                {locked && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 uppercase tracking-wider">Locked</span>}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">{description}</p>
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1">
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Section body */}
        {!isCollapsed && (
          <div className="p-6">
            {locked ? (
              <div className="text-center py-10">
                <p className="text-slate-500 max-w-md mx-auto mb-5 text-sm">{lockedMessage}</p>
                <button onClick={onUnlock} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2">
                  View Plans
                </button>
              </div>
            ) : (
              children
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function PipelineConnector({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-3 px-6">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
      <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-600 whitespace-nowrap shrink-0">{label}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
    </div>
  );
}
