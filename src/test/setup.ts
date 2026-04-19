import '@testing-library/jest-dom/vitest';

// Mock env vars per test
Object.defineProperty(import.meta, 'env', {
  value: {
    DEV: true,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    VITE_ALLOW_BROWSER_APP: 'false',
  },
  writable: true,
});
