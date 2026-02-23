import { test, expect } from '@playwright/test';

test.describe('AUM Data Labs - Infinite Canvas E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3001');
        await page.waitForLoadState('networkidle');
    });

    test('should load canvas with logo in toolbar', async ({ page }) => {
        // Check that toolbar exists
        const toolbar = page.locator('div').filter({ hasText: /\+ Data/ }).first();
        await expect(toolbar).toBeVisible();

        // Check logo is in toolbar
        const logo = page.locator('img[alt="AUM Data Labs"]').first();
        await expect(logo).toBeVisible();

        // Verify logo is in the toolbar (top of page)
        const logoBox = await logo.boundingBox();
        expect(logoBox?.y).toBeLessThan(100);
    });

    test('should toggle light/dark mode', async ({ page }) => {
        // Find dark mode toggle button
        const darkModeBtn = page.locator('button').filter({ has: page.locator('svg') }).nth(1);

        // Get initial background color
        const container = page.locator('div[class*="cursor-crosshair"]').first();
        const initialBg = await container.evaluate(el => window.getComputedStyle(el).backgroundColor);

        // Toggle mode
        await darkModeBtn.click();
        await page.waitForTimeout(500);

        // Verify background changed
        const newBg = await container.evaluate(el => window.getComputedStyle(el).backgroundColor);
        expect(initialBg).not.toBe(newBg);
    });

    test('should add data uploader to canvas', async ({ page }) => {
        // Click "+ Data" button
        const addDataBtn = page.locator('button').filter({ hasText: '+ Data' });
        await addDataBtn.click();

        // Wait for new uploader to appear
        await page.waitForTimeout(500);

        // Count uploaders (should be at least 2 now - initial + new)
        const uploaders = page.locator('text=Drop your CSV here');
        await expect(uploaders).toHaveCount(2, { timeout: 5000 });
    });

    test('should open share modal', async ({ page }) => {
        // Click Share button
        const shareBtn = page.locator('button').filter({ hasText: 'Share' });
        await shareBtn.click();

        // Verify modal appears
        await expect(page.locator('text=Share Canvas')).toBeVisible({ timeout: 5000 });
    });

    test('should open More menu and access enterprise features', async ({ page }) => {
        // Click More button (three dots)
        const moreBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
        await moreBtn.click();

        // Verify menu items
        await expect(page.locator('text=Connectors')).toBeVisible();
        await expect(page.locator('text=SSO Config')).toBeVisible();
        await expect(page.locator('text=Action Items')).toBeVisible();

        // Click Connectors
        await page.locator('text=Connectors').click();

        // Verify Connectors modal
        await expect(page.locator('text=Data Connectors')).toBeVisible({ timeout: 5000 });
    });

    test('should pan canvas', async ({ page }) => {
        // Get initial offset
        const offsetDisplay = page.locator('text=/X: -?\\d+/');
        const initialText = await offsetDisplay.textContent();

        // Pan by dragging
        const canvas = page.locator('div[class*="cursor-crosshair"]').first();
        await canvas.hover({ position: { x: 500, y: 500 } });
        await page.mouse.down();
        await page.mouse.move(600, 600);
        await page.mouse.up();

        // Wait for update
        await page.waitForTimeout(500);

        // Verify offset changed
        const newText = await offsetDisplay.textContent();
        expect(initialText).not.toBe(newText);
    });

    test('should zoom canvas with mouse wheel', async ({ page }) => {
        // Get initial scale
        const scaleDisplay = page.locator('text=/Scale: \\d+%/');
        const initialScale = await scaleDisplay.textContent();

        // Zoom in
        const canvas = page.locator('div[class*="cursor-crosshair"]').first();
        await canvas.hover({ position: { x: 500, y: 500 } });
        await page.mouse.wheel(0, -100);

        // Wait for update
        await page.waitForTimeout(500);

        // Verify scale changed
        const newScale = await scaleDisplay.textContent();
        expect(initialScale).not.toBe(newScale);
    });

    test('should display natural language bar', async ({ page }) => {
        // Check for NL query input
        const nlBar = page.locator('input[placeholder*="Ask"]').or(page.locator('input[placeholder*="query"]'));
        await expect(nlBar).toBeVisible({ timeout: 5000 });
    });

    test('backend health check', async ({ page }) => {
        // Test backend is running
        const response = await page.request.get('http://localhost:8001/api/health');
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.status).toBe('healthy');
    });
});
