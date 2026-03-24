import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { LogOut, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useWallAlignedMinuteClock } from '../hooks/useWallAlignedMinuteClock';
import { getDateLocale, getTranslations } from '../utils/translations';
import UserAvatarMenu from './UserAvatarMenu';
import NotificationCenter from './NotificationCenter';
import { CenteredModalPortal } from './ui/CenteredModalPortal';

interface AppHeaderProps {
  onLogout?: () => void;
}

export default function AppHeader({ onLogout }: AppHeaderProps) {
  const { currentUser, effectiveLanguage, setLanguage } = useApp();
  const now = useWallAlignedMinuteClock();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const langModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!langOpen) return;
    const handler = (e: PointerEvent) => {
      const tgt = e.target as Node;
      if (langModalRef.current?.contains(tgt)) return;
      if (langRef.current?.contains(tgt)) return;
      setLangOpen(false);
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
          <p className="text-[9px] text-slate-400 dark:text-neutral-400 font-semibold uppercase tracking-widest leading-none">
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
              <ChevronDown className="w-3 h-3 text-slate-400 dark:text-neutral-400" />
            </button>
            {langOpen && (
              <CenteredModalPortal
                open
                onClose={() => setLangOpen(false)}
                panelRef={langModalRef}
                backdropAriaLabel={t.close}
                ariaLabel={t.language}
                maxWidthClass="max-w-xs"
                panelClassName="py-1"
              >
                <p className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">{t.language}</p>
                {(['it', 'en', 'es', 'fr'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      setLanguage(lang);
                      setLangOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                      effectiveLanguage === lang
                        ? 'bg-accent/10 font-semibold text-accent'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{langFlags[lang]}</span>
                    <span className="text-xs font-medium">{langLabels[lang]}</span>
                  </button>
                ))}
              </CenteredModalPortal>
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

          <span className="hidden sm:block text-slate-400 dark:text-neutral-400 text-xs font-medium tabular-nums">
            {format(now, 'HH:mm', { locale })}
          </span>
        </div>
      </div>
    </header>
  );
}
