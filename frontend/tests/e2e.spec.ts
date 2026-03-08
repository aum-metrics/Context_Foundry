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
        // Navbar theme toggle has no aria-label; use nav button directly
        const themeToggle = page.locator('nav button').first();
        await expect(themeToggle).toBeVisible();
        await themeToggle.click();
        await page.waitForTimeout(300);
        await expect(themeToggle).toBeVisible();
    });

    test('Navigation - Login Page', async ({ page }) => {
        // Use direct route navigation to avoid flaky navbar animation timing
        await page.goto('/login');
        await page.waitForURL('**/login', { timeout: 10000 });
        await expect(page.getByRole('heading', { name: /Enterprise Access|Create Account/i })).toBeVisible();
    });

    test('Navigation - About Page', async ({ page }) => {
        await page.goto('/about');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.getByRole('heading').first()).toBeVisible();
    });

    test('Navigation - Methods Page', async ({ page }) => {
        await page.goto('/methods');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.getByRole('heading').first()).toBeVisible();
    });

    test('Landing Page - Pricing Section Exists', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#pricing')).toBeVisible();
        await expect(page.locator('text=Transparent Pricing')).toBeVisible();
    });
});
