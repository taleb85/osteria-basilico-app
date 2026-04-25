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
    /**
     * In dev, senza file fisico, Vite cade nello “SPA fallback” e /app-version.txt risponde 200 con
     * l’intero index.html: lo script di confronto versione pensa sia una nuova build e entra in loop
     * di reload. Intercettare PRIMA e servire testo pieno, come in produzione.
     */
    {
      name: 'app-version-dev',
      apply: 'serve',
      configureServer(server) {
        const body = `${pkg.version}-light`;
        server.middlewares.use((req, res, next) => {
          const p = (req.url || '').split('?')[0];
          if (p === '/app-version.txt' || p === '/app-version.txt/') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store, max-age=0');
            res.end(body);
            return;
          }
          next();
        });
      },
    },
    react(),
    {
      name: 'inject-version-meta',
      transformIndexHtml(html) {
        const cacheLabel = `${pkg.version}-light`;
        return html
          .replace(
            '<meta name="app-version" content="__APP_VERSION__" />',
            `<meta name="app-version" content="${cacheLabel}" />`
          )
          .replaceAll('__INJECTED_CACHE_VERSION__', cacheLabel);
      },
    },
    {
      name: 'emit-app-version',
      apply: 'build',
      /** File letto a runtime: confronto con localStorage se l’index è servito da cache (PWA) */
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'app-version.txt',
          source: `${pkg.version}-light`,
        });
      },
    },
    VitePWA({
      /** In dev niente SW: evita cache / navigate che sembrano “/app non funziona” su 127.0.0.1:5173. */
      devOptions: { enabled: false },
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-1024.png', 'flow-app-icon.png', 'icon-152.png', 'icon-167.png'],
      manifest: {
        name: 'FLOW',
        short_name: 'FLOW',
        description: 'FLOW — Work in Motion. Gestione turni e presenze.',
        start_url: '/profilo',
        lang: 'it',
        display: 'standalone',
        background_color: '#1a355d',
        theme_color: '#1a355d',
        orientation: 'portrait',
        scope: '/',
        icons: [
          { src: '/icon-192.png',       sizes: '192x192',   type: 'image/png', purpose: 'any' },
          { src: '/icon-192.png',       sizes: '192x192',   type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512.png',       sizes: '512x512',   type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png',       sizes: '512x512',   type: 'image/png', purpose: 'maskable' },
          { src: '/icon-1024.png',      sizes: '1024x1024', type: 'image/png', purpose: 'any' },
          { src: '/icon-1024.png',      sizes: '1024x1024', type: 'image/png', purpose: 'maskable' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
          { src: '/icon-152.png',       sizes: '152x152',   type: 'image/png', purpose: 'any' },
          { src: '/icon-167.png',       sizes: '167x167',   type: 'image/png', purpose: 'any' },
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
         * /app-version.txt: sempre rete, mai cache SW (allinea deploy anche con index in precache).
         * (navigate: offline → ancora index precachato, vedi sotto e navigateFallback)
         */
        runtimeCaching: [
          {
            urlPattern: /\/app-version\.txt(?:\?.*)?$/i,
            handler: 'NetworkOnly',
            method: 'GET',
          },
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
