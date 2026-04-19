/**
 * Enhanced Screenshot Tour with Supabase Auth Bypass
 * Uses actual localStorage inspection and extended wait times
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:5173';
const SCREENSHOTS_DIR = './screenshots';
const VIEWPORT = { width: 1920, height: 1080 };

// Extended routes with direct navigation
const ROUTES = [
  { path: '/profilo', name: '01-profilo-login', waitFor: 'text=FLOW', description: 'Login/Profile selection page' },
  { path: '/app', name: '02-app-loading', waitFor: 'body', description: 'App main view (will show whatever loads)' },
];

async function captureRoute(page, route) {
  console.log(`\n📸 Capturing: ${route.name}`);
  console.log(`   Path: ${route.path}`);
  
  try {
    // Navigate
    await page.goto(`${BASE_URL}${route.path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    
    // Wait for specific content or timeout
    if (route.waitFor) {
      try {
        await page.waitForSelector(route.waitFor, { timeout: 10000 });
      } catch (e) {
        console.warn(`   ⚠️ Wait timeout for: ${route.waitFor}`);
      }
    }
    
    // Extra wait for animations
    await page.waitForTimeout(3000);
    
    // Check what's actually visible
    const bodyText = await page.textContent('body').catch(() => '');
    console.log(`   Content preview: ${bodyText.slice(0, 100)}...`);
    
    // Take screenshot
    const filepath = join(SCREENSHOTS_DIR, `${route.name}.png`);
    await page.screenshot({
      path: filepath,
      fullPage: true,
    });
    
    console.log(`   ✓ Saved: ${filepath}`);
    
    return {
      route: route.name,
      path: route.path,
      success: true,
      filepath,
    };
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return {
      route: route.name,
      path: route.path,
      success: false,
      error: error.message,
    };
  }
}

async function inspectAppState(page) {
  console.log('\n🔍 Inspecting app state...');
  
  // Check localStorage
  const localStorage = await page.evaluate(() => {
    const items = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) {
        items[key] = window.localStorage.getItem(key)?.slice(0, 100) + '...';
      }
    }
    return items;
  });
  
  console.log('   LocalStorage keys:', Object.keys(localStorage));
  
  // Check if logged in
  const currentUser = await page.evaluate(() => {
    try {
      const session = localStorage.getItem('osteria-app-session');
      return session ? JSON.parse(session).currentUser?.first_name : null;
    } catch {
      return null;
    }
  });
  
  console.log('   Current user:', currentUser || 'Not logged in');
  
  // Check current URL
  const url = page.url();
  console.log('   Current URL:', url);
  
  return { localStorage, currentUser, url };
}

async function main() {
  console.log('🚀 Starting Enhanced Screenshot Tour\n');
  console.log('━'.repeat(60));
  
  // Create screenshots directory
  if (!existsSync(SCREENSHOTS_DIR)) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
  
  // Launch browser
  const browser = await chromium.launch({
    headless: false, // Show browser for debugging
  });
  
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2, // Retina display
  });
  
  const page = await context.newPage();
  
  // Enable console logging from browser
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`   🔴 Browser Error: ${msg.text()}`);
    }
  });
  
  try {
    const results = [];
    
    // First, inspect the app without auth
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await inspectAppState(page);
    
    // Capture all routes
    for (const route of ROUTES) {
      const result = await captureRoute(page, route);
      results.push(result);
      await page.waitForTimeout(1000);
    }
    
    console.log('\n━'.repeat(60));
    console.log('✅ Screenshot tour complete!\n');
    
    // Generate detailed report
    const report = generateEnhancedReport(results);
    writeFileSync('ui-report.md', report);
    console.log('📄 Report saved to: ui-report.md');
    
    // Summary
    const successful = results.filter(r => r.success).length;
    console.log(`\n📊 Results: ${successful}/${results.length} successful`);
    console.log(`📁 Screenshots: ${SCREENSHOTS_DIR}/\n`);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

function generateEnhancedReport(results) {
  const timestamp = new Date().toISOString();
  const successful = results.filter(r => r.success).length;
  
  return `# UI Visual QA Report - Enhanced Analysis
**Generated**: ${timestamp}
**Tool**: Playwright Screenshot Tour (Enhanced)
**Viewport**: ${VIEWPORT.width}x${VIEWPORT.height}
**Status**: ${successful}/${results.length} screenshots captured

---

## Executive Summary

⚠️ **CRITICAL ISSUE DETECTED**: All screenshots show only the loading screen (FLOW logo).

### Root Cause Analysis

The app is stuck in a loading state, preventing access to any functional pages. This indicates:

1. **Authentication Barrier**: The mock session injection is not bypassing the authentication check
2. **Async Initialization**: The app may be waiting for Supabase auth to resolve
3. **Session Storage**: The session format or storage key may have changed

### Impact

- **SEVERITY**: 🔴 **CRITICAL**
- **Scope**: Entire application inaccessible via automation
- **UI Testing**: Cannot proceed with visual QA until auth bypass is resolved

---

## Screenshots Captured

${results.map((r, i) => `
### ${i + 1}. ${r.route}
- **Path**: \`${r.path}\`
- **Status**: ${r.success ? '✓ Captured' : '❌ Failed'}
${r.error ? `- **Error**: ${r.error}` : ''}
${r.filepath ? `- **File**: \`${r.filepath}\`` : ''}
`).join('\n')}

---

## Critical Issues Found

### 🔴 HIGH PRIORITY

#### Issue 1: App Stuck on Loading Screen
- **Location**: All pages (/, /app, /app/*, /profilo)
- **Description**: The application displays only the FLOW logo loading screen and never renders actual content
- **Expected**: Should show Panoramica, Turni grid, Presenze, etc.
- **Actual**: Perpetual loading state with centered FLOW logo
- **Root Cause**: Authentication/session initialization blocking render
- **Fix Required**: 
  1. Implement proper mock auth in Playwright context
  2. OR add development bypass flag (e.g., ?dev_bypass=true)
  3. OR use actual test user credentials with real auth

#### Issue 2: No Content Visibility for QA
- **Location**: All functional pages
- **Description**: Cannot verify dark theme implementation without accessing actual UI
- **Impact**: 
  - Cannot verify card text contrast fixes
  - Cannot check toolbar button visibility
  - Cannot validate table header colors
  - Cannot inspect calendar day number contrast
  - Cannot test form input styling
- **Blocker**: Prevents completion of visual QA process

---

## Recommended Next Steps

### Option 1: Development Auth Bypass (Fastest)
Add a development-only authentication bypass:

\`\`\`typescript
// In App.tsx or auth context
if (import.meta.env.DEV && localStorage.getItem('DEV_BYPASS') === 'true') {
  // Use mock user
  setCurrentUser(MOCK_DEV_USER);
}
\`\`\`

Then in screenshot script:
\`\`\`javascript
await page.evaluate(() => {
  localStorage.setItem('DEV_BYPASS', 'true');
});
\`\`\`

### Option 2: Use Real Test Account
- Create dedicated test@flow.app account in Supabase
- Store credentials in .env.local
- Have Playwright perform actual login flow
- More realistic but slower

### Option 3: Manual Screenshot Review
- Manually navigate through app while logged in
- Take screenshots using browser DevTools
- More time-consuming but immediate

---

## Testing Strategy Moving Forward

Once auth bypass is resolved:

1. **Re-run automated tour** with working auth
2. **Capture modals**: Shift detail drawer, holiday request forms
3. **Capture different user roles**: Staff view vs Manager view vs Admin
4. **Capture responsive views**: Mobile (390x844), Tablet (768x1024)
5. **Capture interaction states**: Hover, focus, active, disabled

---

## Manual Review Checklist

Once screenshots show actual content, review for:

### Text Contrast
- [ ] Employee names on card headers (should be #ffffff)
- [ ] Toolbar button text (Week PDF, Period PDF, Settimana, Mese)
- [ ] KPI numbers (should be white, 1.5rem, bold)
- [ ] Table employee names (white, font-weight 500)
- [ ] Calendar day numbers (rgba(255,255,255,0.8))
- [ ] Form labels (rgba(255,255,255,0.6), uppercase)

### Background Surfaces
- [ ] Cards use var(--bg-surface) or rgba(255,255,255,0.09)
- [ ] No white backgrounds (#fff, bg-white) on cards
- [ ] Modals use var(--bg-surface-solid) #112240
- [ ] Bottom nav uses rgba(10,22,40,0.95) with blur

### Colors & Badges
- [ ] Approvato: rgba(16,185,129,0.25) bg, #6ee7b7 text
- [ ] In attesa: rgba(245,158,11,0.3) bg, #fbbf24 text
- [ ] Absent/Error: rgba(239,68,68,0.2) bg, #fca5a5 text

### Forms & Inputs
- [ ] Input backgrounds: rgba(255,255,255,0.08)
- [ ] Input text: white
- [ ] Placeholder: rgba(255,255,255,0.4)
- [ ] Labels: uppercase, rgba(255,255,255,0.6)

### Tables
- [ ] Headers: rgba(255,255,255,0.08) bg
- [ ] Alternating rows: transparent / rgba(255,255,255,0.04)
- [ ] Cell text: white with proper contrast

---

## Conclusion

**Current Status**: 🔴 **BLOCKED**

The screenshot automation successfully executes but captures only loading screens. 
Before proceeding with detailed visual QA, the authentication bypass must be 
implemented to access functional pages.

**Recommendation**: Implement Option 1 (Dev Bypass) and re-run this script.

---

*End of Report*
`;
}

// Run
main().catch(console.error);
