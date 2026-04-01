import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, RotateCcw, Save, Loader2, Users, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { canEditRoleFeatureTemplates } from '../utils/permissions';
import {
  ADMIN_MODULE_KEYS,
  type EnabledFeatures,
  type EnabledFeatureKey,
  type AdminModuleKey,
  buildMergedTemplateForAdminEditor,
  serializeTemplateGroupForDisk,
  buildMergedAdminModulesForAdminEditor,
  getTemplateGroupTeamScheduleVisible,
  buildMergedOperationalTemplateForGroup,
  type SettingsOperationalPermKey,
} from '../utils/enabledFeatures';
import RoleFeatureSectionsBlock from './RoleFeatureSectionsBlock';
import AdminRow from './ui/AdminRow';
import { getRoleFeatureTemplatesCache, type RoleFeatureTemplatesOnDisk, type RoleTemplateGroup } from '../utils/roleFeatureTemplates';
import { serializeAdminModulesForDisk } from '../utils/adminModulesGlobal';
import { getAdminModuleLabel, getTranslations } from '../utils/translations';
import { buildSettingsPermissionRows } from '../utils/settingsPermissionRows';
import { operationalPayloadForUser } from '../utils/roleTemplateUserSync';

const ACCENT = 'var(--brand)';
function roleGroupExpandedStorageKey(g: RoleTemplateGroup) {
  return `osteria_rtg_expanded_${g}`;
}

function readRoleGroupExpanded(g: RoleTemplateGroup): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(roleGroupExpandedStorageKey(g)) !== '0';
  } catch {
    return true;
  }
}

export type RoleFeatureTemplatesPanelVariant = 'page' | 'embedded';

function groupTitle(g: RoleTemplateGroup, tv: Record<string, string>): string {
  if (g === 'management') return tv.role_group_management ?? 'Manager';
  if (g === 'capo') return tv.role_group_capo ?? 'Capo';
  return tv.role_group_staff ?? 'Staff';
}

type Props = { variant?: RoleFeatureTemplatesPanelVariant };

/** Template permessi per gruppo ruolo + moduli scheda Admin. Usabile in pagina dedicata o dentro Impostazioni. */
export function RoleFeatureTemplatesPanel({ variant = 'page' }: Props) {
  const {
    currentUser,
    effectiveLanguage,
    saveRoleFeatureTemplates,
    saveAdminModulesGlobal,
    showSuccess,
    showError,
    roleTemplatesRevision,
    adminModulesRevision,
    users,
    updateUser,
  } = useApp();
  const t = getTranslations(effectiveLanguage);
  const permRows = useMemo(() => buildSettingsPermissionRows(t as Record<string, string>), [t]);

  const [mgmt, setMgmt] = useState<EnabledFeatures>(() =>
    buildMergedTemplateForAdminEditor('management', getRoleFeatureTemplatesCache())
  );
  const [capo, setCapo] = useState<EnabledFeatures>(() =>
    buildMergedTemplateForAdminEditor('capo', getRoleFeatureTemplatesCache())
  );
  const [staff, setStaff] = useState<EnabledFeatures>(() =>
    buildMergedTemplateForAdminEditor('staff', getRoleFeatureTemplatesCache())
  );
  const [teamScheduleMgmt, setTeamScheduleMgmt] = useState(true);
  const [teamScheduleCapo, setTeamScheduleCapo] = useState(true);
  const [teamScheduleStaff, setTeamScheduleStaff] = useState(true);
  const [opMgmt, setOpMgmt] = useState<Record<SettingsOperationalPermKey, boolean>>(() =>
    buildMergedOperationalTemplateForGroup('management', getRoleFeatureTemplatesCache())
  );
  const [opCapo, setOpCapo] = useState<Record<SettingsOperationalPermKey, boolean>>(() =>
    buildMergedOperationalTemplateForGroup('capo', getRoleFeatureTemplatesCache())
  );
  const [opStaff, setOpStaff] = useState<Record<SettingsOperationalPermKey, boolean>>(() =>
    buildMergedOperationalTemplateForGroup('staff', getRoleFeatureTemplatesCache())
  );
  const [mods, setMods] = useState<Record<AdminModuleKey, boolean>>(() => buildMergedAdminModulesForAdminEditor());
  const [saving, setSaving] = useState(false);
  /**
   * Evita che `roleTemplatesRevision` / `adminModulesRevision` (sync Storage, pull-to-refresh, altro device)
   * sovrascrivano i toggle non ancora salvati con `Salva tutto`.
   */
  const templatePanelDirtyRef = useRef(false);
  const markTemplatePanelDirty = useCallback(() => {
    templatePanelDirtyRef.current = true;
  }, []);

  const [roleGroupExpanded, setRoleGroupExpanded] = useState<Record<RoleTemplateGroup, boolean>>(() => ({
    management: false,
    capo: false,
    staff: false,
  }));

  const toggleRoleGroupExpanded = useCallback((group: RoleTemplateGroup) => {
    setRoleGroupExpanded((prev) => {
      const next = !prev[group];
      try {
        window.localStorage.setItem(roleGroupExpandedStorageKey(group), next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return { ...prev, [group]: next };
    });
  }, []);

  useEffect(() => {
    if (templatePanelDirtyRef.current) return;
    const disk = getRoleFeatureTemplatesCache();
    setMgmt(buildMergedTemplateForAdminEditor('management', disk));
    setCapo(buildMergedTemplateForAdminEditor('capo', disk));
    setStaff(buildMergedTemplateForAdminEditor('staff', disk));
    setTeamScheduleMgmt(getTemplateGroupTeamScheduleVisible('management', disk));
    setTeamScheduleCapo(getTemplateGroupTeamScheduleVisible('capo', disk));
    setTeamScheduleStaff(getTemplateGroupTeamScheduleVisible('staff', disk));
    setOpMgmt(buildMergedOperationalTemplateForGroup('management', disk));
    setOpCapo(buildMergedOperationalTemplateForGroup('capo', disk));
    setOpStaff(buildMergedOperationalTemplateForGroup('staff', disk));
  }, [roleTemplatesRevision]);

  useEffect(() => {
    if (templatePanelDirtyRef.current) return;
    setMods(buildMergedAdminModulesForAdminEditor());
  }, [adminModulesRevision]);

  const toggleRole = useCallback(
    (group: RoleTemplateGroup, key: EnabledFeatureKey) => {
      markTemplatePanelDirty();
      const upd = (prev: EnabledFeatures) => ({ ...prev, [key]: !(prev[key] === true) });
      if (group === 'management') setMgmt(upd);
      else if (group === 'capo') setCapo(upd);
      else setStaff(upd);
    },
    [markTemplatePanelDirty]
  );

  const toggleOperational = useCallback(
    (group: RoleTemplateGroup, key: SettingsOperationalPermKey) => {
      markTemplatePanelDirty();
      const apply = (prev: Record<SettingsOperationalPermKey, boolean>) => ({
        ...prev,
        [key]: !prev[key],
      });
      if (group === 'management') setOpMgmt(apply);
      else if (group === 'capo') setOpCapo(apply);
      else setOpStaff(apply);
    },
    [markTemplatePanelDirty]
  );

  const toggleMod = useCallback(
    (key: AdminModuleKey) => {
      markTemplatePanelDirty();
      setMods((m) => ({ ...m, [key]: !m[key] }));
    },
    [markTemplatePanelDirty]
  );

  const resetMods = useCallback(() => {
    markTemplatePanelDirty();
    setMods(Object.fromEntries(ADMIN_MODULE_KEYS.map((k) => [k, true])) as Record<AdminModuleKey, boolean>);
  }, [markTemplatePanelDirty]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const disk: RoleFeatureTemplatesOnDisk = {
        management: serializeTemplateGroupForDisk(mgmt, teamScheduleMgmt, opMgmt),
        capo: serializeTemplateGroupForDisk(capo, teamScheduleCapo, opCapo),
        staff: serializeTemplateGroupForDisk(staff, teamScheduleStaff, opStaff),
      };
      await saveRoleFeatureTemplates(disk);
      await saveAdminModulesGlobal(serializeAdminModulesForDisk(mods));

      const opTemplates = { management: opMgmt, capo: opCapo, staff: opStaff };
      for (const u of users) {
        const payload = operationalPayloadForUser(u, opTemplates);
        if (payload && Object.keys(payload).length > 0) {
          await updateUser(u.id, payload);
        }
      }

      templatePanelDirtyRef.current = false;
      showSuccess?.(t.role_templates_save_success);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : t.role_templates_save_error;
      showError?.(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!canEditRoleFeatureTemplates(currentUser)) {
    if (variant === 'embedded') return null;
    return (
      <div className="pb-content pt-6 app-horizontal-pad">
        <p className="text-sm text-slate-600 dark:text-neutral-300">{t.role_templates_forbidden_body}</p>
      </div>
    );
  }

  const getTeamScheduleVisible = (g: RoleTemplateGroup) => {
    if (g === 'management') return teamScheduleMgmt;
    if (g === 'capo') return teamScheduleCapo;
    return teamScheduleStaff;
  };
  const setTeamScheduleVisible = (g: RoleTemplateGroup, v: boolean) => {
    markTemplatePanelDirty();
    if (g === 'management') setTeamScheduleMgmt(v);
    else if (g === 'capo') setTeamScheduleCapo(v);
    else setTeamScheduleStaff(v);
  };

  const getOp = (g: RoleTemplateGroup) => {
    if (g === 'management') return opMgmt;
    if (g === 'capo') return opCapo;
    return opStaff;
  };

  const switchRowClass =
    'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-neutral-900';

  const renderAdminModulesBlock = () => (
    <div className="border-t border-slate-100 pt-3 dark:border-white/10">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-400">
        {t.role_templates_admin_modules_heading}
      </p>
      <p className="mb-2 text-[11px] text-slate-500 dark:text-neutral-300">{t.role_templates_admin_modules_hint}</p>
      <div className="surface-glass-sm overflow-hidden">
        {ADMIN_MODULE_KEYS.map((key) => {
          const enabled = mods[key] === true;
          return (
            <AdminRow
              key={key}
              label={getAdminModuleLabel(key, t as Record<string, string>)}
              action={
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => toggleMod(key)}
                  className={`${switchRowClass} ${enabled ? '' : 'bg-slate-200 dark:bg-neutral-600'}`}
                  style={
                    enabled
                      ? { backgroundColor: ACCENT, ['--tw-ring-color' as string]: `${ACCENT}40` }
                      : { ['--tw-ring-color' as string]: `${ACCENT}40` }
                  }
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white toggle-knob shadow transition ${
                      enabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              }
            />
          );
        })}
      </div>
      <button
        type="button"
        onClick={resetMods}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      >
        <RotateCcw className="w-3 h-3" />
        Moduli: tutti attivi
      </button>
    </div>
  );

  const renderOperationalBlock = (group: RoleTemplateGroup) => {
    const op = getOp(group);
    return (
      <div className="border-t border-slate-100 pt-3 dark:border-white/10">
        <p className="ui-section-title mb-2 text-slate-400 dark:text-neutral-400">{t.role_templates_operational_heading}</p>
        <p className="mb-2 text-[11px] text-slate-500 dark:text-neutral-300">{t.role_templates_operational_hint}</p>
        <div className="surface-glass-sm overflow-hidden">
          {permRows.map((perm) => {
            const enabled = op[perm.key] === true;
            return (
              <AdminRow
                key={perm.key}
                label={perm.label}
                description={perm.description}
                badge={
                  perm.adminOnly ? (
                    <span className="text-[9px] font-bold text-accent border border-accent/30 bg-accent/8 rounded-xl px-1.5 py-0.5 uppercase tracking-wider">
                      {t.role_templates_badge_management}
                    </span>
                  ) : undefined
                }
                action={
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => toggleOperational(group, perm.key)}
                    className={`${switchRowClass} ${enabled ? '' : 'bg-slate-200 dark:bg-neutral-600'}`}
                    style={
                      enabled
                        ? { backgroundColor: ACCENT, ['--tw-ring-color' as string]: `${ACCENT}40` }
                        : { ['--tw-ring-color' as string]: `${ACCENT}40` }
                    }
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white toggle-knob shadow transition ${
                        enabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                }
              />
            );
          })}
        </div>
      </div>
    );
  };

  const renderGroup = (group: RoleTemplateGroup, state: EnabledFeatures) => {
    const expanded = roleGroupExpanded[group];
    // Funzioni per attivare/disattivare tutto
    const allKeys = Object.keys(state).filter((k) => k !== 'home_tab') as EnabledFeatureKey[];
    const allOn = allKeys.every((k) => state[k]);
    const allOff = allKeys.every((k) => !state[k]);
    const setAll = (value: boolean) => {
      allKeys.forEach((k) => {
        if (state[k] !== value) {
          toggleRole(group, k);
        }
      });
    };
    return (
      <div
        key={group}
        className="surface-glass-sm overflow-hidden mb-8"
      >
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-neutral-800/70 flex items-center justify-between">
          <button
            type="button"
            onClick={() => toggleRoleGroupExpanded(group)}
            aria-expanded={expanded}
            className="-m-1 flex min-w-0 items-center gap-2 rounded-lg p-1 text-left transition-colors hover:bg-white/60 dark:hover:bg-white/[0.06]"
          >
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 dark:text-neutral-400 ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            />
            <h2 className="ui-section-title text-slate-700 dark:text-neutral-200">
              {groupTitle(group, t as Record<string, string>)}
            </h2>
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-2 py-1 rounded text-xs font-semibold ${allOn ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-700'} hover:bg-brand-200`}
              onClick={() => setAll(true)}
            >
              {t.role_templates_enable_all || 'Attiva tutto'}
            </button>
            <button
              type="button"
              className={`px-2 py-1 rounded text-xs font-semibold ${allOff ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'} hover:bg-red-200`}
              onClick={() => setAll(false)}
            >
              {t.role_templates_disable_all || 'Disattiva tutto'}
            </button>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.25, 0.1, 0.25, 1] }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-4">
                <div className="surface-glass p-3 sm:p-4">
                  <RoleFeatureSectionsBlock
                    mode="toggles"
                    features={state}
                    language={effectiveLanguage}
                    lockAlwaysOnFeatures={['home_tab']}
                    onToggle={(key) => toggleRole(group, key)}
                  />
                </div>
                <div className="border-t border-slate-100 pt-3 dark:border-white/10">
                  <div className="surface-glass-sm overflow-hidden">
                    <AdminRow
                      icon={<Users className="h-4 w-4 text-slate-500 dark:text-neutral-300" aria-hidden />}
                      label={t.settings_visible_on_schedule_row}
                      description={
                        getTeamScheduleVisible(group)
                          ? t.role_template_grid_visible_desc
                          : t.role_template_grid_hidden_desc
                      }
                      action={
                        <button
                          type="button"
                          role="switch"
                          aria-checked={getTeamScheduleVisible(group)}
                          onClick={() => setTeamScheduleVisible(group, !getTeamScheduleVisible(group))}
                          className={`${switchRowClass} ${getTeamScheduleVisible(group) ? '' : 'bg-slate-200 dark:bg-neutral-600'}`}
                          style={
                            getTeamScheduleVisible(group)
                              ? { backgroundColor: ACCENT, ['--tw-ring-color' as string]: `${ACCENT}40` }
                              : { ['--tw-ring-color' as string]: `${ACCENT}40` }
                          }
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white toggle-knob shadow transition ${
                              getTeamScheduleVisible(group) ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      }
                    />
                  </div>
                </div>
                {renderAdminModulesBlock()}
                {renderOperationalBlock(group)}
              </div>
              <div className="flex justify-end border-t border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-neutral-800/60">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold shadow-md disabled:opacity-60"
                  style={{ backgroundColor: ACCENT }}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t.role_templates_save_all}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const introDescription = (
    <p className="mt-1 text-sm leading-snug text-slate-500 dark:text-neutral-300">
      {t.role_templates_intro_p1}{' '}
      <strong className="font-bold text-slate-800 dark:text-neutral-100">{t.role_templates_save_all}</strong>{' '}
      {t.role_templates_intro_p2}{' '}
      {t.role_templates_intro_files_label}{' '}
      <code className="rounded bg-slate-100 px-1 text-xs dark:bg-neutral-800 dark:text-neutral-200">
        role_feature_templates.json
      </code>
      ,{' '}
      <code className="rounded bg-slate-100 px-1 text-xs dark:bg-neutral-800 dark:text-neutral-200">
        admin_sheet_modules.json
      </code>
      .
    </p>
  );

  const groupsBlock = (
    <div className={`space-y-6 ${variant === 'embedded' ? 'mb-0' : 'mb-8'}`}>
      {renderGroup('management', mgmt)}
      {renderGroup('capo', capo)}
      {renderGroup('staff', staff)}
    </div>
  );

  const pageBody = (
    <>
      {groupsBlock}
    </>
  );

  /* In Impostazioni il collapse è solo `SettingsAccordionSection`: niente secondo accordion qui. */
  if (variant === 'embedded') {
    return (
      <div className="pb-1">
        <div className="mb-4">{introDescription}</div>
        {groupsBlock}
      </div>
    );
  }

  return (
    <div className="pb-content pt-6 w-full app-horizontal-pad font-sans max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {pageBody}
      </motion.div>
    </div>
  );
}

export default function RoleFeatureTemplatesPage() {
  return <RoleFeatureTemplatesPanel variant="page" />;
}
