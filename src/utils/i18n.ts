import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { translations } from './translations';

/** `document.documentElement.lang` è aggiornato da `AppContext` in base a `effectiveLanguage` (allineato a `i18n.changeLanguage`). */

const LANG_STORAGE_KEY = 'appLanguage';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      it: { translation: translations.it },
      en: { translation: translations.en },
      es: { translation: translations.es },
      fr: { translation: translations.fr },
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: LANG_STORAGE_KEY,
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => {
        const code = (lng || '').split('-')[0].toLowerCase();
        if (code === 'en') return 'en';
        if (code === 'es') return 'es';
        if (code === 'fr') return 'fr';
        if (code === 'it') return 'it';
        return 'it';
      },
    },
    supportedLngs: ['it', 'en', 'es', 'fr'],
    fallbackLng: 'it',
    /** Niente messaggio promo Locize in console (i18next ≥ 25). */
    showSupportNotice: false,
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;