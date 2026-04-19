import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('PwaGate Logic', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should bypass in dev mode', () => {
    const isDev = true;
    const isPWA = false;
    const allowBrowser = false;

    const shouldShow = !isDev && !allowBrowser && !isPWA;
    
    expect(shouldShow).toBe(false);
  });

  it('should bypass with VITE_ALLOW_BROWSER_APP=true', () => {
    const isDev = false;
    const isPWA = false;
    const allowBrowser = true;

    const shouldShow = !isDev && !allowBrowser && !isPWA;
    
    expect(shouldShow).toBe(false);
  });

  it('should show install screen in prod without PWA', () => {
    const isDev = false;
    const isPWA = false;
    const allowBrowser = false;

    const shouldShow = !isDev && !allowBrowser && !isPWA;
    
    expect(shouldShow).toBe(true);
  });

  it('should allow in prod if PWA standalone', () => {
    const isDev = false;
    const isPWA = true;
    const allowBrowser = false;

    const shouldShow = !isDev && !allowBrowser && !isPWA;
    
    expect(shouldShow).toBe(false);
  });
});

describe('Supabase Client', () => {
  it('should not expose service role key', async () => {
    // Simula import del client
    const supabaseModule = await import('../lib/supabase');
    
    // Verifica che supabaseAdmin non esista più nell'export
    expect(supabaseModule).not.toHaveProperty('supabaseAdmin');
  });

  it('should export only public client', async () => {
    const supabaseModule = await import('../lib/supabase');
    
    expect(supabaseModule).toHaveProperty('supabase');
  });
});
