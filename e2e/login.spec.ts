import { test, expect } from '@playwright/test';

test.describe('Login flow', () => {
  test('mostra la schermata di login', async ({ page }) => {
    await page.goto('/profilo');
    await expect(page).toHaveTitle(/FLOW/i);
    await expect(page.getByText(/tap to start/i)).toBeVisible();
  });

  test('blocca accesso senza credenziali', async ({ page }) => {
    await page.goto('/');
    const loginButton = page.getByRole('button', { name: /accedi|login/i });
    if (await loginButton.isVisible()) {
      await loginButton.click();
      await expect(page.getByText(/pin|password|credenziali/i)).toBeVisible();
    }
  });
});
