import { Filter, ChevronDown, Calendar, Users } from 'lucide-react';
import type { User, Language } from '../../types';
import { getTranslations } from '../../utils/translations';
import { WidgetChrome } from './WidgetChrome';

export default function TurniMgmtPreview({
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
  const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  return (
    <div className="flex flex-col gap-4 font-sans">
      <WidgetChrome
        widgetKey="turni.toolbar_block"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-neutral-900 dark:shadow-none">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-xl border border-accent/30 px-2 py-1 text-xs font-semibold text-accent">{t.today}</span>
            <div className="flex rounded-xl border border-slate-200 p-0.5 dark:border-white/10">
              <span className="rounded-lg bg-accent px-2 py-1 text-xs font-medium text-white">{t.view_week}</span>
              <span className="px-2 py-1 text-xs text-slate-500 dark:text-neutral-300">{t.view_month}</span>
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-neutral-300">1/4</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2 py-1 text-xs text-slate-600 dark:border-white/10 dark:text-neutral-300">
              <Filter className="h-3 w-3" /> {t.wst_filters}
              <ChevronDown className="h-3 w-3" />
            </span>
            <span className="rounded-xl border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 dark:border-white/10 dark:text-neutral-300">
              {t.wst_actions ?? 'Azioni'} ▾
            </span>
          </div>
        </div>
      </WidgetChrome>

      <WidgetChrome
        widgetKey="turni.date_nav_bar"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="flex items-center justify-between gap-1 overflow-x-auto-safe rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
          {days.map((d, i) => (
            <div
              key={d}
              className={`flex min-w-[2.5rem] flex-col items-center rounded-lg px-1 py-1 text-center ${i === 2 ? 'bg-accent/15 ring-1 ring-accent/40' : ''}`}
            >
              <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-400">{d}</span>
              <span className="text-xs font-bold text-slate-800 dark:text-neutral-100">{10 + i}</span>
            </div>
          ))}
        </div>
      </WidgetChrome>

      <WidgetChrome
        widgetKey="turni.schedule_grid"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900 dark:shadow-none">
          <div className="grid grid-cols-[minmax(4rem,1fr)_repeat(7,minmax(0,1fr))] gap-px bg-slate-200 text-[10px] dark:bg-white/10">
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-2 font-bold text-slate-500 dark:bg-neutral-800 dark:text-neutral-300">
              <Users className="h-3 w-3" /> Team
            </div>
            {days.map((d) => (
              <div key={d} className="bg-slate-50 py-2 text-center font-bold text-slate-500 dark:bg-neutral-800 dark:text-neutral-300">
                {d.slice(0, 1)}
              </div>
            ))}
            {['Jean', 'John', 'Marie'].map((nm) => (
              <div key={nm} className="contents">
                <div className="bg-white px-2 py-3 font-semibold text-slate-700 dark:bg-neutral-900 dark:text-neutral-200">{nm}</div>
                {days.map((d, di) => (
                  <div key={`${nm}-${d}`} className="min-h-[52px] bg-white p-0.5 dark:bg-neutral-900">
                    {di === 2 && nm === 'Jean' && (
                      <div className="rounded-lg bg-accent/10 px-1 py-1 text-center text-[9px] font-bold text-accent ring-1 ring-accent/25">
                        10–16
                      </div>
                    )}
                    {di === 4 && nm === 'John' && (
                      <div className="rounded-lg bg-accent/10 px-1 py-1 text-center text-[9px] font-bold text-accent ring-1 ring-accent/25">
                        18–23
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="flex items-center justify-center gap-1 border-t border-slate-100 py-2 text-[10px] text-slate-400 dark:border-white/10 dark:text-neutral-400">
            <Calendar className="h-3 w-3" />
            {tv.profile_visibility_turni_grid_hint ?? 'Griglia dimostrativa — in app sono i turni reali del periodo.'}
          </p>
        </div>
      </WidgetChrome>
    </div>
  );
}
