import { ChevronDown, ChevronLeft, ChevronRight, FileDown, Moon } from 'lucide-react';
import type { User, Language } from '../../types';
import { getTranslations } from '../../utils/translations';
import { uiWidgetKeyAppliesToUser } from '../../utils/uiScreenWidgets';
import { WidgetChrome } from './WidgetChrome';
import { useApp } from '../../context/appContextCore';
import { getResolvedStartEndForHours } from '../../utils/shiftResolvedClockTimes';
import { format, addDays, startOfWeek } from 'date-fns';

export default function TimesheetTabPreview({
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
  const role = previewUser.role;
  const show = (key: string) => uiWidgetKeyAppliesToUser(role, key);


  // Access context data
  const { shifts, punchRecords } = useApp();

  // Calculate current week days (Mon-Thu for preview)
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const days = Array.from({ length: 4 }, (_, i) => addDays(weekStart, i));

  // For each day, find the shift for previewUser and compute worked hours
  const dailyHours = days.map((day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const shift = shifts.find(
      (s) => s.user_id === previewUser.id && s.date === dateStr
    );
    if (!shift) return '';
    const { start, end } = getResolvedStartEndForHours(shift, punchRecords);
    if (!start || !end) return '';
    // Format as HH:mm–HH:mm
    return `${start}–${end}`;
  });

  return (
    <div className="flex flex-col gap-4 font-sans">
      {show('timesheet.header') && (
      <WidgetChrome
        widgetKey="timesheet.header"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="surface-glass-sm flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-neutral-50">{t.timesheet_title}</h2>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
              {t.stats_preset_current_week}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              tabIndex={-1}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 dark:border-white/10 dark:text-neutral-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 dark:border-white/10 dark:text-neutral-300"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 dark:border-white/10 dark:text-neutral-300"
            >
              <FileDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </WidgetChrome>
      )}

      {show('timesheet.stats_today') && (
      <WidgetChrome
        widgetKey="timesheet.stats_today"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { v: '4', l: t.home_stat_in_shift, b: 'border-teal-100 dark:border-teal-800/40' },
            { v: '1', l: t.home_stat_delays, b: 'border-red-100 dark:border-red-900/40' },
            { v: '0', l: t.home_stat_missing_out, b: 'border-orange-100 dark:border-orange-900/40' },
            { v: '12', l: t.home_stat_approved, b: 'border-accent/20 dark:border-accent/30' },
          ].map((c) => (
            <div key={c.l} className={`surface-glass-sm p-3 text-center ${c.b}`}>
              <p className="text-xl font-bold text-slate-900 dark:text-neutral-50">{c.v}</p>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-neutral-300">{c.l}</p>
            </div>
          ))}
        </div>
      </WidgetChrome>
      )}

      {show('stats.mgmt_kpi_cards') && (
      <WidgetChrome
        widgetKey="stats.mgmt_kpi_cards"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="surface-glass-sm p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-400">{t.stats_approved_hours}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-neutral-50">128:30</p>
          </div>
          <div className="surface-glass-sm p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-400">{t.stats_estimated_cost}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-neutral-50">—</p>
          </div>
          <div className="surface-glass-sm p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-400">{t.pending}</p>
            <p className="text-xl font-bold text-amber-800 dark:text-amber-300">3</p>
          </div>
        </div>
      </WidgetChrome>
      )}

      {show('stats.detail_panels') && (
      <WidgetChrome
        widgetKey="stats.detail_panels"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 dark:border-white/10 dark:bg-neutral-800/60 dark:text-neutral-100">
            <span>{t.mod_stats_hours}</span>
            <ChevronDown className="h-4 w-4 text-slate-400 dark:text-neutral-400" />
          </div>
          <div className="flex items-center justify-between surface-glass-sm px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-neutral-100">
            <span>{t.sidebar_shifts}</span>
            <ChevronDown className="h-4 w-4 text-slate-400 dark:text-neutral-400" />
          </div>
        </div>
      </WidgetChrome>
      )}

      {show('timesheet.dinner_close') && (
      <WidgetChrome
        widgetKey="timesheet.dinner_close"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 px-3 py-3 text-center text-xs text-amber-900/80 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200/90">
          <Moon className="mx-auto mb-1 h-4 w-4 text-amber-600 dark:text-amber-400" />
          {tv.profile_visibility_dinner_placeholder ?? 'Chiusura turni sera'}
        </div>
      </WidgetChrome>
      )}

      {show('timesheet.main_grid') && (
      <WidgetChrome
        widgetKey="timesheet.main_grid"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="surface-glass-sm overflow-hidden">
          <div className="grid grid-cols-[minmax(4rem,1fr)_repeat(4,minmax(0,1fr))] gap-px bg-slate-200 text-[9px]">
            <div className="bg-slate-50 px-1 py-2 font-bold text-slate-500 dark:text-neutral-300">Staff</div>
            {['Lun', 'Mar', 'Mer', 'Gio'].map((d) => (
              <div key={d} className="bg-slate-50 py-2 text-center font-bold text-slate-500 dark:text-neutral-300">
                {d}
              </div>
            ))}
            <div className="contents">
              <div className="bg-slate-50 px-2 py-2 font-semibold text-slate-700 dark:bg-neutral-900 dark:text-neutral-200">{previewUser.first_name}</div>
              {dailyHours.map((hours, i) => (
                <div key={i} className="min-h-[36px] bg-slate-50 p-0.5 dark:bg-neutral-900 text-center">
                  {hours || <span className="text-slate-300 dark:text-neutral-700">—</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </WidgetChrome>
      )}

      {show('timesheet.staff_summary_box') && (
      <WidgetChrome
        widgetKey="timesheet.staff_summary_box"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="rounded-xl border border-accent/25 bg-accent/5 p-4 dark:border-accent/35 dark:bg-accent/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent-dark/80 dark:text-accent-light/90">{t.timesheet_my_week}</p>
          <p className="mt-1 text-lg font-bold text-slate-900 dark:text-neutral-50">32:00</p>
          <p className="text-xs text-slate-600 dark:text-neutral-400">{t.shifts_week}</p>
        </div>
      </WidgetChrome>
      )}
    </div>
  );
}
