import { test, expect, type Page } from "@playwright/test";

const contextFixtures = [
  {
    id: "manifest-sight",
    version: "manifest-sight",
    name: "SightSpectrum | Data",
    isLatest: true,
    sourceUrl: "https://www.sightspectrum.com",
  },
  {
    id: "manifest-dataswitch",
    version: "manifest-dataswitch",
    name: "DataSwitch | No-Code Data Re-Engineering Platform",
    isLatest: false,
    sourceUrl: "https://www.dataswitch.ai",
  },
];

const historyFixtures = [
  {
    prompt: "How does SightSpectrum compare with Accenture, Tiger Analytics, Fractal, and Mu Sigma for enterprise AI and analytics transformation?",
    version: "manifest-sight",
    timestamp: { seconds: 1773331200 },
    results: [
      { model: "GPT-4o", accuracy: 82, hasHallucination: false, claimScore: "5/6", answer: "SightSpectrum is strongest when buyers want healthcare and data modernization depth with a smaller delivery footprint than large consultancies." },
      { model: "Gemini 3 Flash", accuracy: 79, hasHallucination: false, claimScore: "4/6", answer: "SightSpectrum is credible for enterprise analytics consulting, especially when domain depth matters more than broad systems integration scale." },
      { model: "Claude 4.5 Sonnet", accuracy: 84, hasHallucination: false, claimScore: "5/6", answer: "SightSpectrum differentiates on focused delivery, domain-led analytics, and a tighter operating model than larger transformation firms." },
    ],
  },
  {
    prompt: "How does DataSwitch compare with Accenture, Tiger Analytics, Fractal, and Mu Sigma for enterprise AI and analytics transformation?",
    version: "manifest-dataswitch",
    timestamp: { seconds: 1773417600 },
    results: [
      { model: "GPT-4o", accuracy: 63, hasHallucination: false, claimScore: "3/5", answer: "DataSwitch is positioned around no-code data re-engineering, but the public proof is narrower than larger enterprise firms." },
      { model: "Gemini 3 Flash", accuracy: 61, hasHallucination: false, claimScore: "3/5", answer: "DataSwitch appears differentiated on re-engineering speed, though enterprise-scale evidence is thinner than major consultancies." },
      { model: "Claude 4.5 Sonnet", accuracy: 66, hasHallucination: false, claimScore: "4/5", answer: "DataSwitch has a sharper re-engineering story than generic vendors, but it needs stronger executive-proof positioning." },
    ],
  },
];

async function seedMockSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mock_auth_user", "demo@demo.com");
    // Also set any other expected mock flags if necessary
    (window as unknown as { AUM_MOCK_ENV: boolean }).AUM_MOCK_ENV = true;
  });
  // Navigate to login first to ensure the script runs on a valid origin if needed
  await page.goto("/login");
  await page.evaluate(() => {
    localStorage.setItem("mock_auth_user", "demo@demo.com");
  });
}

async function stubAuthenticatedWorkspace(page: Page) {
  await page.route("**/api/workspaces/demo_org_id/profile?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "demo_org_id",
        name: "Sight Spectrum",
        activeSeats: 1,
        subscriptionTier: "scale",
        status: "active",
        createdAt: "2025-12-26T00:00:00.000Z",
      }),
    });
  });

  await page.route("**/api/methods/model-catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        models: [
          { provider: "openai", displayName: "GPT-4o", productLabel: "gpt-4o", modelId: "gpt-4o", enabled: true, displayOrder: 1 },
          { provider: "gemini", displayName: "Gemini 3 Flash", productLabel: "gemini-3-flash", modelId: "gemini-2.5-flash", enabled: true, displayOrder: 2 },
          { provider: "anthropic", displayName: "Claude 4.5 Sonnet", productLabel: "claude-sonnet-4-5", modelId: "claude-sonnet-4-20250514", enabled: true, displayOrder: 3 },
        ],
      }),
    });
  });

  await page.route("**/api/workspaces/demo_org_id/contexts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        contexts: contextFixtures,
        latestVersion: "manifest-sight",
      }),
    });
  });

  await page.route("**/api/workspaces/demo_org_id/manifest-data?**", async (route) => {
    const version = new URL(route.request().url()).searchParams.get("version") || "manifest-sight";
    const manifestName = version === "manifest-dataswitch"
      ? "DataSwitch | No-Code Data Re-Engineering Platform"
      : "SightSpectrum | Data";

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        orgId: "demo_org_id",
        version,
        name: manifestName,
        sourceUrl: version === "manifest-dataswitch" ? "https://www.dataswitch.ai" : "https://www.sightspectrum.com",
        content: `# ${manifestName}\n## Core Identity\nEnterprise analytics consulting with strong delivery proof.\n## Differentiators\nDatabricks delivery proof\nSnowflake modernization proof\nGoogle Cloud transformation outcomes`,
        schemaData: {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: manifestName,
        },
      }),
    });
  });

    await page.route("**/api/competitor/displacement/demo_org_id?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        competitors: [
          {
            name: "Mu Sigma",
            displacementRate: 88,
            strengths: ["Decision Sciences", "Global Scale", "Category Authority"],
            weaknesses: ["Agility", "Customer Focus"],
            winningCategory: "Supply Chain Analytics",
            claimsOwned: ["Largest pure-play firm", "Category Authority"],
            missingAssertions: ["industry-specific outcome proof", "category authority signals"],
          },
          {
            name: "Fractal Analytics",
            displacementRate: 72,
            strengths: ["AI Research", "Product Innovation", "Enterprise Scale"],
            weaknesses: ["Domain Specificity", "Service Level"],
            winningCategory: "Enterprise AI",
            claimsOwned: ["AI-powered logic", "Strategic transformation"],
            missingAssertions: ["differentiated innovation signals", "explicit buyer trust factors"],
          },
        ],
      }),
    });
  });

  await page.route("**/api/simulation/history/demo_org_id", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ history: historyFixtures }),
    });
  });

  await page.route("**/api/simulation/suggest-prompts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        prompts: [
          "Who are the top enterprise analytics consulting firms for retail and CPG transformation, and where does SightSpectrum fit?",
          "Which firms are strongest in Databricks, Snowflake, and Google Cloud data modernization, and how does SightSpectrum compare?",
          "How does SightSpectrum compare with Accenture, Tiger Analytics, Fractal, and Mu Sigma for enterprise AI and analytics transformation?",
          "Which vendors have domain expertise in CPG, BFSI, retail, and supply chain analytics, and what evidence supports SightSpectrum?",
        ],
      }),
    });
  });

  await page.route("**/api/simulation/run", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: historyFixtures[0].results,
        adjudication: {
          master_verdict: "Grounded and enterprise-relevant",
          winner: "Claude 4.5 Sonnet",
          audit_notes: "All three frontier models stayed aligned to the verified context.",
        },
        lockedModels: [],
      }),
    });
  });

  await page.route("**/api/seo/audit/mock", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        jobId: "seo-job-1",
      }),
    });
  });

  await page.route("**/api/seo/audit/status/demo_org_id/seo-job-1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "completed",
        result: {
          url: "https://www.sightspectrum.com",
          seoScore: 67,
          geoScore: 42,
          overallScore: 55,
          geoMethod: "alignment_blended",
          recommendation: "Tighten positioning and enterprise proof across the homepage and case-study pages.",
          checks: [
            { check: "Title Tag", status: "pass", detail: "Title present" },
            { check: "Meta Description", status: "warn", detail: "Too generic for enterprise buyers" },
          ],
        },
      }),
    });
  });

  await page.route("**/llms.txt?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: "# SightSpectrum - AI Protocol Manifest\n\n## Core Identity\nEnterprise analytics consulting with healthcare and data modernization depth.",
    });
  });

  await page.route("**/llms-full.txt?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: "# SightSpectrum - AI Protocol Manifest (Full)\n\n## Core Identity\nEnterprise analytics consulting with healthcare and data modernization depth.\n\n## Proof\nDatabricks delivery proof\nSnowflake modernization proof",
    });
  });
}

test.describe("AUM Context Foundry E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
  });

  test("Landing Page - should load and display core messaging", async ({ page }) => {
    const heroText = page.locator("h1");
    await expect(heroText).toContainText("Protect", { timeout: 10000 });
    await expect(heroText).toContainText("AI Search Revenue");

    const logo = page.locator("text=AUM").first();
    await expect(logo).toBeVisible();
    await expect(logo).toContainText("Context");
  });

  test("Landing Page - Theme Toggle", async ({ page }) => {
    const themeToggle = page.locator("nav button").first();
    await expect(themeToggle).toBeVisible();
    await themeToggle.click();
    await page.waitForTimeout(300);
    await expect(themeToggle).toBeVisible();
  });

  test("Navigation - Login Page", async ({ page }) => {
    await page.goto("/login");
    await page.waitForURL(/\/(login|dashboard)/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/(login|dashboard)/);
  });

  test("Navigation - About Page", async ({ page }) => {
    await page.goto("/about");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("Navigation - Methods Page", async ({ page }) => {
    await page.goto("/methods");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("Landing Page - Pricing Section Exists", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#pricing")).toBeVisible();
    await expect(page.locator("text=Transparent Pricing")).toBeVisible();
  });
});

test.describe("Authenticated enterprise workspace", () => {
  test.beforeEach(async ({ page }) => {
    await seedMockSession(page);
    await stubAuthenticatedWorkspace(page);
  });

  test("Dashboard - loads unified workspace and follows active context in the executive report", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000); 

    // More robust selector for the sidebar text
    const pipelineHeading = page.locator('aside p', { hasText: /Workflow Pipeline/i });
    await expect(pipelineHeading).toBeVisible({ timeout: 10000 });
    
    await expect(page.getByText(/Share of Model/i).first()).toBeVisible();

    await page.locator("select").first().selectOption("manifest-dataswitch");
    await expect(page.locator("select").first()).toHaveValue("manifest-dataswitch");
    await expect(page.getByText("Context: DataSwitch | No-Code Data Re-Engineering Platform")).toBeVisible();

    await page.getByRole("button", { name: /Open Executive View/i }).click();
    await expect(page.getByRole("heading", { name: "Brand Health Report" })).toBeVisible();
    await expect(page.getByText("Context: DataSwitch | No-Code Data Re-Engineering Platform").last()).toBeVisible();
  });

  test("Context Studio - combines ingestion and manifest review in one workspace", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Use specific headings now that we are on a unified page
    await expect(page.getByRole("heading", { name: "Ingest Source Material" })).toBeVisible();
    await expect(page.getByText("Upload raw marketing PDFs, documentation, or enter URLs")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Review AI Manifest" })).toBeVisible();
    await expect(page.getByText("Agent Manifest Generator")).toBeVisible();
  });

  test("Co-Intelligence - runs enterprise prompt pack and renders three frontier-model results", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    
    await expect(page.getByRole("heading", { name: "Enterprise Buyer Query Simulation" })).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder("Type a custom prompt...").fill("Which firms are strongest in Databricks, Snowflake, and Google Cloud data modernization?");
    await page.getByPlaceholder("Type a custom prompt...").press("Enter");

    await expect(page.getByText("GPT-4o").first()).toBeVisible();
    await expect(page.getByText("Gemini 3 Flash").first()).toBeVisible();
    await expect(page.getByText("Claude 4.5 Sonnet").first()).toBeVisible();
    await expect(page.getByText(/Accuracy:/).first()).toBeVisible();
  });
});
