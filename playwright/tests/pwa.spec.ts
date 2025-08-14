import { test, expect } from '@playwright/test';

test.describe('PWA Functionality', () => {
  test('has valid manifest', async ({ page }) => {
    await page.goto('/');
    
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', '/manifest.json');
    
    const manifestResponse = await page.request.get('/manifest.json');
    expect(manifestResponse.ok()).toBeTruthy();
    
    const manifest = await manifestResponse.json();
    expect(manifest.name).toBe('VBIP Consent PWA');
    expect(manifest.short_name).toBe('VBIP Consent');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toHaveLength(4);
  });

  test('service worker registers', async ({ page }) => {
    await page.goto('/');
    
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          return !!registration;
        } catch (error) {
          return false;
        }
      }
      return false;
    });
    
    expect(swRegistered).toBeTruthy();
  });

  test('app works offline', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('VBIP Consent PWA');
    
    await context.setOffline(true);
    await page.reload();
    
    await expect(page.locator('h1')).toContainText('VBIP Consent PWA');
  });

  test('install prompt appears', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'));
    });
    
    await expect(page.locator('text=Install VBIP Consent PWA')).toBeVisible();
  });

  test('navigation works', async ({ page }) => {
    await page.goto('/');
    
    await page.click('text=New VBIP Session');
    await expect(page).toHaveURL('/sessions/new');
    
    await page.click('text=Pending Uploads');
    await expect(page).toHaveURL('/offline/pending');
    
    await page.click('text=Reports & Audit');
    await expect(page).toHaveURL('/reports');
  });

  test('session creation flow', async ({ page }) => {
    await page.goto('/sessions/new');
    
    await page.fill('input[id="customer_name"]', 'Test Customer');
    await page.fill('input[id="customer_contact"]', '9876543210');
    
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/sessions\/.*\/liveness/);
    await expect(page.locator('h1')).toContainText('Liveness Detection');
  });

  test('offline indicator shows when offline', async ({ page, context }) => {
    await page.goto('/');
    
    await context.setOffline(true);
    await page.reload();
    
    await expect(page.locator('text=You are offline')).toBeVisible();
  });
});
