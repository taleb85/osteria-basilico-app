import './utils/i18n'; // Inizializza i18n con detector prima dell'app
import { StrictMode } from 'react';
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

// Ricarica la pagina al termine del deploy quando è disponibile una nuova versione
registerSW({
  onNeedRefresh: () => window.location.reload(),
  onRegisteredSW(_swUrl, registration) {
    // Check periodico ogni 5 minuti
    if (registration) {
      setInterval(() => {
        if (registration.installing || !navigator.onLine) return;
        registration.update();
      }, 5 * 60 * 1000);
    }
  },
});

// Check aggiornamenti quando l'utente torna sulla scheda (dopo un deploy)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    navigator.serviceWorker?.ready.then((r) => r.update());
  }
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
