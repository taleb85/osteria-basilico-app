/**
 * DOM Inspector for Dark Theme Compliance
 * Analyzes the running app's DOM for contrast and styling issues
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';

async function inspectDarkThemeCompliance(page) {
  console.log('\n🔍 Analyzing Dark Theme Compliance...\n');
  
  const issues = await page.evaluate(() => {
    const issues = [];
    
    // Check 1: Elements with dark text that might be invisible
    const darkTextElements = document.querySelectorAll(
      '.text-slate-900, .text-slate-800, .text-black, [class*="text-gray-9"]'
    );
    
    darkTextElements.forEach((el) => {
      const computed = window.getComputedStyle(el);
      const bgColor = computed.backgroundColor;
      const color = computed.color;
      const text = el.textContent?.trim().slice(0, 50);
      
      // Check if background is dark
      if (bgColor && (bgColor.includes('10, 22, 40') || bgColor.includes('11, 34, 64'))) {
        issues.push({
          type: 'DARK_TEXT_ON_DARK_BG',
          severity: 'HIGH',
          element: el.tagName + (el.className ? '.' + el.className.split(' ')[0] : ''),
          text: text,
          color: color,
          background: bgColor,
        });
      }
    });
    
    // Check 2: White backgrounds that should be dark
    const whiteBackgrounds = document.querySelectorAll(
      '.bg-white, [style*="background: white"], [style*="background: #fff"]'
    );
    
    whiteBackgrounds.forEach((el) => {
      // Exclude modals and certain UI elements that should be white
      if (!el.closest('.modal-glass-panel') && !el.closest('input') && !el.closest('button')) {
        issues.push({
          type: 'WHITE_BACKGROUND',
          severity: 'MEDIUM',
          element: el.tagName + '.' + (el.className?.split(' ')[0] || ''),
          classes: el.className,
        });
      }
    });
    
    // Check 3: Form inputs without dark styling
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea, select');
    
    inputs.forEach((el) => {
      const computed = window.getComputedStyle(el);
      const bg = computed.backgroundColor;
      const color = computed.color;
      
      // Should have rgba(255,255,255,0.08) background
      if (!bg.includes('255, 255, 255') || color.includes('0, 0, 0') || color.includes('26, 26, 26')) {
        issues.push({
          type: 'INPUT_NOT_DARK',
          severity: 'HIGH',
          element: el.tagName + '[' + (el.getAttribute('type') || 'text') + ']',
          background: bg,
          color: color,
          placeholder: el.getAttribute('placeholder'),
        });
      }
    });
    
    // Check 4: Toolbar buttons with invisible text
    const toolbarButtons = document.querySelectorAll('.ui-toolbar-chip, .ui-toolbar-tab, [class*="ui-toolbar"] button');
    
    toolbarButtons.forEach((el) => {
      const computed = window.getComputedStyle(el);
      const color = computed.color;
      const text = el.textContent?.trim();
      
      // Should have rgba(255,255,255,0.85) or similar
      if (text && (color.includes('100, 116, 139') || color.includes('71, 85, 105'))) {
        issues.push({
          type: 'TOOLBAR_DARK_TEXT',
          severity: 'HIGH',
          text: text,
          color: color,
        });
      }
    });
    
    // Check 5: Table cells and headers
    const tableHeaders = document.querySelectorAll('thead th, thead td');
    tableHeaders.forEach((el) => {
      const computed = window.getComputedStyle(el);
      const color = computed.color;
      
      if (color.includes('148, 163, 184') || color.includes('100, 116, 139')) {
        issues.push({
          type: 'TABLE_HEADER_DARK',
          severity: 'MEDIUM',
          text: el.textContent?.trim().slice(0, 30),
          color: color,
        });
      }
    });
    
    // Check 6: Surface-glass cards
    const glassCards = document.querySelectorAll('.surface-glass, .shift-card-ultra');
    glassCards.forEach((el) => {
      const computed = window.getComputedStyle(el);
      const bg = computed.backgroundColor;
      
      // Should NOT be white or very light
      if (bg.includes('255, 255, 255, 0.9') || bg === 'rgb(255, 255, 255)') {
        issues.push({
          type: 'GLASS_CARD_TOO_LIGHT',
          severity: 'MEDIUM',
          className: el.className,
          background: bg,
        });
      }
    });
    
    return issues;
  });
  
  return issues;
}

function generateIssueReport(issues) {
  const byType = issues.reduce((acc, issue) => {
    acc[issue.type] = acc[issue.type] || [];
    acc[issue.type].push(issue);
    return acc;
  }, {});
  
  const bySeverity = {
    HIGH: issues.filter(i => i.severity === 'HIGH'),
    MEDIUM: issues.filter(i => i.severity === 'MEDIUM'),
    LOW: issues.filter(i => i.severity === 'LOW'),
  };
  
  let report = `# UI Dark Theme Compliance Report
**Generated**: ${new Date().toISOString()}
**Method**: Live DOM Inspection
**Total Issues**: ${issues.length}

---

## Summary by Severity

- 🔴 **HIGH**: ${bySeverity.HIGH.length} issues
- ⚠️ **MEDIUM**: ${bySeverity.MEDIUM.length} issues  
- 🟡 **LOW**: ${bySeverity.LOW.length} issues

---

## Issues by Type

`;

  Object.entries(byType).forEach(([type, items]) => {
    report += `\n### ${type.replace(/_/g, ' ')}\n`;
    report += `**Count**: ${items.length}\n\n`;
    
    items.slice(0, 10).forEach((issue, i) => {
      report += `${i + 1}. **${issue.element || issue.text || 'Element'}**\n`;
      if (issue.severity) report += `   - Severity: ${issue.severity}\n`;
      if (issue.color) report += `   - Color: \`${issue.color}\`\n`;
      if (issue.background) report += `   - Background: \`${issue.background}\`\n`;
      if (issue.classes) report += `   - Classes: \`${issue.classes}\`\n`;
      report += '\n';
    });
    
    if (items.length > 10) {
      report += `   *...and ${items.length - 10} more*\n\n`;
    }
  });
  
  report += `\n---

## Recommended Fixes

### For DARK_TEXT_ON_DARK_BG issues:
Add CSS override:
\`\`\`css
.text-slate-900, .text-slate-800, .text-black {
  color: #ffffff !important;
}
\`\`\`

### For WHITE_BACKGROUND issues:
Replace with:
\`\`\`css
background: var(--bg-surface);
backdrop-filter: blur(12px);
\`\`\`

### For INPUT_NOT_DARK issues:
Verify global input styles have !important:
\`\`\`css
input, textarea {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #ffffff !important;
}
\`\`\`

### For TOOLBAR_DARK_TEXT issues:
Add:
\`\`\`css
.ui-toolbar-chip, .ui-toolbar-tab {
  color: rgba(255, 255, 255, 0.85) !important;
}
\`\`\`

---

*Run this script while logged into the app for real-time analysis*
`;

  return report;
}

async function main() {
  console.log('🚀 Starting DOM Inspector');
  console.log('━'.repeat(60));
  console.log('\n⚠️  Make sure you are logged into the app at http://localhost:5173\n');
  console.log('Press ENTER when ready to analyze...');
  
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });
  
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(3000);
    
    const issues = await inspectDarkThemeCompliance(page);
    
    console.log('\n━'.repeat(60));
    console.log(`\n✅ Analysis complete: ${issues.length} potential issues found\n`);
    
    const report = generateIssueReport(issues);
    writeFileSync('ui-compliance-report.md', report);
    
    console.log('📄 Report saved: ui-compliance-report.md\n');
    
    // Console output summary
    console.log('Issue Summary:');
    console.log(`  🔴 HIGH:   ${issues.filter(i => i.severity === 'HIGH').length}`);
    console.log(`  ⚠️  MEDIUM: ${issues.filter(i => i.severity === 'MEDIUM').length}`);
    console.log(`  🟡 LOW:    ${issues.filter(i => i.severity === 'LOW').length}`);
    console.log('');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
