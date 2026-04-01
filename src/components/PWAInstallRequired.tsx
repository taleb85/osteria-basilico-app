import { motion } from 'framer-motion';
import { Share, MoreHorizontal, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { isIOS, isAndroid, isDesktop } from '../utils/pwaStandalone';
import { useApp } from '../context/appContextCore';
import { getTranslations } from '../utils/translations';
import { useTenant, generateTenantLogoSvg } from '../context/TenantContext';

export default function PWAInstallRequired() {
  const { effectiveLanguage } = useApp();
  const { tenant } = useTenant();
  const t = getTranslations(effectiveLanguage);
  const tenantName = tenant?.name ?? 'Osteria Basilico';
  const BG_COLOR = tenant?.accent_color ?? '#2D5A27';
  const logoSrc = tenant?.logo_url ?? generateTenantLogoSvg(tenantName, BG_COLOR);
  const ios = isIOS();
  const android = isAndroid();
  const desktop = isDesktop();

  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Legge il prompt già catturato in index.html prima del caricamento di React
    const already = (window as { __deferredInstallPrompt?: Event }).__deferredInstallPrompt;
    if (already) {
      setDeferredPrompt(already);
      return;
    }
    // Fallback: ascolta nel caso il componente monti prima del prompt
    const handler = (e: Event) => {
      e.preventDefault();
      (window as { __deferredInstallPrompt?: Event }).__deferredInstallPrompt = e;
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = () => {
    if (!deferredPrompt) return;
    const p = deferredPrompt as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };
    // Chiamata sincrona immediata — nessun await prima, altrimenti Chrome perde il gesto utente
    p.prompt();
    setInstalling(true);
    p.userChoice
      .then(() => {
        setInstalling(false);
        setDeferredPrompt(null);
        (window as { __deferredInstallPrompt?: Event }).__deferredInstallPrompt = undefined;
      })
      .catch(() => setInstalling(false));
  };

  return (
    <div
      className="min-h-screen min-h-[100dvh] w-full flex flex-col items-center justify-center px-6 py-8 text-center"
      style={{ backgroundColor: BG_COLOR }}
    >
      <div className="max-w-sm w-full">
        {/* Logo Osteria Basilico */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-24 h-24 mx-auto mb-8 drop-shadow-xl"
        >
          <img src={logoSrc} alt={tenantName} className="w-full h-full" />
        </motion.div>

        {/* Titolo */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="font-logo-snell text-xl sm:text-2xl text-white tracking-tight leading-tight mb-3 px-1"
        >
          {t.pwa_title.replace('Osteria Basilico', tenantName)}
        </motion.h1>

        {/* Sottotitolo */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="text-white/90 text-base leading-relaxed mb-10"
        >
          {t.pwa_subtitle}
        </motion.p>

        {/* Istruzioni dinamiche con animazione "Aggiungi a Home" */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white/10 rounded-2xl p-6 text-left"
        >
          {ios && (
            <div className="flex gap-4 items-start">
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 ring-2 ring-white/30"
              >
                <Share className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <p className="text-white font-semibold mb-1">{t.pwa_ios_title}</p>
                <p className="text-white/90 text-sm leading-relaxed">
                  {t.pwa_ios_instructions}
                </p>
              </div>
            </div>
          )}
          {android && (
            <div className="space-y-4">
              {deferredPrompt ? (
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="w-full flex items-center justify-center gap-3 bg-white text-sm font-semibold py-3 px-5 rounded-xl shadow-md transition active:scale-95 disabled:opacity-60"
                  style={{ color: BG_COLOR }}
                >
                  <Download className="w-5 h-5" />
                  {installing ? 'Installazione…' : `Installa ${tenantName}`}
                </button>
              ) : (
                <div className="flex gap-4 items-start">
                  <motion.div
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 ring-2 ring-white/30"
                  >
                    <MoreHorizontal className="w-6 h-6 text-white" />
                  </motion.div>
                  <div>
                    <p className="text-white font-semibold mb-1">{t.pwa_android_title}</p>
                    <p className="text-white/90 text-sm leading-relaxed">
                      {t.pwa_android_instructions}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          {desktop && (
            <div className="space-y-4">
              {deferredPrompt ? (
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="w-full flex items-center justify-center gap-3 bg-white text-sm font-semibold py-3 px-5 rounded-xl shadow-md transition active:scale-95 disabled:opacity-60"
                  style={{ color: BG_COLOR }}
                >
                  <Download className="w-5 h-5" />
                  {installing ? 'Installazione…' : `Installa ${tenantName}`}
                </button>
              ) : (
                <div>
                  <p className="text-white font-semibold mb-2">{t.pwa_desktop_title}</p>
                  <p className="text-white/90 text-sm leading-relaxed whitespace-pre-line">
                    {t.pwa_desktop_instructions.replace(/Osteria Basilico/g, tenantName)}
                  </p>
                </div>
              )}
            </div>
          )}
          {!ios && !android && !desktop && (
            <div>
              <p className="text-white font-semibold mb-2">{t.pwa_how_to_install}</p>
              <p className="text-white/90 text-sm leading-relaxed mb-3">{t.pwa_ios_short}</p>
              <p className="text-white/90 text-sm leading-relaxed">{t.pwa_android_short}</p>
            </div>
          )}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="text-white/70 text-xs mt-6"
        >
          {t.pwa_after_install}
        </motion.p>
      </div>
    </div>
  );
}
