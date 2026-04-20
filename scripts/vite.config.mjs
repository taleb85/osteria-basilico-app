/**
 * Config Vite CANONICA (dev/build/preview). In `scripts/` per evitare `.timestamp-*` in root (EPERM).
 * 
 * CRITICAL: Questa è l'UNICA config. Se serve modificare PWA manifest, farlo QUI.
 * `package.json` punta qui con `--config scripts/vite.config.mjs` in tutti gli script.
 * 
 * Se lanci `npx vite` senza flag, Vite cercherebbe un config in root che NON esiste più:
 * fallisce con errore — comportamento intenzionale per prevenire config divergenti.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    /**
     * Cache-bust string incorporata nel bundle JS: cambia il content-hash di ogni chunk,
     * garantendo che i browser scarichino i nuovi asset (es. CSS senza dark mode).
     * Formato: `v<versione>-light` — da aggiornare ad ogni rilascio con breaking CSS change.
     */
    __CACHE_BUST__: JSON.stringify(`v${pkg.version}-light`),
    /** Inietta versione in window global per uso in inline script cache-bust */
    'window.__APP_CACHE_VERSION__': JSON.stringify(`${pkg.version}-light`),
  },
  plugins: [
    react(),
    {
      name: 'inject-version-meta',
      transformIndexHtml(html) {
        return html.replace(
          '<meta name="app-version" content="__APP_VERSION__" />',
          `<meta name="app-version" content="${pkg.version}-light" />`
        );
      },
    },
    VitePWA({
      /** In dev niente SW: evita cache / navigate che sembrano “/app non funziona” su 127.0.0.1:5173. */
      devOptions: { enabled: false },
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'flow-app-icon.png'],
      manifest: {
        name: 'FLOW',
        short_name: 'FLOW',
        description: 'FLOW — Work in Motion. Gestione turni e presenze.',
        start_url: '/profilo',
        lang: 'it',
        display: 'standalone',
        background_color: '#001899',
        theme_color: '#0052FF',
        orientation: 'portrait',
        scope: '/',
        icons: [
          { src: '/flow-app-icon.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
        ],
        shortcuts: [
          {
            name: 'Timbratura',
            short_name: 'Timbratura',
            url: '/timbratura',
            description: 'Terminale timbrature (solo entrata/uscita)',
          },
          {
            name: 'Area profili',
            short_name: 'Profili',
            url: '/profilo',
            description: 'Login staff e manager',
          },
        ],
      },
      workbox: {
        /**
         * Senza skipWaiting il nuovo SW resta in "waiting" finché non chiudi tutte le schede:
         * su PWA iOS sembra "bloccata" e l’unica via è disinstallare. clientsClaim fa prendere
         * il controllo subito; il client (workbox-window) ricarica su `activated` in autoUpdate.
         */
        skipWaiting: true,
        clientsClaim: true,
        /** Background Sync: evento `sync` → postMessage alle finestre (`src/utils/backgroundSync.ts`). */
        importScripts: ['pwa-background-sync.js', 'pwa-push-notifications.js'],
        // Precache: icone/manifest + index.html (obbligatorio se navigateFallback punta a index.html,
        // altrimenti Workbox lancia non-precached-url). NO js/css: evita cache stale sui chunk.
        globPatterns: ['**/*.{ico,png,svg,webmanifest}', 'index.html'],
        globIgnores: ['**/*.js', '**/*.css'],

        // SPA fallback: tutte le rotte tornano a index.html
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /^\/rest\//,
          /^\/auth\//,
          /^\/storage\//,
          /^\/realtime\//,
          /^\/assets\//,
        ],

        /**
         * Non usare NetworkFirst su `mode: navigate`: offline la richiesta documento per `/profilo` (ecc.)
         * non ha voce in cache dedicata → fallimento prima del navigateFallback → ERR_INTERNET_DISCONNECTED.
         * Il fallback SPA (index.html precachato) gestisce tutte le rotte; aggiornamenti shell = nuovo SW.
         */
        runtimeCaching: [
          {
            // Google Fonts → CacheFirst: raramente cambiano
            urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-framer': ['framer-motion'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-pdf': ['jspdf'],
          'vendor-date': ['date-fns'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    // `true` = ascolta su tutte le interfacce: anteprima Cursor / Simple Browser e tunnel porte funzionano meglio che con solo 127.0.0.1
    host: true,
    port: 5173,
    strictPort: false,
  },
});
