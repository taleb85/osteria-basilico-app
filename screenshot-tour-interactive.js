/**
 * Screenshot Tour with Manual Login Support
 * Opens browser in non-headless mode for manual authentication
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { readFileSync } from 'fs';

const BASE_URL = 'http://localhost:5173';
const SCREENSHOTS_DIR = './screenshots';
const VIEWPORT = { width: 1440, height: 900 };

async function waitForManualLogin(page) {
  console.log('\n⏸️  MANUAL ACTION REQUIRED:');
  console.log('   1. The browser window will open');
  console.log('   2. Please log in to the app manually');
  console.log('   3. Navigate to the main dashboard');
  console.log('   4. Press ENTER in this terminal when ready...\n');
  
  // Wait for user confirmation
  await new Promise(resolve => {
    process.stdin.once('data', () => {
      console.log('✓ Continuing with screenshot capture...\n');
      resolve(null);
    });
  });
}

async function captureCurrentView(page, name, description) {
  console.log(`📸 ${name}`);
  console.log(`   ${description}`);
  
  await page.waitForTimeout(2000);
  
  const filepath = join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({
    path: filepath,
    fullPage: true,
  });
  
  console.log(`   ✓ Saved\n`);
  
  return filepath;
}

async function analyzeScreenshot(filepath) {
  // Read and analyze the screenshot
  // For now, we'll do manual analysis
  return [];
}

async function main() {
  console.log('🚀 Interactive Screenshot Tour');
  console.log('━'.repeat(60));
  
  if (!existsSync(SCREENSHOTS_DIR)) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });
  
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate to app
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    
    // Wait for manual login
    await waitForManualLogin(page);
    
    // Now capture screenshots
    console.log('📸 Capturing screenshots...\n');
    
    const captures = [];
    
    // Capture current view (should be logged in)
    captures.push(await captureCurrentView(page, '01-current-view', 'Current view after login'));
    
    // Try to find and click bottom nav tabs
    const navButtons = await page.$$('[class*="bottom-nav"] button');
    console.log(`   Found ${navButtons.length} navigation buttons\n`);
    
    for (let i = 0; i < Math.min(navButtons.length, 5); i++) {
      try {
        await navButtons[i].click();
        await page.waitForTimeout(1500);
        captures.push(await captureCurrentView(page, `0${i + 2}-nav-tab-${i + 1}`, `Navigation tab ${i + 1}`));
      } catch (e) {
        console.warn(`   ⚠️  Could not capture tab ${i + 1}: ${e.message}\n`);
      }
    }
    
    console.log('━'.repeat(60));
    console.log(`✅ Captured ${captures.length} screenshots`);
    console.log(`📁 Location: ${SCREENSHOTS_DIR}/\n`);
    
    // Generate analysis report
    await generateAnalysisReport(captures, page);
    
    console.log('📄 Report: ui-report.md\n');
    console.log('Press ENTER to close browser and exit...');
    
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

async function generateAnalysisReport(captures, page) {
  // Analyze page structure
  const analysis = await page.evaluate(() => {
    const report = {
      title: document.title,
      url: window.location.href,
      darkElements: document.querySelectorAll('[class*="text-slate-900"], [class*="text-slate-800"], [class*="text-black"]').length,
      whiteBackgrounds: document.querySelectorAll('[class*="bg-white"]').length,
      surfaceGlass: document.querySelectorAll('.surface-glass').length,
      inputs: document.querySelectorAll('input, textarea, select').length,
      buttons: document.querySelectorAll('button').length,
      tables: document.querySelectorAll('table').length,
    };
    
    // Sample text colors
    const sampleTexts = [];
    document.querySelectorAll('h1, h2, h3, p, span').forEach((el, i) => {
      if (i < 20) {
        const style = window.getComputedStyle(el);
        sampleTexts.push({
          tag: el.tagName,
          text: el.textContent?.slice(0, 30),
          color: style.color,
          background: style.backgroundColor,
        });
      }
    });
    
    report.sampleTexts = sampleTexts;
    return report;
  });
  
  const report = `# UI Dark Theme Analysis Report
**Generated**: ${new Date().toISOString()}
**Screenshots**: ${captures.length}
**Method**: Interactive capture with manual login

---

## App Structure Analysis

- **Title**: ${analysis.title}
- **Current URL**: ${analysis.url}
- **Dark text elements**: ${analysis.darkElements} (potential contrast issues)
- **White backgrounds**: ${analysis.whiteBackgrounds} (should be dark surfaces)
- **Surface-glass cards**: ${analysis.surfaceGlass}
- **Form inputs**: ${analysis.inputs}
- **Buttons**: ${analysis.buttons}
- **Tables**: ${analysis.tables}

---

## Text Color Sampling

${analysis.sampleTexts?.slice(0, 10).map(t => 
  `- **${t.tag}**: "${t.text}" - Color: ${t.color}, BG: ${t.background}`
).join('\n')}

---

## Screenshots Captured

${captures.map((c, i) => `${i + 1}. \`${c}\``).join('\n')}

---

## Manual Review Required

Review each screenshot in \`/screenshots\` folder for:

### 🔴 HIGH Priority
- [ ] Employee names visible on shift cards
- [ ] Toolbar button text ("Settimana", "Mese", "Week PDF", "Period PDF")
- [ ] KPI numbers and labels legible
- [ ] Table employee names readable
- [ ] Calendar day numbers visible

### ⚠️ MEDIUM Priority
- [ ] Form inputs have dark backgrounds
- [ ] Modal text contrasts well
- [ ] Badge colors distinguish between states
- [ ] Secondary text (subtitles, hints) readable at 0.6 opacity

### 🟡 LOW Priority
- [ ] Icons visible at 0.5 opacity
- [ ] Hover states provide visual feedback
- [ ] Focus rings visible on inputs
- [ ] Disabled states clearly indicated

---

## Known Issues from Code Review

Based on recent commits and code analysis:

### Fixed ✅
1. Global CSS variables for dark theme
2. Bottom nav background and blur
3. Surface-glass dark backgrounds
4. Modal panels dark backgrounds
5. Form input global styling
6. Table alternating rows
7. Calendar day colors
8. HomeManagementShiftCard text contrast

### Still Needs Verification ⚠️
1. shift-time-ultra class color (#000 vs #fff)
2. Inline style overrides in components
3. text-slate-900 classes throughout app
4. Toolbar button actual visibility
5. Progress bar track backgrounds

---

*Manual screenshot review and testing required to complete this report*
`;

  writeFileSync('ui-report.md', report);
}

// Run
main().catch(console.error);
