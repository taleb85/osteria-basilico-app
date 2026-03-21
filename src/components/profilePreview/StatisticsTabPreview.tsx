import { ChevronDown, FileText } from 'lucide-react';
import type { User, Language } from '../../types';
import { getTranslations } from '../../utils/translations';
import { uiWidgetKeyAppliesToUser } from '../../utils/uiScreenWidgets';
import { WidgetChrome } from './WidgetChrome';

export default function StatisticsTabPreview({
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
      {show('stats.mgmt_filters') && (
      <WidgetChrome
        widgetKey="stats.mgmt_filters"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            {t.stats_preset_current_month}
          </span>
          <button type="button" tabIndex={-1} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600">
            PDF <FileText className="h-3 w-3" />
          </button>
          <span className="text-[10px] text-slate-400">{t.stats_preset_period}</span>
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
            <p className="text-[10px] font-bold uppercase text-slate-400">{t.stats_approved_hours}</p>
            <p className="text-xl font-bold text-slate-900">128:30</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase text-slate-400">{t.stats_estimated_cost}</p>
            <p className="text-xl font-bold text-slate-900">—</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase text-slate-400">{t.pending}</p>
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
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800">
            <span>{t.sidebar_shifts}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </WidgetChrome>
      )}

      {show('stats.table') && (
      <WidgetChrome
        widgetKey="stats.table"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-xs shadow-sm">
          <div className="grid grid-cols-3 gap-px bg-slate-200 font-bold text-slate-600">
            <div className="bg-slate-50 px-2 py-2">{t.stats_preset_period}</div>
            <div className="bg-slate-50 px-2 py-2 text-center">Ore</div>
            <div className="bg-slate-50 px-2 py-2 text-center">Δ</div>
            <div className="bg-white px-2 py-2">W10</div>
            <div className="bg-white px-2 py-2 text-center">40:00</div>
            <div className="bg-white px-2 py-2 text-center text-accent">+2</div>
          </div>
        </div>
      </WidgetChrome>
      )}

      {show('stats.staff_summary') && (
      <WidgetChrome
        widgetKey="stats.staff_summary"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.mod_stats_hours}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">24:00</p>
          <p className="text-xs text-slate-500">{t.stats_preset_current_week}</p>
        </div>
      </WidgetChrome>
      )}
    </div>
  );
}
