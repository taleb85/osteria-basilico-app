/**
 * Anteprima visiva della Home gestionale (stesso layout di HomePage) per Admin → Cosa vede chi.
 * Dati dimostrativi fissi; i toggle rispettano ui_section_overrides sul profilo selezionato.
 */
import { format } from 'date-fns';
import {
  Users,
  Clock,
  AlertCircle,
  UserCheck,
  Calendar,
  TrendingUp,
  Palmtree,
  Megaphone,
  Pencil,
  ArrowRight,
  Moon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { User, Language } from '../types';
import { isPurelyManagementRole } from '../utils/permissions';
import { getTranslations } from '../utils/translations';
import { formatMinutesToHoursAndMinutes } from '../utils/timeCalculations';
import { HomeManagementShiftCard, type HomeManagementShiftCardProps } from './HomePage';
import { WidgetChrome } from './profilePreview/WidgetChrome';

type ShiftEntry = HomeManagementShiftCardProps['e'];

export default function ManagementHomePreview({
  previewUser,
  language,
  isSelectedAdmin,
  staffRequestsEnabled,
  onUiToggle,
  embedded = false,
}: {
  previewUser: User;
  language: Language;
  isSelectedAdmin: boolean;
  staffRequestsEnabled: boolean;
  onUiToggle: (key: string, visible: boolean) => void;
  /** Se true, niente cornice esterna (usa ProfileTabRichPreview). */
  embedded?: boolean;
}) {
  const t = getTranslations(language);
  const tv = t as Record<string, string>;
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  const styleApproved: HomeManagementShiftCardProps['style'] = {
    border: 'border-l-accent',
    bg: 'bg-accent/5',
    badge: 'bg-accent/10 text-accent-dark border-accent/20',
    dot: 'bg-accent',
    label: t.home_status_approved,
  };

  const demoJean: ShiftEntry = {
    shift: { id: 'pv-jean', start_time: '10:00:00', end_time: '16:00:00', approval_status: 'approved', date: todayStr },
    user: { first_name: 'Jean', department: 'Bar' },
    isDinner: false,
    punchIn: null,
    actualStart: null,
    actualEnd: null,
    scheduledStart: '10:00',
    scheduledEnd: '16:00',
    scheduledMins: 360,
    actualMins: 0,
    deltaMins: 0,
    isLate: false,
    hasMissingOut: false,
    isApproved: true,
    canApprove: false,
    canClose: false,
  };

  const demoJohn: ShiftEntry = {
    shift: { id: 'pv-john', start_time: '18:00:00', end_time: '23:00:00', approval_status: 'approved', date: todayStr },
    user: { first_name: 'John', department: 'Sala' },
    isDinner: true,
    punchIn: { id: 'pv-p1' },
    actualStart: '18:05',
    actualEnd: '23:00',
    scheduledStart: '18:00',
    scheduledEnd: '23:00',
    scheduledMins: 300,
    actualMins: 295,
    deltaMins: -5,
    isLate: false,
    hasMissingOut: false,
    isApproved: true,
    canApprove: false,
    canClose: false,
  };

  const attendancePercent = 50;
  const hoursPercent = 0;
  const weeklyMinutesDemo = 0;
  const shiftsWeekDemo = 2;

  const hiddenBadge = tv.profile_visibility_ui_hidden_badge ?? 'Nascosto';

  const body = (
      <div className="flex flex-col gap-5 font-sans">
        <WidgetChrome
          widgetKey="home_mgmt.header"
          previewUser={previewUser}
          isSelectedAdmin={isSelectedAdmin}
          onUiToggle={onUiToggle}
          hiddenBadge={hiddenBadge}
        >
          <div className="pt-1 min-h-[2px]" aria-hidden />
        </WidgetChrome>

        {isPurelyManagementRole(previewUser.role) && (
          <WidgetChrome
            widgetKey="home_mgmt.admin_banner"
            previewUser={previewUser}
            isSelectedAdmin={isSelectedAdmin}
            onUiToggle={onUiToggle}
            hiddenBadge={hiddenBadge}
          >
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200">
                <Users className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Profilo Gestionale</p>
                <p className="text-xs text-slate-500">Nessun turno assegnato — accesso solo alla gestione</p>
              </div>
            </div>
          </WidgetChrome>
        )}

        <WidgetChrome
          widgetKey="home_mgmt.team_board"
          previewUser={previewUser}
          isSelectedAdmin={isSelectedAdmin}
          onUiToggle={onUiToggle}
          hiddenBadge={hiddenBadge}
        >
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3">
            <div className="flex items-start gap-3">
              <Megaphone size={15} className="mt-0.5 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="text-xs italic text-slate-400">{t.home_board_empty}</p>
              </div>
              <button type="button" tabIndex={-1} className="shrink-0 rounded-xl p-1.5 text-slate-400">
                <Pencil size={13} />
              </button>
            </div>
          </div>
        </WidgetChrome>

        <WidgetChrome
          widgetKey="home_mgmt.stats_bar"
          previewUser={previewUser}
          isSelectedAdmin={isSelectedAdmin}
          onUiToggle={onUiToggle}
          hiddenBadge={hiddenBadge}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: t.home_stat_in_shift, value: 0, Icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
              { label: t.home_stat_delays, value: 0, Icon: Clock, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-100' },
              { label: t.home_stat_missing_out, value: 0, Icon: AlertCircle, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-100' },
              { label: t.home_stat_approved, value: 2, Icon: UserCheck, color: 'text-accent', bg: 'bg-accent/8', border: 'border-accent/20' },
            ].map(({ label, value, Icon, color, bg, border }) => (
              <div key={label} className={`flex items-center gap-3 rounded-2xl border ${border} ${bg} px-4 py-3.5`}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${border} ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none text-slate-900">{value}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </WidgetChrome>

        <WidgetChrome
          widgetKey="home_mgmt.dinner_close"
          previewUser={previewUser}
          isSelectedAdmin={isSelectedAdmin}
          onUiToggle={onUiToggle}
          hiddenBadge={hiddenBadge}
        >
          <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 px-4 py-3 text-center text-xs text-indigo-800/80">
            <Moon className="mx-auto mb-1 h-4 w-4 text-indigo-500" />
            {tv.profile_visibility_dinner_placeholder ?? 'Chiusura turni sera — in app compare solo se serve'}
          </div>
        </WidgetChrome>

        <WidgetChrome
          widgetKey="home_mgmt.critical"
          previewUser={previewUser}
          isSelectedAdmin={isSelectedAdmin}
          onUiToggle={onUiToggle}
          hiddenBadge={hiddenBadge}
        >
          <div className="rounded-2xl border border-dashed border-red-200 bg-red-50/40 px-4 py-3 text-center text-xs text-red-800/80">
            <AlertCircle className="mx-auto mb-1 h-4 w-4 text-red-500" />
            {tv.profile_visibility_critical_placeholder ?? 'Richiedono attenzione — in app compare solo se ci sono anomalie'}
          </div>
        </WidgetChrome>

        <WidgetChrome
          widgetKey="home_mgmt.today_shifts"
          previewUser={previewUser}
          isSelectedAdmin={isSelectedAdmin}
          onUiToggle={onUiToggle}
          hiddenBadge={hiddenBadge}
        >
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-bold text-slate-800">{t.home_todays_shifts}</h2>
              <span className="ml-1 text-[11px] text-slate-400">(2)</span>
              <span className="ml-auto flex items-center gap-0.5 text-xs font-semibold text-accent">
                {t.home_see_all_shifts} <ArrowRight className="h-3 w-3" />
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <HomeManagementShiftCard
                e={demoJean}
                style={styleApproved}
                isManager={false}
                onClose={() => {}}
                onApprove={() => {}}
                approvingId={null}
                t={t as Record<string, string>}
              />
              <HomeManagementShiftCard
                e={demoJohn}
                style={styleApproved}
                isManager={false}
                onClose={() => {}}
                onApprove={() => {}}
                approvingId={null}
                t={t as Record<string, string>}
              />
            </div>
          </div>
        </WidgetChrome>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <WidgetChrome
            widgetKey="home_mgmt.card_presenze"
            previewUser={previewUser}
            isSelectedAdmin={isSelectedAdmin}
            onUiToggle={onUiToggle}
            hiddenBadge={hiddenBadge}
          >
            <div className="cursor-default rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">{t.home_section_attendance}</h3>
                <TrendingUp className="h-4 w-4 text-slate-400" />
              </div>
              <div className="space-y-3">
                {[
                  { label: t.home_attendance_today, pct: attendancePercent, color: 'bg-accent' },
                  { label: t.home_hours_this_week, pct: hoursPercent, color: 'bg-blue-500' },
                ].map(({ label, pct, color }) => (
                  <div key={label}>
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="font-medium text-slate-500">{label}</span>
                      <span className="font-bold text-slate-700">{pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.15, duration: 0.5, ease: 'easeOut' }}
                        className={`h-full rounded-full ${color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </WidgetChrome>

          <WidgetChrome
            widgetKey="home_mgmt.card_ferie"
            previewUser={previewUser}
            isSelectedAdmin={isSelectedAdmin}
            onUiToggle={onUiToggle}
            hiddenBadge={hiddenBadge}
          >
            <div className="cursor-default rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">{t.home_holidays_section}</h3>
                <Palmtree className="h-4 w-4 text-accent" />
              </div>
              {staffRequestsEnabled ? (
                <p className="py-4 text-center text-xs text-slate-400">{t.home_no_requests}</p>
              ) : (
                <p className="py-4 text-center text-xs text-amber-700">
                  {tv.profile_visibility_ferie_global_disabled ?? 'Richieste ferie disattivate globalmente — il blocco non compare in app.'}
                </p>
              )}
            </div>
          </WidgetChrome>

          <WidgetChrome
            widgetKey="home_mgmt.card_kpi"
            previewUser={previewUser}
            isSelectedAdmin={isSelectedAdmin}
            onUiToggle={onUiToggle}
            hiddenBadge={hiddenBadge}
          >
            <div className="flex flex-col gap-3">
              <div className="cursor-default rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <TrendingUp className="h-4 w-4 text-slate-400" />
                  <span className="text-[10px] font-semibold uppercase text-slate-400">{t.home_kpi_hours_week}</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">{formatMinutesToHoursAndMinutes(weeklyMinutesDemo)}</p>
              </div>
              <div className="cursor-default rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span className="text-[10px] font-semibold uppercase text-slate-400">{t.home_kpi_shifts_week}</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">{shiftsWeekDemo}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{t.home_today}</p>
              </div>
            </div>
          </WidgetChrome>
        </div>

      </div>
  );

  if (embedded) return body;

  return (
    <div className="w-full max-w-3xl rounded-[1.75rem] border-[3px] border-slate-800 bg-[#f8fafc] p-3 shadow-2xl sm:p-4">
      <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {tv.profile_visibility_mock_realistic_label ?? 'Anteprima — Home gestionale (dati dimostrativi)'}
      </p>
      {body}
    </div>
  );
}
