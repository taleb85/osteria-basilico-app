import { ChevronDown, ChevronLeft, ChevronRight, FileDown, Moon, UserCheck } from 'lucide-react';
import type { User, Language } from '../../types';
import { getTranslations } from '../../utils/translations';
import { uiWidgetKeyAppliesToUser } from '../../utils/uiScreenWidgets';
import { WidgetChrome } from './WidgetChrome';

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
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">{t.timesheet_title}</h2>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
              {t.stats_preset_current_week}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" tabIndex={-1} className="rounded-lg border border-slate-200 p-1.5 text-slate-600">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" tabIndex={-1} className="rounded-lg border border-slate-200 p-1.5 text-slate-600">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button type="button" tabIndex={-1} className="rounded-lg border border-slate-200 p-1.5 text-slate-600">
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { v: '4', l: t.home_stat_in_shift },
            { v: '1', l: t.home_stat_delays },
            { v: '12', l: t.home_stat_approved },
          ].map((c) => (
            <div key={c.l} className="rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm">
              <p className="text-xl font-bold text-slate-900">{c.v}</p>
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
          <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-400">{t.stats_approved_hours}</p>
            <p className="text-xl font-bold text-slate-900">128:30</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-400">{t.stats_estimated_cost}</p>
            <p className="text-xl font-bold text-slate-900">—</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-400">{t.pending}</p>
            <p className="text-xl font-bold text-amber-800">3</p>
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
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800">
            <span>{t.mod_stats_hours}</span>
            <ChevronDown className="h-4 w-4 text-slate-400 dark:text-neutral-400" />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800">
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

      {show('timesheet.ready_approval') && (
      <WidgetChrome
        widgetKey="timesheet.ready_approval"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs font-semibold text-amber-900">
          <UserCheck className="h-4 w-4 shrink-0" />
          {t.timesheet_approve_all}
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
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(4rem,1fr)_repeat(4,minmax(0,1fr))] gap-px bg-slate-200 text-[9px]">
            <div className="bg-slate-50 px-1 py-2 font-bold text-slate-500 dark:text-neutral-300">Staff</div>
            {['Lun', 'Mar', 'Mer', 'Gio'].map((d) => (
              <div key={d} className="bg-slate-50 py-2 text-center font-bold text-slate-500 dark:text-neutral-300">
                {d}
              </div>
            ))}
            {['Jean', 'John'].map((nm) => (
              <div key={nm} className="contents">
                <div className="bg-white px-2 py-2 font-semibold text-slate-700">{nm}</div>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="min-h-[36px] bg-white p-0.5">
                    {i === 1 && (
                      <div className="rounded bg-accent/12 py-1 text-center text-[8px] font-bold text-accent">8h</div>
                    )}
                  </div>
                ))}
              </div>
            ))}
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
        <div className="rounded-xl border border-accent/25 bg-accent/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent-dark/80">{t.timesheet_my_week}</p>
          <p className="mt-1 text-lg font-bold text-slate-900">32:00</p>
          <p className="text-xs text-slate-600">{t.shifts_week}</p>
        </div>
      </WidgetChrome>
      )}
    </div>
  );
}
