import { Calendar, Clock } from 'lucide-react';
import type { User, Language } from '../../types';
import { getTranslations } from '../../utils/translations';
import { WidgetChrome } from './WidgetChrome';

export default function StaffShiftsPreview({
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
        widgetKey="staff_shifts.summary"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="surface-glass p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-400">{t.approved_hours_summary}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-neutral-50">24:00</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-300">{t.hours_this_month}</p>
        </div>
      </WidgetChrome>

      <WidgetChrome
        widgetKey="staff_shifts.table"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="surface-glass overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 dark:border-white/10">
            <Calendar className="h-4 w-4 text-slate-400 dark:text-neutral-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-neutral-200">{t.sidebar_shifts}</span>
          </div>
          <div className="divide-y divide-slate-50 p-2 dark:divide-white/5">
            {[
              { d: 'Lun 10', h: '10:00 – 16:00' },
              { d: 'Mar 11', h: '18:00 – 23:00' },
              { d: 'Mer 12', h: '12:00 – 18:00' },
            ].map((row) => (
              <div key={row.d} className="flex items-center justify-between gap-2 px-2 py-2.5 text-sm">
                <span className="font-semibold text-slate-800 dark:text-neutral-100">{row.d}</span>
                <span className="flex items-center gap-1 text-slate-600 dark:text-neutral-400">
                  <Clock className="h-3.5 w-3.5" />
                  {row.h}
                </span>
              </div>
            ))}
          </div>
        </div>
      </WidgetChrome>
    </div>
  );
}
