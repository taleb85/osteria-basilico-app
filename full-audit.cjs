const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const VIEWPORTS = [
  {
    name: 'mobile',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
  },
  {
    name: 'desktop',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
];

// Tab labels as they appear in the Italian UI
const TABS = [
  { name: '02-panoramica', label: 'Panoramica', scrollDown: true },
  { name: '03-turni',      label: 'Turni',      scrollDown: true },
  { name: '04-presenze',   label: 'Presenze',   scrollDown: true },
  { name: '05-ferie',      label: 'Ferie',      scrollDown: true },
  { name: '06-profilo',    label: 'Profilo',    scrollDown: true },
];

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const outputDir = './full-audit';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  // Detect port
  const ports = [5173, 3000, 4000, 8080];
  let baseUrl = null;
  const testCtx = await browser.newContext();
  const testPage = await testCtx.newPage();
  for (const port of ports) {
    try {
      const resp = await testPage.goto(`http://localhost:${port}`, { timeout: 4000 });
      if (resp && resp.ok()) { baseUrl = `http://localhost:${port}`; break; }
    } catch {}
  }
  await testCtx.close();

  if (!baseUrl) {
    console.log('❌ App not running. Start with: npm run dev');
    await browser.close();
    return;
  }
  console.log(`✅ App found at ${baseUrl}`);

  for (const device of VIEWPORTS) {
    console.log(`\n📱 Starting ${device.name.toUpperCase()} audit...`);

    const context = await browser.newContext({
      viewport: device.viewport,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
      userAgent: device.userAgent,
      storageState: fs.existsSync('./auth-state.json') ? './auth-state.json' : undefined
    });

    const page = await context.newPage();
    const deviceDir = path.join(outputDir, device.name);
    if (!fs.existsSync(deviceDir)) fs.mkdirSync(deviceDir, { recursive: true });

    const shot = async (name, delay = 1500) => {
      await page.waitForTimeout(delay);
      await page.screenshot({ path: path.join(deviceDir, `${name}.png`), fullPage: true });
      console.log(`  ✓ ${name}.png`);
    };

    const clickTab = async (label) => {
      // Try different selectors for the tab
      const selectors = [
        `button:has-text("${label}")`,
        `[role="tab"]:has-text("${label}")`,
        `nav >> text="${label}"`,
        `text="${label}"`,
      ];
      for (const sel of selectors) {
        try {
          const el = page.locator(sel).first();
          if (await el.isVisible({ timeout: 1500 })) {
            await el.click();
            await page.waitForTimeout(800);
            return true;
          }
        } catch {}
      }
      console.log(`  ⚠️ Tab "${label}" not found`);
      return false;
    };

    // Step 1: Go to splash
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await shot('01-splash', 2000);

    // Step 2: Manual login pause
    console.log(`\n🔐 LOGIN MANUALLY for ${device.name.toUpperCase()}`);
    console.log('   Press Resume in Playwright Inspector after login...');
    await page.pause();

    // Save auth after first device
    if (device.name === 'mobile') {
      await context.storageState({ path: './auth-state.json' });
      console.log('  ✓ Auth state saved');
    }

    // Step 3: Capture each tab
    for (const tab of TABS) {
      try {
        const clicked = await clickTab(tab.label);
        if (!clicked && tab.label === 'Panoramica') {
          // Already on home
        }
        await shot(tab.name);

        if (tab.scrollDown) {
          await page.evaluate(() => window.scrollTo(0, 600));
          await shot(`${tab.name}-scroll`, 600);
          await page.evaluate(() => window.scrollTo(0, 0));
        }
      } catch (e) {
        console.log(`  ⚠️ ${tab.name}: ${e.message}`);
      }
    }

    // Step 4: Presenze → Statistiche sub-tab
    try {
      await clickTab('Presenze');
      await page.waitForTimeout(1000);
      const statsSelectors = ['button:has-text("Statistiche")', 'button:has-text("Stats")', '[data-tab="stats"]'];
      for (const sel of statsSelectors) {
        try {
          const el = page.locator(sel).first();
          if (await el.isVisible({ timeout: 1500 })) {
            await el.click();
            await shot('04b-statistiche', 1000);
            break;
          }
        } catch {}
      }
    } catch {}

    // Step 5: Try to open a shift card modal on Turni
    try {
      await clickTab('Turni');
      await page.waitForTimeout(1500);
      // Try clicking on first shift card
      const shiftSelectors = [
        '[class*="border-l-blue"]',
        '[class*="border-l-emerald"]',
        '[class*="border-l-amber"]',
        'button[class*="border-l-"]',
      ];
      for (const sel of shiftSelectors) {
        try {
          const el = page.locator(sel).first();
          if (await el.isVisible({ timeout: 1000 })) {
            await el.click();
            await shot('07-turni-modal', 1200);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
            break;
          }
        } catch {}
      }
    } catch {}

    // Step 6: Profilo bottom section
    try {
      await clickTab('Profilo');
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, 1000));
      await shot('06b-profilo-bottom', 800);
      await page.evaluate(() => window.scrollTo(0, 0));
    } catch {}

    await context.close();
    console.log(`\n✅ ${device.name.toUpperCase()} complete → ${deviceDir}`);
  }

  await browser.close();

  // Generate report
  const report = generateReport(outputDir);
  fs.writeFileSync('./FULL-VISUAL-AUDIT.md', report);
  console.log('\n📄 Report: ./FULL-VISUAL-AUDIT.md');
  console.log('📁 Mobile screenshots: ./full-audit/mobile/');
  console.log('📁 Desktop screenshots: ./full-audit/desktop/');
})();

function generateReport(outputDir) {
  const devices = ['mobile', 'desktop'];
  let md = '# Full Visual Audit Report\n\n';
  md += `Generated: ${new Date().toLocaleString('it-IT')}\n\n---\n\n`;

  for (const device of devices) {
    md += `## ${device.toUpperCase()}\n\n`;
    const dir = path.join(outputDir, device);
    if (fs.existsSync(dir)) {
      const allFiles = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
      const mainFiles = allFiles.filter(f => !f.includes('scroll'));
      md += `**Screenshots:** ${allFiles.length} total\n\n`;
      md += '| Screen | BG Uniforme | Testo Visibile | Card OK | Layout OK | Note |\n';
      md += '|--------|-------------|----------------|---------|-----------|------|\n';
      mainFiles.forEach(f => {
        md += `| ${f.replace('.png', '')} | ❓ | ❓ | ❓ | ❓ | |\n`;
      });
    }
    md += '\n';
  }

  md += '---\n\n## Issues Found\n\n';
  md += '| # | Screen | Device | File | Issue | Severity |\n';
  md += '|---|--------|--------|------|-------|----------|\n';
  md += '| 1 | | | | | 🔴/🟠/🟡 |\n\n';
  md += '---\n\n## Fix Priority\n\n### 🔴 Critical\n-\n\n### 🟠 High\n-\n\n### 🟡 Medium\n-\n';

  return md;
}
