import { test, expect } from '@playwright/test';

test.describe('PWA', () => {
  test('ha manifest valido', async ({ page, baseURL }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href', { timeout: 30_000 });
    expect(href, 'Nessun link manifest: Playwright avvia `npm run dev` con PLAYWRIGHT=1').toBeTruthy();
    const url = new URL(href!, baseURL!);
    const res = await page.request.get(url.toString());
    expect(res.status(), 'Manifest non JSON (stai riusando un dev server senza PWA?)').toBe(200);
    const manifest = await res.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('service worker registrato', async ({ page }) => {
    await page.goto('/');
    // index.html fa spesso un reload iniziale (app_cache_version): «context destroyed» finché non è stabile
    await expect
      .poll(
        () =>
          page
            .evaluate(async () => {
              if (!('serviceWorker' in navigator)) return false;
              return !!(await navigator.serviceWorker.getRegistration());
            })
            .catch(() => false),
        { timeout: 45_000, intervals: [200, 400, 800] }
      )
      .toBe(true);
  });
});
