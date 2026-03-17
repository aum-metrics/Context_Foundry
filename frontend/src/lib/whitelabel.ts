// frontend/src/lib/whitelabel.ts
// FIX 5 / White-label architecture
//
// HOW IT WORKS:
// 1. Each tenant deployment sets NEXT_PUBLIC_TENANT_CONFIG env var (JSON string).
// 2. The config is read once at module init — zero runtime cost.
// 3. All components import from this file instead of hardcoding colors/names.
// 4. For hosted multi-tenant: the config can be fetched from /api/tenant-config
//    keyed by hostname — see getTenantConfig() below.
//
// DEPLOYMENT MODEL for parallel white-labeled products:
//   - Fork the repo (or use a monorepo with tenant/ directories).
//   - Set NEXT_PUBLIC_TENANT_CONFIG in Vercel per project.
//   - Each Vercel project = one white-labeled instance.
//   - Backend is shared; orgId scoping means data is isolated.
//   - Custom domains: each Vercel project gets its own domain.
//   - Cost: Vercel free tier supports unlimited projects; backend cost is unchanged.

export interface TenantConfig {
    /** Brand name shown in NavBar, emails, reports */
    brandName: string;
    /** Short slug used in logos, favicons, tab titles */
    brandSlug: string;
    /** Primary action color (CSS hex) */
    colorPrimary: string;
    /** Accent color for charts and highlights */
    colorAccent: string;
    /** Logo URL — if empty, falls back to the built-in SVG logo */
    logoUrl: string;
    /** Favicon URL */
    faviconUrl: string;
    /** Support email shown in footers */
    supportEmail: string;
    /** Optional: override the API base URL for dedicated backends */
    apiBaseUrl?: string;
    /** Optional: hide the pricing/upgrade UI (for white-label deployments billed externally) */
    hidePricing?: boolean;
    /** Optional: custom Razorpay key for split payments */
    razorpayKeyId?: string;
}

const DEFAULT_CONFIG: TenantConfig = {
    brandName:     "AUM Context Foundry",
    brandSlug:     "aum",
    colorPrimary:  "#4f46e5",   // indigo-600
    colorAccent:   "#06b6d4",   // cyan-500
    logoUrl:       "",           // use built-in SVG
    faviconUrl:    "/favicon.svg",
    supportEmail:  "hello@aumcontextfoundry.com",
    hidePricing:   false,
};

function loadConfig(): TenantConfig {
    const raw = process.env.NEXT_PUBLIC_TENANT_CONFIG;
    if (!raw) return DEFAULT_CONFIG;
    try {
        const parsed = JSON.parse(raw) as Partial<TenantConfig>;
        return { ...DEFAULT_CONFIG, ...parsed };
    } catch {
        console.warn("[whitelabel] Invalid NEXT_PUBLIC_TENANT_CONFIG — using defaults");
        return DEFAULT_CONFIG;
    }
}

// Module-level singleton — parsed once, never re-parsed
export const tenantConfig: TenantConfig = loadConfig();

/**
 * Inject CSS custom properties into <html> so Tailwind-style utilities
 * and inline styles can reference --brand-primary / --brand-accent.
 * Call this once in layout.tsx or a client component that mounts at root.
 */
export function applyBrandCssVars(): void {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--brand-primary", tenantConfig.colorPrimary);
    root.style.setProperty("--brand-accent",  tenantConfig.colorAccent);
}

/**
 * For hosted multi-tenant: fetch per-hostname config from the backend.
 * Backend route: GET /api/tenant-config?hostname=client.example.com
 * Returns TenantConfig JSON.
 * Cache: 5 minutes client-side.
 */
let _cachedRemoteConfig: TenantConfig | null = null;
let _cacheTs = 0;
export async function getTenantConfigForHostname(hostname?: string): Promise<TenantConfig> {
    const now = Date.now();
    if (_cachedRemoteConfig && now - _cacheTs < 5 * 60 * 1000) return _cachedRemoteConfig;

    const host = hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
    if (!host || host === "localhost") return DEFAULT_CONFIG;

    try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
        const resp = await fetch(`${apiBase}/api/tenant-config?hostname=${encodeURIComponent(host)}`, {
            next: { revalidate: 300 },
        });
        if (!resp.ok) return DEFAULT_CONFIG;
        const data = await resp.json() as Partial<TenantConfig>;
        _cachedRemoteConfig = { ...DEFAULT_CONFIG, ...data };
        _cacheTs = now;
        return _cachedRemoteConfig;
    } catch {
        return DEFAULT_CONFIG;
    }
}
