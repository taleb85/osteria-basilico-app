/**
 * Scheda Impostazioni — attiva/disattiva le funzioni disponibili per i profili.
 * Solo Admin. Le modifiche sono immediate e salvate in DB o localStorage.
 */
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid,
  Building2,
  ShieldAlert,
  Zap,
  Coffee,
  ChevronDown,
  Users,
  MapPin,
  Bell,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslations, getFeatureStrings, formatTrans } from '../utils/translations';
import { isAdminOnly } from '../utils/permissions';
import { translateRole } from '../utils/roles';
import { FEATURE_DEFINITIONS } from '../utils/featureFlags';
import { RoleFeatureTemplatesPanel } from './RoleFeatureTemplatesPage';
import { supabase } from '../lib/supabase';

const IMPOSTAZIONI_GROUPS: readonly {
  readonly titleKey: 'impostazioni_group_org' | 'impostazioni_group_rules' | 'impostazioni_group_tools';
  readonly slugs: readonly string[];
}[] = [
  { titleKey: 'impostazioni_group_org', slugs: ['department_creation'] },
  { titleKey: 'impostazioni_group_rules', slugs: ['violation_rules', 'auto_breaks', 'geofence_punch'] },
  { titleKey: 'impostazioni_group_tools', slugs: ['visibility_management', 'master_control_panel'] },
];

const SLUG_ICONS: Record<string, typeof LayoutGrid> = {
  visibility_management: LayoutGrid,
  department_creation: Building2,
  violation_rules: ShieldAlert,
  master_control_panel: Zap,
  auto_breaks: Coffee,
  geofence_punch: MapPin,
};

type ImpostazioniPageProps = {
  onOpenProfilesTab?: () => void;
};

export default function ImpostazioniPage({ onOpenProfilesTab }: ImpostazioniPageProps) {
  const {
    currentUser,
    featureFlags,
    setFeatureFlag,
    effectiveLanguage,
    showSuccess,
    showError,
    logout,
    isSessionElevated,
  } = useApp();
  const t = getTranslations(effectiveLanguage);
  const [howOpen, setHowOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState<Record<string, boolean>>({});
  const [teamNotifyLoading, setTeamNotifyLoading] = useState(false);

  useEffect(() => {
    // Chiudi tutti i dettagli all'avvio per la modalità compatta
    setDetailOpen({});
  }, []);

  const toggleDetail = useCallback((slug: string) => {
    setDetailOpen((prev) => ({ ...prev, [slug]: !prev[slug] }));
  }, []);

  const handleNotifyTeam = useCallback(async () => {
    const tr = getTranslations(effectiveLanguage);
    if (!supabase || !currentUser?.id) {
      showError?.(tr.admin_notify_team_error);
      return;
    }
    setTeamNotifyLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('notify-team-next-week-shifts', {
        body: { operator_user_id: currentUser.id },
      });
      if (error) {
        showError?.(error.message || tr.admin_notify_team_error);
        return;
      }
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        showError?.(String(data.error));
        return;
      }
      const rec = typeof (data as { recipients?: number }).recipients === 'number' ? (data as { recipients: number }).recipients : 0;
      const sent = typeof (data as { sent?: number }).sent === 'number' ? (data as { sent: number }).sent : 0;
      const ws = String((data as { week_start?: string }).week_start ?? '');
      const we = String((data as { week_end?: string }).week_end ?? '');
      if (rec === 0) {
        showSuccess?.(tr.admin_notify_team_none);
      } else {
        showSuccess?.(
          formatTrans(tr.admin_notify_team_success, {
            count: rec,
            sent,
            week_start: ws,
            week_end: we,
          })
        );
      }
    } catch {
      showError?.(getTranslations(effectiveLanguage).admin_notify_team_error);
    } finally {
      setTeamNotifyLoading(false);
    }
  }, [currentUser?.id, effectiveLanguage, showError, showSuccess]);



  if (!currentUser) return null;
  const hasFullAccess = isAdminOnly(currentUser) || isSessionElevated || !!currentUser.elevated_role;
  if (!hasFullAccess) {
    return (
      <div className="pb-content pt-6 w-full app-horizontal-pad font-sans">
        <div className="surface-glass-sm p-4 rounded-xl mb-6">
          <h2 className="text-lg font-bold mb-1">{t.settings_current_user || 'Utente attuale'}</h2>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-accent">{currentUser.first_name} {currentUser.last_name}</span>
            <span className="text-xs bg-slate-200 dark:bg-neutral-700 rounded px-2 py-0.5 ml-2">{translateRole(currentUser.role, effectiveLanguage as 'it' | 'en' | 'es' | 'fr')}</span>
          </div>
          <button
            className="mt-3 px-3 py-1.5 rounded bg-red-100 text-red-700 font-semibold hover:bg-red-200"
            onClick={logout}
          >
            {t.logout || 'Logout'}
          </button>
        </div>
        <p className="text-slate-600 text-sm">{t.no_access_settings}</p>
      </div>
    );
  }

  const renderCard = (slug: string) => {
    const def = FEATURE_DEFINITIONS.find((f) => f.slug === slug);
    const enabled = featureFlags[slug] ?? (def?.defaultEnabled ?? true);
    const Icon = SLUG_ICONS[slug] ?? Zap;
    const { label, description, detailLines } = getFeatureStrings(t, slug);
    const detailsExpanded = detailOpen[slug] === true;
    const hasDetails = detailLines.length > 0;

    return (
      <div
        key={slug}
        className="surface-glass-sm flex h-full flex-col p-3.5 transition-colors surface-ghost-interactive hover:border-slate-300/90 dark:hover:border-white/15 sm:p-4"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-[18px] h-[18px] text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight text-slate-800 dark:text-neutral-100">{label}</p>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-neutral-300 mt-1 leading-snug">{description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={label}
                onClick={async () => {
                  const next = !enabled;
                  await setFeatureFlag?.(slug, next);
                  showSuccess?.(
                    formatTrans(next ? t.settings_feature_toggle_on : t.settings_feature_toggle_off, {
                      name: label,
                    })
                  );
                }}
                className={`relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:ring-offset-2 dark:focus:ring-offset-neutral-900 ${enabled ? 'bg-accent' : 'bg-slate-200 dark:bg-neutral-600'}`}
              >
                <span
                  className={`pointer-events-none absolute top-0 left-0 h-5 w-5 rounded-full bg-white toggle-knob shadow transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>

            {hasDetails && (
              <>
                <button
                  type="button"
                  aria-expanded={detailsExpanded}
                  onClick={() => toggleDetail(slug)}
                  className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-accent hover:text-accent/80"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${detailsExpanded ? 'rotate-180' : ''}`}
                  />
                  {t.impostazioni_toggle_details}
                </button>
                <AnimatePresence initial={false}>
                  {detailsExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="surface-glass-sm mt-2 bg-slate-50/40 px-2.5 py-2 dark:bg-neutral-900/30">
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-300">
                          {t.impostazioni_detail_label}
                        </p>
                        <ul className="list-disc space-y-1 pl-3.5 text-[11px] leading-relaxed text-slate-600 dark:text-neutral-300">
                          {detailLines.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="pb-content pt-6 w-full app-horizontal-pad font-sans">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="max-w-5xl"
      >
        {/* Sezione utente attuale */}
        <div className="surface-glass-sm p-4 rounded-xl mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold mb-1">{t.settings_current_user || 'Utente attuale'}</h2>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-accent">{currentUser.first_name} {currentUser.last_name}</span>
              <span className="text-xs bg-slate-200 dark:bg-neutral-700 rounded px-2 py-0.5 ml-2">{translateRole(currentUser.role, effectiveLanguage as 'it' | 'en' | 'es' | 'fr')}</span>
            </div>
          </div>
          <button
            className="px-3 py-1.5 rounded bg-red-100 text-red-700 font-semibold hover:bg-red-200"
            onClick={logout}
          >
            {t.logout || 'Logout'}
          </button>
        </div>

        {/* Divider */}
        <div className="h-0.5 bg-slate-200 dark:bg-neutral-800 rounded my-6" />

        {/* Sezione gestione utenti */}
        {onOpenProfilesTab && (
          <div className="surface-glass-sm p-4 rounded-xl mb-6">
            <h2 className="text-md font-bold mb-2 flex items-center gap-2"><Users className="w-4 h-4" />{t.impostazioni_open_profiles || 'Gestione utenti'}</h2>
            <button
              type="button"
              onClick={onOpenProfilesTab}
              className="inline-flex items-center gap-1.5 self-start rounded-lg border border-accent/25 bg-accent/[0.07] px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/12 transition-colors"
            >
              <Users className="w-3.5 h-3.5 opacity-80" />
              {t.impostazioni_open_profiles}
            </button>
          </div>
        )}

        <div className="surface-glass-sm p-4 rounded-xl mb-6">
          <h2 className="text-md font-bold mb-1 flex items-center gap-2">
            <Bell className="w-4 h-4 text-accent" />
            {t.admin_notify_team_title}
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-600 dark:text-neutral-400 mb-3 leading-relaxed">
            {t.admin_notify_team_desc}
          </p>
          <button
            type="button"
            disabled={teamNotifyLoading}
            onClick={() => void handleNotifyTeam()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/25 bg-accent/[0.07] px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/12 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            <Bell className="w-3.5 h-3.5 opacity-80" />
            {teamNotifyLoading ? '…' : t.admin_notify_team_button}
          </button>
        </div>

        {/* Sezione funzionalità e regole */}
        <div className="space-y-6">
          {IMPOSTAZIONI_GROUPS.map((group) => (
            <section key={group.titleKey}>
              <h2 className="ui-section-title mb-2.5 text-slate-400 dark:text-neutral-400">
                {t[group.titleKey]}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{group.slugs.map((slug) => renderCard(slug))}</div>
            </section>
          ))}
        </div>

      </motion.div>
    </div>
  );
}
