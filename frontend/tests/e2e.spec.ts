import { test, expect } from '@playwright/test';

test.describe('AUM Context Foundry E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Base URL is http://localhost:3000 as defined in playwright.config.ts
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
    });

    test('Landing Page - should load and display core messaging', async ({ page }) => {
        // Verify Title and Hero exist
        const heroText = page.locator('h1');
        await expect(heroText).toContainText('Protect', { timeout: 10000 });
        await expect(heroText).toContainText('AI Search Revenue');

        // Verify Logo exists
        const logo = page.locator('text=AUM').first();
        await expect(logo).toBeVisible();
        await expect(logo).toContainText('Context');
    });

    test('Landing Page - Theme Toggle', async ({ page }) => {
        // Assume default is light or auto, toggle it
        const themeToggle = page.locator('button[aria-label="Toggle dark mode"]');
        if (await themeToggle.isVisible()) {
            await themeToggle.click();
            await page.waitForTimeout(500); // Wait for transition
            // Just verifying it doesn't crash is a good start
            await expect(themeToggle).toBeVisible();
        }
    });

    test('Navigation - Login Page', async ({ page }) => {
        // Click on Sign In
        const signInLink = page.locator('a', { hasText: 'Sign In' }).first();
        await signInLink.click();

        // Verify URL changes to /login
        await page.waitForURL('**/login', { timeout: 10000 });

        // Verify Login Page content
        await expect(page.locator('h1').filter({ hasText: 'Enterprise Access' })).toBeVisible();
    });

    test('Mock Auth Bypass - Direct to Dashboard', async ({ page }) => {
        // We go direct to dashboard with the mock token query param
        await page.goto('/dashboard?mock=true');
        await page.waitForLoadState('domcontentloaded');

        // Check if dashboard loaded correctly by checking for specific elements
        await expect(page.getByRole('heading', { name: 'Platform Health Status' })).toBeVisible({ timeout: 15000 });

        // Accuracy chart header should be visible
        await expect(page.locator('text=Accuracy Over Time')).toBeVisible();
    });

    test('Business Route Proofs - Command Center & Settings (Mock Auth)', async ({ page }) => {
        // Authenticate via mock bypass
        await page.goto('/dashboard?mock=true');
        await page.waitForLoadState('domcontentloaded');

        // Verify Command Center tab mounts
        const commandTab = page.locator('button', { hasText: 'Dashboard (SoM)' });
        await commandTab.click();
        await expect(page.locator('text=Platform Health Status')).toBeVisible();

        // Verify Manifest tab mounts
        const manifestTab = page.locator('button', { hasText: 'Agent Manifest' });
        await manifestTab.click();
        await expect(page.locator('text=Agent Manifest Generator')).toBeVisible();

        // Verify Simulator tab mounts
        const simTab = page.locator('button', { hasText: 'Co-Intelligence' });
        await simTab.click();
        await expect(page.locator('text=RAG Fidelity Monitoring')).toBeVisible();
    });
});
