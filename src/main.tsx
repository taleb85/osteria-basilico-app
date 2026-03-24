import './utils/i18n'; // Inizializza i18n con detector prima dell'app
import { StrictMode } from 'react';

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

/** Durata minima splash così si vede sempre logo + titolo (come schermata nativa). `?nosplash=1` la salta. */
const PWA_SPLASH_MIN_MS = 1100;

function skipSplashMinDelay(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('nosplash');
  } catch {
    return false;
  }
}

function waitNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function waitMinSplashVisible(): Promise<void> {
  if (skipSplashMinDelay()) return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, PWA_SPLASH_MIN_MS);
  });
}

/** Nasconde lo splash HTML (sfondo bianco + logo) dopo primo paint e tempo minimo. */
function dismissPwaSplash() {
  const el = document.getElementById('pwa-splash');
  if (!el) return;
  el.classList.add('pwa-splash--hide');
  const remove = () => {
    el.remove();
    el.removeEventListener('transitionend', remove);
  };
  el.addEventListener('transitionend', remove, { once: true });
  window.setTimeout(() => {
    if (el.parentNode) el.remove();
  }, 600);
}

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

// Dopo login il gate PWA richiede standalone in produzione; in dev è disattivato (vedi PwaGate)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

void Promise.all([waitNextPaint(), waitMinSplashVisible()]).then(() => dismissPwaSplash());
