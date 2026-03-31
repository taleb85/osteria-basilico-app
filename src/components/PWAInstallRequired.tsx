import { motion } from 'framer-motion';
import { Share, MoreHorizontal } from 'lucide-react';
import { isIOS, isAndroid, isDesktop } from '../utils/pwaStandalone';
import { useApp } from '../context/appContextCore';
import { getTranslations } from '../utils/translations';

const BG_COLOR = '#2D5A27'; // Verde Basilico

export default function PWAInstallRequired() {
  const { effectiveLanguage } = useApp();
  const t = getTranslations(effectiveLanguage);
  const ios = isIOS();
  const android = isAndroid();
  const desktop = isDesktop();

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
          className="w-24 h-24 rounded-2xl bg-white shadow-lg flex items-center justify-center mx-auto mb-8 overflow-hidden"
        >
          <img src="/logo-ob.svg" alt="Osteria Basilico" className="w-full h-full object-contain p-2" />
        </motion.div>

        {/* Titolo */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="font-logo-snell text-xl sm:text-2xl text-white tracking-tight leading-tight mb-3 px-1"
        >
          {t.pwa_title}
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
          {desktop && (
            <div>
              <p className="text-white font-semibold mb-2">{t.pwa_desktop_title}</p>
              <p className="text-white/90 text-sm leading-relaxed whitespace-pre-line">
                {t.pwa_desktop_instructions}
              </p>
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
