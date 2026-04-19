/**
 * Screenshot Tour Automation
 * Captures full-page screenshots of all app routes for visual QA
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:5173';
const SCREENSHOTS_DIR = './screenshots';
const VIEWPORT = { width: 1920, height: 1080 };

// Mock session to bypass login
const MOCK_SESSION = {
  currentUser: {
    id: 'mock-admin-001',
    first_name: 'Admin',
    last_name: 'Test',
    email: 'admin@test.com',
    role: 'admin',
    department: 'Sala',
    created_at: '2026-01-01T00:00:00Z',
  },
  tenantId: 'osteria-basilico',
};

// Routes to capture
const ROUTES = [
  { path: '/app', name: '01-panoramica-home', tab: 'home' },
  { path: '/app', name: '02-turni-grid', tab: 'turni' },
  { path: '/app', name: '03-presenze-timesheet', tab: 'timesheet' },
  { path: '/app', name: '04-statistiche', tab: 'timesheet', subtab: 'stats' },
  { path: '/app', name: '05-ferie-permessi', tab: 'ferie' },
  { path: '/profilo', name: '06-profilo-login', noAuth: true },
];

async function setupAuthSession(page) {
  // Set localStorage to mock authenticated session
  await page.addInitScript((session) => {
    localStorage.setItem('osteria-app-session', JSON.stringify(session));
    localStorage.setItem('osteria-current-user', JSON.stringify(session.currentUser));
  }, MOCK_SESSION);
}

async function navigateToTab(page, tab, subtab = null) {
  // Click on bottom nav or trigger tab change
  if (tab) {
    // Try to find and click the tab button
    const tabSelectors = {
      home: '[aria-label*="Home"], [aria-label*="Panoramica"], button[class*="bottom-nav"] >> nth=0',
      turni: '[aria-label*="Turni"], button:has-text("Turni")',
      timesheet: '[aria-label*="Presenze"], button:has-text("Presenze")',
      ferie: '[aria-label*="Ferie"], button:has-text("Ferie")',
    };
    
    try {
      const selector = tabSelectors[tab];
      if (selector) {
        await page.click(selector, { timeout: 5000 });
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      console.warn(`Could not click tab ${tab}: ${e.message}`);
    }
  }
  
  if (subtab === 'stats') {
    // Try to click statistics sub-tab
    try {
      await page.click('button:has-text("Statistiche")', { timeout: 3000 });
      await page.waitForTimeout(1000);
    } catch (e) {
      console.warn('Could not click Statistiche subtab');
    }
  }
}

async function takeScreenshot(page, route) {
  const filepath = join(SCREENSHOTS_DIR, `${route.name}.png`);
  
  // Wait for content to load
  await page.waitForTimeout(2000);
  
  // Take full-page screenshot
  await page.screenshot({
    path: filepath,
    fullPage: true,
  });
  
  console.log(`✓ Captured: ${route.name}`);
  return filepath;
}

async function analyzeScreenshot(filepath, route) {
  // Basic automated checks (we'll do manual review too)
  const issues = [];
  
  // These are placeholder checks - real analysis happens in report generation
  issues.push({
    page: route.name,
    severity: 'INFO',
    description: 'Screenshot captured successfully',
  });
  
  return issues;
}

async function main() {
  console.log('🚀 Starting screenshot tour...\n');
  
  // Create screenshots directory
  if (!existsSync(SCREENSHOTS_DIR)) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
  
  // Launch browser
  const browser = await chromium.launch({
    headless: true,
  });
  
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  
  const page = await context.newPage();
  
  try {
    const allIssues = [];
    
    for (const route of ROUTES) {
      console.log(`📸 Capturing: ${route.name}...`);
      
      // Setup auth unless it's a no-auth route
      if (!route.noAuth) {
        await setupAuthSession(page);
      }
      
      // Navigate to page
      await page.goto(`${BASE_URL}${route.path}`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      
      // Navigate to specific tab if needed
      if (route.tab) {
        await navigateToTab(page, route.tab, route.subtab);
      }
      
      // Take screenshot
      const filepath = await takeScreenshot(page, route);
      
      // Analyze
      const issues = await analyzeScreenshot(filepath, route);
      allIssues.push(...issues);
    }
    
    console.log('\n✅ Screenshot tour complete!');
    console.log(`📁 Screenshots saved to: ${SCREENSHOTS_DIR}/`);
    
    // Generate report
    const report = generateReport(allIssues);
    writeFileSync('ui-report.md', report);
    console.log('📄 Report saved to: ui-report.md\n');
    
  } catch (error) {
    console.error('❌ Error during screenshot tour:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

function generateReport(issues) {
  const timestamp = new Date().toISOString();
  
  return `# UI Visual QA Report
**Generated**: ${timestamp}
**Tool**: Playwright Screenshot Tour
**Viewport**: ${VIEWPORT.width}x${VIEWPORT.height}

---

## Summary

Total screenshots captured: ${ROUTES.length}
Total automated checks: ${issues.length}

---

## Pages Captured

${ROUTES.map((r, i) => `${i + 1}. **${r.name}** - \`${r.path}\``).join('\n')}

---

## Manual Review Required

⚠️ **IMPORTANT**: This report requires manual visual inspection of screenshots.
The automated script has captured all pages - now review each screenshot in the \`/screenshots\` folder.

### Checklist for Manual Review

For each screenshot, check:

- [ ] Text contrast (white text on dark bg, dark text on light surfaces)
- [ ] Button visibility (toolbar buttons, action buttons)
- [ ] Card backgrounds (should use dark theme surfaces)
- [ ] Form inputs (should have dark backgrounds with white text)
- [ ] Table headers and cells (proper contrast)
- [ ] Calendar day numbers (visible on dark background)
- [ ] Modal overlays (proper backdrop and content visibility)
- [ ] Navigation bars (top and bottom nav)
- [ ] Icon visibility
- [ ] Badge colors and text
- [ ] Overlapping elements
- [ ] Layout alignment issues

---

## Automated Checks Results

${issues.map(issue => `
### ${issue.page}
- **Severity**: ${issue.severity}
- **Issue**: ${issue.description}
`).join('\n')}

---

## Next Steps

1. Open each screenshot in \`/screenshots/\` folder
2. Compare against dark theme requirements
3. Document specific issues found
4. Prioritize fixes by severity
5. Create follow-up tasks for each issue

## Known Areas to Review Carefully

Based on recent dark theme implementation:

1. **Employee name cards** - Check white text visibility on semi-transparent surfaces
2. **Toolbar buttons** - "Settimana", "Mese", "Week PDF", "Period PDF" text
3. **KPI stat cards** - Numbers and labels on Panoramica/Presenze
4. **Calendar** - Day numbers, especially non-current month days
5. **Form inputs** - Profile page inputs should have dark bg with white text
6. **Table grids** - Employee names, column headers, shift cells
7. **Modal dialogs** - Shift detail modal text contrast
8. **Bottom navigation** - Icon and text visibility

---

*End of Report*
`;
}

// Run the tour
main().catch(console.error);
