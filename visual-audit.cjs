const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const outputDir = './visual-audit';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  // Detect port
  const ports = [5173, 3000, 4000, 8080];
  let baseUrl = null;
  for (const port of ports) {
    try {
      await page.goto(`http://localhost:${port}`, { timeout: 3000 });
      baseUrl = `http://localhost:${port}`;
      break;
    } catch {}
  }
  if (!baseUrl) { console.log('App not running — avvia npm run dev'); await browser.close(); return; }

  console.log(`\n✅ App trovata su ${baseUrl}`);
  console.log('=== EFFETTUA IL LOGIN NEL BROWSER CHE SI È APERTO ===');
  console.log('Dopo il login, premi "Resume" nel DevTools Playwright Inspector\n');
  await page.pause();

  const screenshot = async (name, delay = 800) => {
    await page.waitForTimeout(delay);
    await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: true });
    console.log(`✓ ${name}`);
  };

  await context.storageState({ path: './auth-state.json' });
  console.log('\n📸 Avvio cattura schermate...\n');

  // 01 - Home / Panoramica
  await screenshot('01-home-panoramica', 1000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await screenshot('02-home-bottom');
  await page.evaluate(() => window.scrollTo(0, 0));

  // 03 - Turni
  try {
    await page.click('nav a[href*="turni"], button:has-text("Turni")', { timeout: 3000 });
    await screenshot('03-turni');
  } catch { await screenshot('03-turni-fallback'); }

  // 04 - Turni menu hamburger
  try {
    await page.click('button[aria-label*="menu"], button[aria-label*="Menu"], button[aria-label*="hamburger"], [class*="hamburger"]', { timeout: 2000 });
    await screenshot('04-turni-menu-panel');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } catch {}

  // 05 - Turni click su cella turno (modal dettaglio)
  try {
    const cell = await page.$('[class*="shift-cell"], [class*="rounded-md"][class*="flex"][class*="cursor-grab"]');
    if (cell) { await cell.click(); await screenshot('05-turni-shift-modal'); await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
  } catch {}

  // 06 - Presenze
  try {
    await page.click('nav a[href*="presenze"], button:has-text("Presenze")', { timeout: 3000 });
    await screenshot('06-presenze');
  } catch { await screenshot('06-presenze-fallback'); }

  // 07 - Presenze period picker
  try {
    await page.click('[class*="ui-toolbar-group"] button', { timeout: 2000 });
    await screenshot('07-presenze-period-picker');
    await page.keyboard.press('Escape');
  } catch {}

  // 08 - Presenze shift detail (click su cella)
  try {
    const tsCell = await page.$('td button, [class*="punched"], [class*="timbratur"]');
    if (tsCell) { await tsCell.click(); await screenshot('08-presenze-shift-detail'); await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
  } catch {}

  // 09 - Statistiche
  try {
    await page.click('button:has-text("Statistiche"), a[href*="stat"]', { timeout: 2000 });
    await screenshot('09-statistiche');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await screenshot('10-statistiche-bottom');
    await page.evaluate(() => window.scrollTo(0, 0));
  } catch {}

  // 11 - Ferie
  try {
    await page.click('nav a[href*="ferie"], button:has-text("Ferie")', { timeout: 3000 });
    await screenshot('11-ferie');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await screenshot('12-ferie-bottom');
    await page.evaluate(() => window.scrollTo(0, 0));
  } catch {}

  // 13 - Profilo
  try {
    await page.click('nav a[href*="profilo"], [class*="TALEB"], [class*="profilo"]', { timeout: 3000 });
    await screenshot('13-profilo');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await screenshot('14-profilo-bottom');
    await page.evaluate(() => window.scrollTo(0, 0));
  } catch {}

  // 15 - Impostazioni (Admin)
  try {
    await page.goto(`${baseUrl}/settings`, { timeout: 3000 });
    await screenshot('15-settings');
  } catch {}

  // 16 - Notifiche
  try {
    await page.goto(baseUrl);
    await page.click('[aria-label*="notif"], [class*="notif"], [class*="bell"]', { timeout: 2000 });
    await screenshot('16-notifiche');
    await page.keyboard.press('Escape');
  } catch {}

  // 17 - Bottom Nav close-up (mobile width)
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await screenshot('17-mobile-home');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await screenshot('18-mobile-bottom-nav');
    await page.setViewportSize({ width: 1440, height: 900 });
  } catch {}

  await browser.close();

  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.png')).sort();
  console.log(`\n✅ Screenshot completati: ${files.length} file`);
  console.log(files.map(f => `  - ${f}`).join('\n'));
  console.log('\nOra analizza le immagini in ./visual-audit/ e crea FULL-UI-AUDIT.md');
})();
