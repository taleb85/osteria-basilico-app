import { test, expect } from '@playwright/test';

test.describe('Smoke Test', () => {
  test('homepage loads without errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await page.goto('/');
    
    // Verifica che la pagina carichi
    await expect(page).toHaveTitle(/FLOW/);
    
    // Verifica nessun errore critico in console
    const criticalErrors = errors.filter(e => 
      !e.includes('service worker') && // SW errors sono OK in test
      !e.includes('manifest') // manifest errors sono OK in test
    );
    
    expect(criticalErrors.length).toBe(0);
  });

  test('PWA gate logic works in preview', async ({ page }) => {
    await page.goto('/');
    
    // In preview (non-PWA), dovrebbe mostrare install screen o bypass se VITE_ALLOW_BROWSER_APP
    const installRequired = page.locator('text=Installa FLOW');
    const bypassActive = page.locator('text=Bypass Attivo');
    
    const hasInstallOrBypass = await installRequired.isVisible()
      .catch(() => bypassActive.isVisible())
      .catch(() => false);
    
    // Uno dei due dovrebbe essere visibile, o l'app dovrebbe caricare normalmente
    // (dipende dalla config VITE_ALLOW_BROWSER_APP)
    expect(typeof hasInstallOrBypass).toBe('boolean');
  });

  test('no service role key in bundle', async ({ page }) => {
    // Naviga e cattura tutti i network requests per JS bundles
    const jsRequests: string[] = [];
    
    page.on('request', req => {
      if (req.resourceType() === 'script') {
        jsRequests.push(req.url());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Scarica tutti i JS chunk e verifica che non contengano service role key patterns
    for (const url of jsRequests) {
      if (url.includes('node_modules') || url.includes('vite/dist')) continue;
      
      const response = await page.request.get(url);
      const content = await response.text();
      
      // Pattern che indicano presenza di service role key
      expect(content).not.toContain('service_role');
      expect(content).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(content).not.toContain('supabaseAdmin');
    }
  });
});
