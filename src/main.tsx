import './utils/i18n'; // Inizializza i18n con detector prima dell'app
import { StrictMode } from 'react';

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { RootErrorBoundary } from './components/RootErrorBoundary';
import { TenantProvider } from './context/TenantContext';
import './index.css';

// autoUpdate: workbox-window ricarica su `activated` se c’è un aggiornamento (vedi vite-plugin-pwa register.js).
// `onNeedRefresh` vale solo con registerType: 'prompt', qui non viene chiamato.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    const tick = () => {
      if (registration.installing || !navigator.onLine) return;
      void registration.update();
    };
    // Primi minuti dopo apertura: deploy frequenti (staff al telefono)
    const fast = window.setInterval(tick, 60 * 1000);
    window.setTimeout(() => window.clearInterval(fast), 15 * 60 * 1000);
    window.setInterval(tick, 5 * 60 * 1000);
  },
});

function requestServiceWorkerUpdate() {
  void navigator.serviceWorker?.ready.then((r) => r.update());
}

// Torna in app / finestra → controlla subito nuovo SW (dopo un deploy)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') requestServiceWorkerUpdate();
});
window.addEventListener('focus', requestServiceWorkerUpdate);
window.addEventListener('pageshow', (e) => {
  if (e.persisted) requestServiceWorkerUpdate();
});

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML =
    '<p style="font-family:system-ui;padding:1rem">Manca l’elemento #root in index.html.</p>';
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <RootErrorBoundary>
        <TenantProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </TenantProvider>
      </RootErrorBoundary>
    </StrictMode>
  );
}
