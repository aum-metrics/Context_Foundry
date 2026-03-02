import { test, expect } from '@playwright/test';

test.describe('AUM Context Foundry E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Base URL is http://localhost:3000 as defined in playwright.config.ts
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('Landing Page - should load and display core messaging', async ({ page }) => {
        // Verify Title and Hero exist
        const heroText = page.locator('h1').filter({ hasText: 'Media Monitoring for' });
        await expect(heroText).toBeVisible({ timeout: 10000 });

        // Verify Logo exists
        const logo = page.locator('text=AUM Context Foundry').first();
        await expect(logo).toBeVisible();
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
        await expect(page.locator('h1').filter({ hasText: 'Sign in to your account' })).toBeVisible();
    });

    test('Mock Auth Bypass - Direct to Dashboard', async ({ page }) => {
        // We go direct to dashboard with the mock token query param
        await page.goto('/dashboard?mock=true');
        await page.waitForLoadState('networkidle');

        // Check if dashboard loaded correctly by checking for specific elements
        await expect(page.locator('text=Brand Health Status')).toBeVisible({ timeout: 15000 });

        // The radar chart or ASoV component should be visible
        await expect(page.locator('text=Agentic Quality Score')).toBeVisible();
    });
});
