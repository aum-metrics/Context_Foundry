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
        await expect(heroText).toContainText('Your Brand', { timeout: 10000 });
        await expect(heroText).toContainText('Correctly Cited by AI');

        // Verify Logo exists
        const logo = page.locator('text=AUM').first();
        await expect(logo).toBeVisible();
        await expect(logo).toContainText('CONTEXT');
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
        const commandTab = page.locator('button', { hasText: 'Command Center' });
        await commandTab.click();
        await expect(page.locator('text=Share of Mind (SoM) Monitoring')).toBeVisible();

        // Verify Team Settings tab mounts
        const teamTab = page.locator('button', { hasText: 'Team Settings' });
        await teamTab.click();
        await expect(page.locator('text=Manage Members')).toBeVisible();

        // Verify SSO Strategy tab mounts
        const ssoTab = page.locator('button', { hasText: 'SSO Strategy' });
        await ssoTab.click();
        await expect(page.locator('text=Enterprise SSO Configuration')).toBeVisible();
    });
});
