import { Plus, Palmtree } from 'lucide-react';
import type { User, Language } from '../../types';
import { getTranslations } from '../../utils/translations';
import { WidgetChrome } from './WidgetChrome';

export default function FerieMgmtPreview({
  previewUser,
  language,
  isSelectedAdmin,
  onUiToggle,
}: {
  previewUser: User;
  language: Language;
  isSelectedAdmin: boolean;
  onUiToggle: (key: string, visible: boolean) => void;
}) {
  const t = getTranslations(language);
  const tv = t as Record<string, string>;
  const hiddenBadge = tv.profile_visibility_ui_hidden_badge ?? 'Nascosto';

  return (
    <div className="flex flex-col gap-4 font-sans">
      <WidgetChrome
        widgetKey="ferie.header"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-neutral-50">{t.sidebar_holidays}</h2>
            <p className="text-xs text-slate-500 dark:text-neutral-300">{t.holiday_management}</p>
          </div>
          <button
            type="button"
            tabIndex={-1}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            {t.new_request}
          </button>
        </div>
      </WidgetChrome>

      <WidgetChrome
        widgetKey="ferie.calendar"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="surface-glass p-3">
          <p className="mb-2 text-center text-xs font-bold text-slate-600 dark:text-neutral-300">Marzo 2026</p>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
            {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
              <span key={`h-${i}`} className="font-bold text-slate-400 dark:text-neutral-400">
                {d}
              </span>
            ))}
            {Array.from({ length: 28 }, (_, i) => (
              <span
                key={i}
                className={`rounded-lg py-1 ${i === 10 ? 'bg-accent/20 font-bold text-accent-dark ring-1 ring-accent/30 dark:bg-accent/25' : 'text-slate-600 dark:text-neutral-400'}`}
              >
                {i + 1}
              </span>
            ))}
          </div>
        </div>
      </WidgetChrome>

      <WidgetChrome
        widgetKey="ferie.list"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="surface-glass overflow-hidden">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-bold text-slate-600 dark:border-white/10 dark:text-neutral-300">
            {t.mod_vacation_requests}
          </div>
          <div className="divide-y divide-slate-50 dark:divide-white/10">
            <div className="flex items-center gap-3 px-3 py-3">
              <Palmtree className="h-8 w-8 shrink-0 text-accent/60" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-neutral-100">Jean · Ferie</p>
                <p className="text-xs text-slate-500 dark:text-neutral-300">15–19 mar</p>
              </div>
              <span className="shrink-0 rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                {t.pending ?? 'In attesa'}
              </span>
            </div>
          </div>
        </div>
      </WidgetChrome>
    </div>
  );
}
