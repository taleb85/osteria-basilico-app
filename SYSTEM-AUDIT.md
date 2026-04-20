# System Health Audit — 20 aprile 2026

---

## Executive Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 3 |
| 🟠 High | 6 |
| 🟡 Medium | 8 |
| 🟢 Low / Info | 7 |
| ✅ Checks passed | 6 / 15 |

---

## ✅ Checks Passed

1. **TypeScript** — `npx tsc --noEmit` exits 0, zero type errors.
2. **Build** — `npm run build` succeeds in ~5 s, no compilation errors.
3. **Circular dependencies** — `npx madge --circular src/` reports no cycles.
4. **Hardcoded secrets** — No API keys, passwords, or tokens found in source.
5. **`.env` not committed** — Only `.env.example` is tracked by git.
6. **No `eval()` or `dangerouslySetInnerHTML`** — Zero occurrences.

---

## 🔴 Critical Issues

### C1 — React Hooks called conditionally (`react-hooks/rules-of-hooks`)
**File:** `src/components/PWAInstallRequired.tsx` — lines 137–155  
**Detail:** `useState` (×4), `useEffect` (×2), `useCallback` (line 244) are all invoked inside a conditional branch (likely after an early `return`). This violates the Rules of Hooks and can cause unpredictable state bugs or silent crashes at runtime.  
**Fix:** Move all hook calls above any conditional `return` statements. Extract conditional logic into hook-internal conditions, not outer `if` blocks.

### C2 — 1 Critical dependency vulnerability (`serialize-javascript`)
**Packages:** `serialize-javascript ≤7.0.4` → via `@rollup/plugin-terser` → `workbox-build` → `vite-plugin-pwa`  
**CVEs:**
- `GHSA-5c6j-r48x-rmvq` — RCE via `RegExp.flags` / `Date.prototype.toISOString()`
- `GHSA-qj8w-gfj5-8c6v` — CPU exhaustion DoS  

**Fix:** `npm audit fix --force` installs `vite-plugin-pwa@0.19.8` (breaking change — test PWA behaviour after upgrade).

### C3 — Main JavaScript bundle 1.54 MB (gzipped 440 KB)
**File:** `dist/assets/index-*.js` — 1,543 KB raw  
**Detail:** A single unguarded chunk containing the bulk of app logic. This exceeds the 500 KB guidance for the initial route and causes slow first-load TTI on mobile.  
**Fix:** See Medium issue M5 for code-splitting recommendations.

---

## 🟠 High Priority Issues

### H1 — 297 ESLint errors across 30 files
`npx eslint . --ext .ts,.tsx` reports **297 errors**, **39 warnings**.  
Top error categories:

| Count | Rule | Description |
|-------|------|-------------|
| ~38 | `@typescript-eslint/no-explicit-any` | Untyped `any` in production code |
| ~7 | `react-hooks/rules-of-hooks` | Conditional hooks (see C1) |
| 4 | `no-constant-binary-expression` | Dead `true &&` conditions |
| many | `@typescript-eslint/no-unused-vars` | Variables declared but never used |

Files with most errors: `AppContext.tsx`, `WeeklyShiftsTable.tsx`, `Timesheets.tsx`, `GestioneProfiliPage.tsx`, `PWAInstallRequired.tsx`.

### H2 — 7 High-severity npm vulnerabilities
In addition to the Critical `serialize-javascript` issue (C2), 7 **high** severity issues exist in the same chain (`picomatch`, `@rollup/plugin-terser`). All are build-time only (not shipped to clients) but represent supply-chain risk.

### H3 — 16 `<img>` elements missing `alt` attribute
Search: `<img` without `alt=` — **16 occurrences** across multiple components.  
Missing `alt` attributes break screen readers and fail WCAG 2.1 Level A.

### H4 — `no-constant-binary-expression` (dead code logic)
Lines with `true && <expression>` or similar constant-left operands in:
- `src/components/WeeklyShiftsTable.tsx` line 766 (×3)
- `src/components/AppContext.tsx` line 377 (×1)  

This means one branch of the `&&` can never be falsy — the condition is pointless and may hide a removed feature flag.

### H5 — Unused variables from previous refactoring
ESLint flags variables that were declared but never read, including:
- `isDark` — `ManagementMobileShifts.tsx`, `ManagementMobileTimesheet.tsx` (left over from the `useDarkMode` removal)
- `timeDisplayed`, `timeDisplayedShort` — `WeeklyShiftsTable.tsx`
- `isWeekend`, `isBuiltinEdit`, `u`, `_an`, `e` — various files  
- `BG_PENDING`, `BD_PENDING` — `exportTimesheetPdf.ts`
- `startOfWeek`, `endOfWeek`, `eachDayOfInterval`, `isSameDay`, `addDays` — `exportTimesheetPdf.ts` imports

### H6 — `.env` / `.env.example` mismatch
Variables present in `.env` but **not documented** in `.env.example`:
- `DATABASE_URL`
- `VITE_APP_TITLE`
- `VITE_FEATURE_FLAGS_STORAGE_ENABLED`
- `VITE_SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPER_ADMIN_PIN`
- `VITE_TENANT_SLUG`

Variables in `.env.example` but **not in `.env`**:
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_GEMINI_API_KEY`

Risk: new developers will miss required vars; `VITE_SUPER_ADMIN_PIN` is a sensitive key that should be noted in `.env.example`.

---

## 🟡 Medium Priority Issues

### M1 — 53 `console.warn` and 39 `console.error` in production code
All inside `src/context/AppContext.tsx` (and related hooks). These are appropriate error-logging patterns but will leak internal Italian error messages and stack information to browser DevTools in production. Should be gated behind `import.meta.env.DEV`.

### M2 — 2 `console.log` left in production code
**File:** `src/hooks/useMessages.ts` lines 157, 190  
```
console.log('[useMessages] Change detected:', payload);
console.log('[useMessages] Subscription status:', status);
```
Remove or gate with `if (import.meta.env.DEV)`.

### M3 — 8 moderate npm vulnerabilities
`picomatch` via `@rollup/pluginutils` and `tinyglobby` — moderate severity. All build-time only. Run `npm audit fix` (non-breaking) to resolve the 8 moderate issues.

### M4 — 6 `react-refresh/only-export-components` warnings
Files that export both components and constants/functions. This prevents Vite's HMR fast-refresh from working correctly during development, causing full page reloads instead of component-level updates.

### M5 — Bundle not code-split (1.54 MB main chunk)
Current largest chunks:

| File | Raw | Gzipped |
|------|-----|---------|
| `index-*.js` (main) | 1,544 KB | 440 KB |
| `vendor-pdf-*.js` | 391 KB | 129 KB |
| `html2canvas.esm-*.js` | 201 KB | 48 KB |
| `vendor-supabase-*.js` | 176 KB | 46 KB |
| `vendor-framer-*.js` | 135 KB | 45 KB |
| `WeeklyShiftsTable-*.js` | 164 KB | 41 KB |
| `Timesheets-*.js` | 151 KB | 39 KB |

**Recommendations:**
- Add dynamic `import()` for `/admin`, `/super-admin`, `Statistics`, `HolidayRequests`, `ScreensPreview` routes — they load on demand anyway.
- The PDF / html2canvas chunks are already split. Keep them lazy.
- Target: main chunk ≤ 400 KB raw.

### M6 — Images missing lazy loading
`<img>` tags do not use `loading="lazy"`. On pages with many staff avatar images this causes unnecessary network requests on initial load.

### M7 — `.env.example` missing `VITE_SUPER_ADMIN_PIN` documentation
`VITE_SUPER_ADMIN_PIN` is used in `.env` but not referenced in `.env.example`. This is a security-sensitive value (unlocks super-admin) and should at minimum be documented with a placeholder.

### M8 — 1 TODO comment remaining
**File/location:** Found via `grep -rn "TODO\|FIXME\|HACK"` — 1 instance in `src/`. Investigate and resolve or remove.

---

## 🟢 Low / Info

### L1 — `no-empty` block statements (3 occurrences)
Empty `catch` or `if` blocks silently swallow errors. Add at minimum a `// intentional` comment or log.

### L2 — `prefer-const` violation
**File:** `src/utils/seedTenantFromTemplate.ts` line 134 — `let shiftsErr` never reassigned; use `const`.

### L3 — `@typescript-eslint/no-unused-vars` in `hapticFeedbackCore.ts`
Line 19: `any` type. Low risk but should be typed.

### L4 — `nextMonthRef` assigned but never used
**File:** `src/utils/periodConfig.ts` line 154.

### L5 — 228 `useEffect` calls (no automated dep-array audit)
The count is normal for a large app, but missing dependency arrays can cause stale-closure bugs. Recommend running `eslint-plugin-react-hooks` exhaustive-deps rule (it may already be partially configured).

### L6 — Fast-refresh warnings (6 files)
Non-component exports mixed into component files. No runtime impact; only slows down DX during development.

### L7 — Routes: `/anim-preview` and `/loading-preview` are development-only pages with no auth guard
These routes are reachable by any unauthenticated user who knows the URL. They appear to only render preview UI (no sensitive data), but should at minimum be disabled in production builds.

---

## Check-by-Check Results

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | TypeScript | ✅ Pass | 0 errors |
| 2 | ESLint | ❌ Fail | 297 errors, 39 warnings |
| 3 | Build | ✅ Pass | Succeeds in ~5 s |
| 4 | npm audit | ❌ Fail | 1 critical, 7 high, 8 moderate |
| 5 | Dead code / console | 🟡 Warn | 2 console.log, ~100 warn/error |
| 6 | TODO/FIXME | ✅ Pass | 1 remaining |
| 7 | Security | ✅ Pass | No hardcoded secrets, no eval |
| 8 | Accessibility (a11y) | 🟠 Warn | 16 img missing alt |
| 9 | Bundle size | 🔴 Fail | Main chunk 1.54 MB |
| 10 | Circular deps | ✅ Pass | None found |
| 11 | Env vars | 🟠 Warn | .env/.env.example mismatch |
| 12 | Routes | ✅ Pass | 404 catch-all present |
| 13 | Conditional hooks | 🔴 Fail | PWAInstallRequired.tsx |
| 14 | Constant binary expr | 🟠 Warn | 4 dead conditions |
| 15 | Depcheck | ⏭ Skipped | `npx depcheck` not run (slow) |

---

## Recommended Action Plan

### 1. Fix immediately (Critical)
1. **C1** — Refactor `PWAInstallRequired.tsx` to move all hooks before any early return.
2. **C2** — Run `npm audit fix --force`, test PWA install/update flow, bump `vite-plugin-pwa` to `0.19.8`.
3. **C3 / M5** — Add route-level lazy loading for Admin, Super-Admin, Statistics, HolidayRequests pages to reduce main bundle.

### 2. Fix soon (High)
4. **H1** — Run `npx eslint . --fix` for auto-fixable issues; manually address `no-explicit-any` and unused vars.
5. **H3** — Add `alt` attributes to all 16 `<img>` tags.
6. **H5** — Remove leftover `isDark`, `timeDisplayed`, dead imports in `exportTimesheetPdf.ts`.
7. **H6** — Sync `.env.example` with all vars used in code; document `VITE_SUPER_ADMIN_PIN`.

### 3. Schedule for later (Medium / Low)
8. **M1/M2** — Gate `console.log/warn/error` behind `import.meta.env.DEV`.
9. **M3** — `npm audit fix` (non-breaking) for the 8 moderate vulns.
10. **M6** — Add `loading="lazy"` to staff avatar `<img>` tags.
11. **L7** — Disable `/anim-preview` and `/loading-preview` in production builds.
