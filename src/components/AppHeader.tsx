import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { LogOut, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getDateLocale, getTranslations } from '../utils/translations';
import UserAvatarMenu from './UserAvatarMenu';
import NotificationCenter from './NotificationCenter';

interface AppHeaderProps {
  onLogout?: () => void;
}

export default function AppHeader({ onLogout }: AppHeaderProps) {
  const { currentUser, effectiveLanguage, setLanguage } = useApp();
  const [now, setNow] = useState(() => new Date());
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!langOpen) return;
    const handler = (e: PointerEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [langOpen]);

  const t = getTranslations(effectiveLanguage);
  const locale = getDateLocale(effectiveLanguage) ?? it;
  const langLabels: Record<string, string> = { it: 'IT', en: 'EN', es: 'ES', fr: 'FR' };
  const langFlags: Record<string, string> = { it: '🇮🇹', en: '🇬🇧', es: '🇪🇸', fr: '🇫🇷' };

  if (!currentUser) return null;

  return (
    <header className="sticky top-0 z-30 w-full bg-white border-b border-slate-100 shadow-sm safe-area-pad pt-0">
      <div className="w-full px-3 sm:px-6 py-1.5 sm:py-2.5 flex items-center justify-between gap-2">
        {/* Logo — nascosto su desktop (gestito dalla Sidebar) */}
        <h1 className="font-logo-snell text-[35px] text-accent tracking-tight min-w-0 flex-1 truncate pr-2 leading-[33px] md:hidden">
          Osteria Basilico
        </h1>
        {/* Brand su desktop (la sidebar non ha più l'header) */}
        <div className="hidden md:flex flex-col justify-center min-w-0 flex-1">
          <h1 className="font-logo-snell text-[22px] text-accent tracking-tight leading-tight truncate">
            Osteria Basilico
          </h1>
          <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest leading-none">
            {t.header_tagline}
          </p>
        </div>

        {/* Destra: avatar + campanella + lingua + orario + logout mobile */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <UserAvatarMenu />
          <NotificationCenter />

          {/* Selettore lingua — dropdown singolo */}
          <div ref={langRef} className="relative">
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              className="flex items-center gap-0.5 min-h-[36px] px-2 py-1 rounded-xl border border-slate-100 bg-slate-50 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <span>{langFlags[effectiveLanguage]}</span>
              <span className="hidden sm:inline ml-0.5">{langLabels[effectiveLanguage]}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-28 rounded-xl bg-white border border-slate-100 shadow-lg py-1 z-50">
                {(['it', 'en', 'es', 'fr'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => { setLanguage(lang); setLangOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      effectiveLanguage === lang
                        ? 'bg-accent/10 text-accent font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{langFlags[lang]}</span>
                    <span className="text-xs font-medium">{langLabels[lang]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Logout — solo mobile (su desktop è nella sidebar) */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title={t.header_logout}
              className="md:hidden flex-shrink-0 min-h-[36px] min-w-[36px] rounded-xl border border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <LogOut className="w-4 h-4" strokeWidth={2} />
            </button>
          )}

          <span className="hidden sm:block text-slate-400 text-xs font-medium tabular-nums">
            {format(now, 'HH:mm', { locale })}
          </span>
        </div>
      </div>
    </header>
  );
}
