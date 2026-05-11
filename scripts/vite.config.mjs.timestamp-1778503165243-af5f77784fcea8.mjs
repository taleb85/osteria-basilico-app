// scripts/vite.config.mjs
import { defineConfig } from "file:///Users/talebbarikhan/Desktop/Osteria_Basilico_Final/node_modules/vite/dist/node/index.js";
import react from "file:///Users/talebbarikhan/Desktop/Osteria_Basilico_Final/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///Users/talebbarikhan/Desktop/Osteria_Basilico_Final/node_modules/vite-plugin-pwa/dist/index.js";
import { readFileSync, existsSync, renameSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
var __vite_injected_original_import_meta_url = "file:///Users/talebbarikhan/Desktop/Osteria_Basilico_Final/scripts/vite.config.mjs";
var __dirname = dirname(fileURLToPath(__vite_injected_original_import_meta_url));
var projectRoot = join(__dirname, "..");
var pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf-8"));
var vite_config_default = defineConfig(({ command }) => {
  const isDev = command === "serve";
  const cacheVersionLabel = command === "build" ? `${pkg.version}-light+${Date.now()}` : `${pkg.version}-light`;
  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __CACHE_BUST__: JSON.stringify(`v${cacheVersionLabel}`),
      "window.__APP_CACHE_VERSION__": JSON.stringify(cacheVersionLabel)
    },
    plugins: [
      {
        name: "app-version-dev",
        apply: "serve",
        configureServer(server) {
          const body = cacheVersionLabel;
          server.middlewares.use((req, res, next) => {
            const p = (req.url || "").split("?")[0];
            if (p === "/app-version.txt" || p === "/app-version.txt/") {
              res.statusCode = 200;
              res.setHeader("Content-Type", "text/plain; charset=utf-8");
              res.setHeader("Cache-Control", "no-store, max-age=0");
              res.end(body);
              return;
            }
            next();
          });
        }
      },
      react(),
      {
        name: "inject-version-meta",
        transformIndexHtml(html) {
          return html.replace(
            '<meta name="app-version" content="__APP_VERSION__" />',
            `<meta name="app-version" content="${pkg.version}" />`
          ).replaceAll("__INJECTED_CACHE_VERSION__", cacheVersionLabel);
        }
      },
      {
        name: "emit-app-version",
        apply: "build",
        generateBundle() {
          this.emitFile({
            type: "asset",
            fileName: "app-version.txt",
            source: cacheVersionLabel
          });
        }
      },
      {
        name: "vite-plugin-rename-index",
        apply: "build",
        closeBundle() {
          const distIndex = join(projectRoot, "dist", "index.html");
          const distApp = join(projectRoot, "dist", "app.html");
          if (existsSync(distIndex)) {
            renameSync(distIndex, distApp);
          }
        }
      },
      VitePWA({
        devOptions: {
          enabled: !isDev,
          type: "classic"
        },
        registerType: "autoUpdate",
        includeAssets: [
          "favicon.ico",
          "apple-touch-icon.png",
          "og-image.png",
          "icon-192.png",
          "icon-512.png",
          "icon-1024.png",
          "flow-app-icon.png",
          "icons/icon-16.png",
          "icons/icon-32.png",
          "icons/icon-48.png",
          "icons/icon-72.png",
          "icons/icon-96.png",
          "icons/icon-128.png",
          "icons/icon-144.png",
          "icons/icon-152.png",
          "icons/icon-167.png",
          "icons/icon-180.png",
          "icons/icon-192.png",
          "icons/icon-384.png",
          "icons/icon-512.png",
          "icons/icon-1024.png"
        ],
        manifest: {
          name: "FLOW",
          short_name: "FLOW",
          description: "FLOW \u2014 Work in Motion. Gestione turni e presenze.",
          start_url: "/profilo",
          lang: "it",
          display: "standalone",
          background_color: "#0d3b6e",
          theme_color: "#0d3b6e",
          orientation: "any",
          scope: "/",
          icons: [
            { src: "/icons/icon-48.png", sizes: "48x48", type: "image/png" },
            { src: "/icons/icon-72.png", sizes: "72x72", type: "image/png" },
            { src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" },
            { src: "/icons/icon-128.png", sizes: "128x128", type: "image/png" },
            { src: "/icons/icon-144.png", sizes: "144x144", type: "image/png" },
            { src: "/icons/icon-152.png", sizes: "152x152", type: "image/png" },
            { src: "/icons/icon-167.png", sizes: "167x167", type: "image/png" },
            { src: "/icons/icon-180.png", sizes: "180x180", type: "image/png" },
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
            { src: "/icons/icon-1024.png", sizes: "1024x1024", type: "image/png" }
          ],
          shortcuts: [
            { name: "Timbratura", short_name: "Timbratura", url: "/timbratura", description: "Terminale timbrature" },
            { name: "Area profili", short_name: "Profili", url: "/profilo", description: "Login staff e manager" }
          ]
        },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          importScripts: ["pwa-background-sync.js", "pwa-push-notifications.js"],
          globPatterns: ["**/*.{ico,png,svg,webmanifest}", "app.html"],
          navigateFallback: "app.html",
          navigateFallbackDenylist: [
            /^\/rest\//,
            /^\/auth\//,
            /^\/storage\//,
            /^\/realtime\//,
            /^\/assets\//
          ],
          runtimeCaching: [
            {
              urlPattern: /\/api\/punch/,
              handler: "NetworkOnly",
              options: {
                backgroundSync: { name: "punch-queue", options: { maxRetentionTime: 24 * 60 } }
              }
            },
            {
              urlPattern: /\/app-version\.txt(?:\?.*)?$/i,
              handler: "NetworkOnly",
              method: "GET"
            },
            {
              urlPattern: /\.(js|css)$/,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "app-chunks",
                expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts",
                expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] }
              }
            }
          ]
        }
      })
    ],
    build: {
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-framer": ["framer-motion"],
            "vendor-supabase": ["@supabase/supabase-js"],
            "vendor-pdf": ["jspdf"],
            "vendor-date": ["date-fns"],
            "vendor-icons": ["lucide-react"]
          }
        }
      }
    },
    optimizeDeps: {
      exclude: ["lucide-react"],
      /** Evita che esbuild scansioni file non necessari che causano errori */
      entries: ["src/**/*.{ts,tsx}", "index.html"]
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: false
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic2NyaXB0cy92aXRlLmNvbmZpZy5tanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdGFsZWJiYXJpa2hhbi9EZXNrdG9wL09zdGVyaWFfQmFzaWxpY29fRmluYWwvc2NyaXB0c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3RhbGViYmFyaWtoYW4vRGVza3RvcC9Pc3RlcmlhX0Jhc2lsaWNvX0ZpbmFsL3NjcmlwdHMvdml0ZS5jb25maWcubWpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy90YWxlYmJhcmlraGFuL0Rlc2t0b3AvT3N0ZXJpYV9CYXNpbGljb19GaW5hbC9zY3JpcHRzL3ZpdGUuY29uZmlnLm1qc1wiOy8qKlxuICogQ29uZmlnIFZpdGUgQ0FOT05JQ0EgKGRldi9idWlsZC9wcmV2aWV3KS4gSW4gYHNjcmlwdHMvYCBwZXIgZXZpdGFyZSBgLnRpbWVzdGFtcC0qYCBpbiByb290IChFUEVSTSkuXG4gKi9cbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnO1xuaW1wb3J0IHsgcmVhZEZpbGVTeW5jLCBleGlzdHNTeW5jLCByZW5hbWVTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgZGlybmFtZSwgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ3VybCc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKTtcbmNvbnN0IHByb2plY3RSb290ID0gam9pbihfX2Rpcm5hbWUsICcuLicpO1xuY29uc3QgcGtnID0gSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMoam9pbihwcm9qZWN0Um9vdCwgJ3BhY2thZ2UuanNvbicpLCAndXRmLTgnKSk7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBjb21tYW5kIH0pID0+IHtcbiAgY29uc3QgaXNEZXYgPSBjb21tYW5kID09PSAnc2VydmUnO1xuICBjb25zdCBjYWNoZVZlcnNpb25MYWJlbCA9XG4gICAgY29tbWFuZCA9PT0gJ2J1aWxkJyA/IGAke3BrZy52ZXJzaW9ufS1saWdodCske0RhdGUubm93KCl9YCA6IGAke3BrZy52ZXJzaW9ufS1saWdodGA7XG5cbiAgcmV0dXJuIHtcbiAgZGVmaW5lOiB7XG4gICAgX19BUFBfVkVSU0lPTl9fOiBKU09OLnN0cmluZ2lmeShwa2cudmVyc2lvbiksXG4gICAgX19DQUNIRV9CVVNUX186IEpTT04uc3RyaW5naWZ5KGB2JHtjYWNoZVZlcnNpb25MYWJlbH1gKSxcbiAgICAnd2luZG93Ll9fQVBQX0NBQ0hFX1ZFUlNJT05fXyc6IEpTT04uc3RyaW5naWZ5KGNhY2hlVmVyc2lvbkxhYmVsKSxcbiAgfSxcbiAgcGx1Z2luczogW1xuICAgIHtcbiAgICAgIG5hbWU6ICdhcHAtdmVyc2lvbi1kZXYnLFxuICAgICAgYXBwbHk6ICdzZXJ2ZScsXG4gICAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSBjYWNoZVZlcnNpb25MYWJlbDtcbiAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICAgICAgICBjb25zdCBwID0gKHJlcS51cmwgfHwgJycpLnNwbGl0KCc/JylbMF07XG4gICAgICAgICAgaWYgKHAgPT09ICcvYXBwLXZlcnNpb24udHh0JyB8fCBwID09PSAnL2FwcC12ZXJzaW9uLnR4dC8nKSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICd0ZXh0L3BsYWluOyBjaGFyc2V0PXV0Zi04Jyk7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDYWNoZS1Db250cm9sJywgJ25vLXN0b3JlLCBtYXgtYWdlPTAnKTtcbiAgICAgICAgICAgIHJlcy5lbmQoYm9keSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgIH0sXG4gICAgcmVhY3QoKSxcbiAgICB7XG4gICAgICBuYW1lOiAnaW5qZWN0LXZlcnNpb24tbWV0YScsXG4gICAgICB0cmFuc2Zvcm1JbmRleEh0bWwoaHRtbCkge1xuICAgICAgICByZXR1cm4gaHRtbFxuICAgICAgICAgIC5yZXBsYWNlKFxuICAgICAgICAgICAgJzxtZXRhIG5hbWU9XCJhcHAtdmVyc2lvblwiIGNvbnRlbnQ9XCJfX0FQUF9WRVJTSU9OX19cIiAvPicsXG4gICAgICAgICAgICBgPG1ldGEgbmFtZT1cImFwcC12ZXJzaW9uXCIgY29udGVudD1cIiR7cGtnLnZlcnNpb259XCIgLz5gXG4gICAgICAgICAgKVxuICAgICAgICAgIC5yZXBsYWNlQWxsKCdfX0lOSkVDVEVEX0NBQ0hFX1ZFUlNJT05fXycsIGNhY2hlVmVyc2lvbkxhYmVsKTtcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnZW1pdC1hcHAtdmVyc2lvbicsXG4gICAgICBhcHBseTogJ2J1aWxkJyxcbiAgICAgIGdlbmVyYXRlQnVuZGxlKCkge1xuICAgICAgICB0aGlzLmVtaXRGaWxlKHtcbiAgICAgICAgICB0eXBlOiAnYXNzZXQnLFxuICAgICAgICAgIGZpbGVOYW1lOiAnYXBwLXZlcnNpb24udHh0JyxcbiAgICAgICAgICBzb3VyY2U6IGNhY2hlVmVyc2lvbkxhYmVsLFxuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAndml0ZS1wbHVnaW4tcmVuYW1lLWluZGV4JyxcbiAgICAgIGFwcGx5OiAnYnVpbGQnLFxuICAgICAgY2xvc2VCdW5kbGUoKSB7XG4gICAgICAgIGNvbnN0IGRpc3RJbmRleCA9IGpvaW4ocHJvamVjdFJvb3QsICdkaXN0JywgJ2luZGV4Lmh0bWwnKTtcbiAgICAgICAgY29uc3QgZGlzdEFwcCA9IGpvaW4ocHJvamVjdFJvb3QsICdkaXN0JywgJ2FwcC5odG1sJyk7XG4gICAgICAgIGlmIChleGlzdHNTeW5jKGRpc3RJbmRleCkpIHtcbiAgICAgICAgICByZW5hbWVTeW5jKGRpc3RJbmRleCwgZGlzdEFwcCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSxcbiAgICBWaXRlUFdBKHtcbiAgICAgIGRldk9wdGlvbnM6IHtcbiAgICAgICAgZW5hYmxlZDogIWlzRGV2LFxuICAgICAgICB0eXBlOiAnY2xhc3NpYycsXG4gICAgICB9LFxuICAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbXG4gICAgICAgICdmYXZpY29uLmljbycsXG4gICAgICAgICdhcHBsZS10b3VjaC1pY29uLnBuZycsXG4gICAgICAgICdvZy1pbWFnZS5wbmcnLFxuICAgICAgICAnaWNvbi0xOTIucG5nJyxcbiAgICAgICAgJ2ljb24tNTEyLnBuZycsXG4gICAgICAgICdpY29uLTEwMjQucG5nJyxcbiAgICAgICAgJ2Zsb3ctYXBwLWljb24ucG5nJyxcbiAgICAgICAgJ2ljb25zL2ljb24tMTYucG5nJyxcbiAgICAgICAgJ2ljb25zL2ljb24tMzIucG5nJyxcbiAgICAgICAgJ2ljb25zL2ljb24tNDgucG5nJyxcbiAgICAgICAgJ2ljb25zL2ljb24tNzIucG5nJyxcbiAgICAgICAgJ2ljb25zL2ljb24tOTYucG5nJyxcbiAgICAgICAgJ2ljb25zL2ljb24tMTI4LnBuZycsXG4gICAgICAgICdpY29ucy9pY29uLTE0NC5wbmcnLFxuICAgICAgICAnaWNvbnMvaWNvbi0xNTIucG5nJyxcbiAgICAgICAgJ2ljb25zL2ljb24tMTY3LnBuZycsXG4gICAgICAgICdpY29ucy9pY29uLTE4MC5wbmcnLFxuICAgICAgICAnaWNvbnMvaWNvbi0xOTIucG5nJyxcbiAgICAgICAgJ2ljb25zL2ljb24tMzg0LnBuZycsXG4gICAgICAgICdpY29ucy9pY29uLTUxMi5wbmcnLFxuICAgICAgICAnaWNvbnMvaWNvbi0xMDI0LnBuZycsXG4gICAgICBdLFxuICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgbmFtZTogJ0ZMT1cnLFxuICAgICAgICBzaG9ydF9uYW1lOiAnRkxPVycsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnRkxPVyBcdTIwMTQgV29yayBpbiBNb3Rpb24uIEdlc3Rpb25lIHR1cm5pIGUgcHJlc2VuemUuJyxcbiAgICAgICAgc3RhcnRfdXJsOiAnL3Byb2ZpbG8nLFxuICAgICAgICBsYW5nOiAnaXQnLFxuICAgICAgICBkaXNwbGF5OiAnc3RhbmRhbG9uZScsXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjMGQzYjZlJyxcbiAgICAgICAgdGhlbWVfY29sb3I6ICcjMGQzYjZlJyxcbiAgICAgICAgb3JpZW50YXRpb246ICdhbnknLFxuICAgICAgICBzY29wZTogJy8nLFxuICAgICAgICBpY29uczogW1xuICAgICAgICAgIHsgc3JjOiAnL2ljb25zL2ljb24tNDgucG5nJywgc2l6ZXM6ICc0OHg0OCcsIHR5cGU6ICdpbWFnZS9wbmcnIH0sXG4gICAgICAgICAgeyBzcmM6ICcvaWNvbnMvaWNvbi03Mi5wbmcnLCBzaXplczogJzcyeDcyJywgdHlwZTogJ2ltYWdlL3BuZycgfSxcbiAgICAgICAgICB7IHNyYzogJy9pY29ucy9pY29uLTk2LnBuZycsIHNpemVzOiAnOTZ4OTYnLCB0eXBlOiAnaW1hZ2UvcG5nJyB9LFxuICAgICAgICAgIHsgc3JjOiAnL2ljb25zL2ljb24tMTI4LnBuZycsIHNpemVzOiAnMTI4eDEyOCcsIHR5cGU6ICdpbWFnZS9wbmcnIH0sXG4gICAgICAgICAgeyBzcmM6ICcvaWNvbnMvaWNvbi0xNDQucG5nJywgc2l6ZXM6ICcxNDR4MTQ0JywgdHlwZTogJ2ltYWdlL3BuZycgfSxcbiAgICAgICAgICB7IHNyYzogJy9pY29ucy9pY29uLTE1Mi5wbmcnLCBzaXplczogJzE1MngxNTInLCB0eXBlOiAnaW1hZ2UvcG5nJyB9LFxuICAgICAgICAgIHsgc3JjOiAnL2ljb25zL2ljb24tMTY3LnBuZycsIHNpemVzOiAnMTY3eDE2NycsIHR5cGU6ICdpbWFnZS9wbmcnIH0sXG4gICAgICAgICAgeyBzcmM6ICcvaWNvbnMvaWNvbi0xODAucG5nJywgc2l6ZXM6ICcxODB4MTgwJywgdHlwZTogJ2ltYWdlL3BuZycgfSxcbiAgICAgICAgICB7IHNyYzogJy9pY29ucy9pY29uLTE5Mi5wbmcnLCBzaXplczogJzE5MngxOTInLCB0eXBlOiAnaW1hZ2UvcG5nJywgcHVycG9zZTogJ2FueScgfSxcbiAgICAgICAgICB7IHNyYzogJy9pY29ucy9pY29uLTE5Mi5wbmcnLCBzaXplczogJzE5MngxOTInLCB0eXBlOiAnaW1hZ2UvcG5nJywgcHVycG9zZTogJ21hc2thYmxlJyB9LFxuICAgICAgICAgIHsgc3JjOiAnL2ljb25zL2ljb24tMzg0LnBuZycsIHNpemVzOiAnMzg0eDM4NCcsIHR5cGU6ICdpbWFnZS9wbmcnIH0sXG4gICAgICAgICAgeyBzcmM6ICcvaWNvbnMvaWNvbi01MTIucG5nJywgc2l6ZXM6ICc1MTJ4NTEyJywgdHlwZTogJ2ltYWdlL3BuZycsIHB1cnBvc2U6ICdhbnknIH0sXG4gICAgICAgICAgeyBzcmM6ICcvaWNvbnMvaWNvbi01MTIucG5nJywgc2l6ZXM6ICc1MTJ4NTEyJywgdHlwZTogJ2ltYWdlL3BuZycsIHB1cnBvc2U6ICdtYXNrYWJsZScgfSxcbiAgICAgICAgICB7IHNyYzogJy9pY29ucy9pY29uLTEwMjQucG5nJywgc2l6ZXM6ICcxMDI0eDEwMjQnLCB0eXBlOiAnaW1hZ2UvcG5nJyB9LFxuICAgICAgICBdLFxuICAgICAgICBzaG9ydGN1dHM6IFtcbiAgICAgICAgICB7IG5hbWU6ICdUaW1icmF0dXJhJywgc2hvcnRfbmFtZTogJ1RpbWJyYXR1cmEnLCB1cmw6ICcvdGltYnJhdHVyYScsIGRlc2NyaXB0aW9uOiAnVGVybWluYWxlIHRpbWJyYXR1cmUnIH0sXG4gICAgICAgICAgeyBuYW1lOiAnQXJlYSBwcm9maWxpJywgc2hvcnRfbmFtZTogJ1Byb2ZpbGknLCB1cmw6ICcvcHJvZmlsbycsIGRlc2NyaXB0aW9uOiAnTG9naW4gc3RhZmYgZSBtYW5hZ2VyJyB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIHdvcmtib3g6IHtcbiAgICAgICAgc2tpcFdhaXRpbmc6IHRydWUsXG4gICAgICAgIGNsaWVudHNDbGFpbTogdHJ1ZSxcbiAgICAgICAgY2xlYW51cE91dGRhdGVkQ2FjaGVzOiB0cnVlLFxuICAgICAgICBpbXBvcnRTY3JpcHRzOiBbJ3B3YS1iYWNrZ3JvdW5kLXN5bmMuanMnLCAncHdhLXB1c2gtbm90aWZpY2F0aW9ucy5qcyddLFxuICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57aWNvLHBuZyxzdmcsd2VibWFuaWZlc3R9JywgJ2FwcC5odG1sJ10sXG4gICAgICAgIG5hdmlnYXRlRmFsbGJhY2s6ICdhcHAuaHRtbCcsXG4gICAgICAgIG5hdmlnYXRlRmFsbGJhY2tEZW55bGlzdDogW1xuICAgICAgICAgIC9eXFwvcmVzdFxcLy8sXG4gICAgICAgICAgL15cXC9hdXRoXFwvLyxcbiAgICAgICAgICAvXlxcL3N0b3JhZ2VcXC8vLFxuICAgICAgICAgIC9eXFwvcmVhbHRpbWVcXC8vLFxuICAgICAgICAgIC9eXFwvYXNzZXRzXFwvLyxcbiAgICAgICAgXSxcbiAgICAgICAgcnVudGltZUNhY2hpbmc6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXFwvYXBpXFwvcHVuY2gvLFxuICAgICAgICAgICAgaGFuZGxlcjogJ05ldHdvcmtPbmx5JyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgYmFja2dyb3VuZFN5bmM6IHsgbmFtZTogJ3B1bmNoLXF1ZXVlJywgb3B0aW9uczogeyBtYXhSZXRlbnRpb25UaW1lOiAyNCAqIDYwIH0gfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXFwvYXBwLXZlcnNpb25cXC50eHQoPzpcXD8uKik/JC9pLFxuICAgICAgICAgICAgaGFuZGxlcjogJ05ldHdvcmtPbmx5JyxcbiAgICAgICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXFwuKGpzfGNzcykkLyxcbiAgICAgICAgICAgIGhhbmRsZXI6ICdTdGFsZVdoaWxlUmV2YWxpZGF0ZScsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogJ2FwcC1jaHVua3MnLFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7IG1heEVudHJpZXM6IDYwLCBtYXhBZ2VTZWNvbmRzOiA3ICogMjQgKiA2MCAqIDYwIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9mb250c1xcLig/OmdzdGF0aWN8Z29vZ2xlYXBpcylcXC5jb21cXC8uKi9pLFxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdnb29nbGUtZm9udHMnLFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7IG1heEVudHJpZXM6IDQsIG1heEFnZVNlY29uZHM6IDM2NSAqIDI0ICogNjAgKiA2MCB9LFxuICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZTogeyBzdGF0dXNlczogWzAsIDIwMF0gfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSksXG4gIF0sXG4gIGJ1aWxkOiB7XG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiA3MDAsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgICd2ZW5kb3ItcmVhY3QnOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC1yb3V0ZXItZG9tJ10sXG4gICAgICAgICAgJ3ZlbmRvci1mcmFtZXInOiBbJ2ZyYW1lci1tb3Rpb24nXSxcbiAgICAgICAgICAndmVuZG9yLXN1cGFiYXNlJzogWydAc3VwYWJhc2Uvc3VwYWJhc2UtanMnXSxcbiAgICAgICAgICAndmVuZG9yLXBkZic6IFsnanNwZGYnXSxcbiAgICAgICAgICAndmVuZG9yLWRhdGUnOiBbJ2RhdGUtZm5zJ10sXG4gICAgICAgICAgJ3ZlbmRvci1pY29ucyc6IFsnbHVjaWRlLXJlYWN0J10sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnbHVjaWRlLXJlYWN0J10sXG4gICAgLyoqIEV2aXRhIGNoZSBlc2J1aWxkIHNjYW5zaW9uaSBmaWxlIG5vbiBuZWNlc3NhcmkgY2hlIGNhdXNhbm8gZXJyb3JpICovXG4gICAgZW50cmllczogWydzcmMvKiovKi57dHMsdHN4fScsICdpbmRleC5odG1sJ10sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6ICcwLjAuMC4wJyxcbiAgICBwb3J0OiA1MTczLFxuICAgIHN0cmljdFBvcnQ6IGZhbHNlLFxuICB9LFxuICB9O1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBR0EsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGNBQWMsWUFBWSxrQkFBa0I7QUFDckQsU0FBUyxTQUFTLFlBQVk7QUFDOUIsU0FBUyxx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
