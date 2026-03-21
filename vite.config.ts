/**
 * Copia allineata a `scripts/vite.config.mjs` (path `package.json` diverso: qui siamo in root).
 * La build ufficiale usa `npm run dev|build` → `--config scripts/vite.config.mjs`.
 * Evitare `npx vite` senza flag: riscriverebbe `.timestamp-*` in root (EPERM in alcuni ambienti).
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon.svg', 'logo-ob.svg', 'pwa-splash.svg'],
      manifest: {
        name: 'Osteria Basilico',
        short_name: 'Osteria Basilico',
        description: 'Sistema di gestione turni per Osteria Basilico',
        start_url: '/',
        lang: 'it',
        // standalone = nessuna barra del browser (kiosk tablet + telefono staff)
        display: 'standalone',
        // Splash Android / schermata di caricamento: verde basilico + icona manifest
        background_color: '#2D5A27',
        theme_color: '#2D5A27',
        // any = supporta portrait (telefono) e landscape (tablet kiosk)
        orientation: 'any',
        scope: '/',
        icons: [
          { src: '/logo-ob.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
        ],
        // Scorciatoie launcher: URL separati timbratura vs profili
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
        // Precache SOLO icone/manifest — NO js/css: evita MIME type errors da cache stale
        globPatterns: ['**/*.{ico,png,svg,webmanifest}'],
        globIgnores: ['**/index.html', '**/*.js', '**/*.css'],

        // SPA fallback: tutte le rotte tornano a index.html
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /^\/rest\//,
          /^\/auth\//,
          /^\/storage\//,
          /^\/realtime\//,
          /^\/assets\//,
        ],

        // Navigate (index.html): NetworkFirst — dopo deploy nuovo bundle
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              // Su mobile la rete è spesso lenta: timeout basso → cache HTML vecchia e dati “che non si aggiornano”
              networkTimeoutSeconds: 25,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 4, maxAgeSeconds: 60 },
            },
          },
          // Nessuna strategia su *.supabase.co: il SW non deve intercettare REST/Storage/Auth.
          // NetworkFirst + timeout su 3G serviva risposte GET in cache stale; createClient usa già cache: 'no-store'.
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
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-framer': ['framer-motion'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
