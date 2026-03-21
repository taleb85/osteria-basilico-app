import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, RotateCcw, Save, Loader2, Users, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { canEditRoleFeatureTemplates } from '../utils/permissions';
import {
  ADMIN_MODULE_KEYS,
  ADMIN_MODULE_LABELS,
  ENABLED_FEATURE_KEYS,
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
import { getRoleFeatureTemplatesCache, type RoleFeatureTemplatesOnDisk, type RoleTemplateGroup } from '../utils/roleFeatureTemplates';
import { serializeAdminModulesForDisk } from '../utils/adminModulesGlobal';
import { getTranslations } from '../utils/translations';
import { buildSettingsPermissionRows, SETTINGS_OPERATIONAL_PERM_KEYS } from '../utils/settingsPermissionRows';
import { operationalPayloadForUser } from '../utils/roleTemplateUserSync';

const ACCENT = '#2D5A27';
const EMBEDDED_COLLAPSE_KEY = 'osteria_role_templates_embedded_collapsed';

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

const GROUP_LABELS: Record<RoleTemplateGroup, string> = {
  proprietario: 'Proprietario',
  management: 'Manager e Assistant Manager',
  staff: 'Staff (camerieri, bar, cucina, …)',
};

export type RoleFeatureTemplatesPanelVariant = 'page' | 'embedded';

type Props = { variant?: RoleFeatureTemplatesPanelVariant };

function allOperationalTrue(): Record<SettingsOperationalPermKey, boolean> {
  return Object.fromEntries(SETTINGS_OPERATIONAL_PERM_KEYS.map((k) => [k, true])) as Record<
    SettingsOperationalPermKey,
    boolean
  >;
}

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

  const allOnInit = () =>
    Object.fromEntries(ENABLED_FEATURE_KEYS.map((k) => [k, true])) as EnabledFeatures;
  const [prop, setProp] = useState<EnabledFeatures>(allOnInit);
  const [mgmt, setMgmt] = useState<EnabledFeatures>(allOnInit);
  const [staff, setStaff] = useState<EnabledFeatures>(allOnInit);
  const [teamScheduleProp, setTeamScheduleProp] = useState(true);
  const [teamScheduleMgmt, setTeamScheduleMgmt] = useState(true);
  const [teamScheduleStaff, setTeamScheduleStaff] = useState(true);
  const [opProp, setOpProp] = useState<Record<SettingsOperationalPermKey, boolean>>(() =>
    buildMergedOperationalTemplateForGroup('proprietario', getRoleFeatureTemplatesCache())
  );
  const [opMgmt, setOpMgmt] = useState<Record<SettingsOperationalPermKey, boolean>>(() =>
    buildMergedOperationalTemplateForGroup('management', getRoleFeatureTemplatesCache())
  );
  const [opStaff, setOpStaff] = useState<Record<SettingsOperationalPermKey, boolean>>(() =>
    buildMergedOperationalTemplateForGroup('staff', getRoleFeatureTemplatesCache())
  );
  const [mods, setMods] = useState<Record<AdminModuleKey, boolean>>(() => buildMergedAdminModulesForAdminEditor());
  const [saving, setSaving] = useState(false);
  /** Prima visita: compresso (meno scroll). Dopo, ricorda espanso (`0`) / compresso (`1`). */
  const [embeddedExpanded, setEmbeddedExpanded] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const v = window.localStorage.getItem(EMBEDDED_COLLAPSE_KEY);
      if (v === null) return false;
      return v !== '1';
    } catch {
      return false;
    }
  });

  const toggleEmbeddedPanel = useCallback(() => {
    setEmbeddedExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(EMBEDDED_COLLAPSE_KEY, next ? '0' : '1');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const [roleGroupExpanded, setRoleGroupExpanded] = useState<Record<RoleTemplateGroup, boolean>>(() => ({
    proprietario: readRoleGroupExpanded('proprietario'),
    management: readRoleGroupExpanded('management'),
    staff: readRoleGroupExpanded('staff'),
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
    const disk = getRoleFeatureTemplatesCache();
    setProp(buildMergedTemplateForAdminEditor('proprietario', disk));
    setMgmt(buildMergedTemplateForAdminEditor('management', disk));
    setStaff(buildMergedTemplateForAdminEditor('staff', disk));
    setTeamScheduleProp(getTemplateGroupTeamScheduleVisible('proprietario', disk));
    setTeamScheduleMgmt(getTemplateGroupTeamScheduleVisible('management', disk));
    setTeamScheduleStaff(getTemplateGroupTeamScheduleVisible('staff', disk));
    setOpProp(buildMergedOperationalTemplateForGroup('proprietario', disk));
    setOpMgmt(buildMergedOperationalTemplateForGroup('management', disk));
    setOpStaff(buildMergedOperationalTemplateForGroup('staff', disk));
  }, [roleTemplatesRevision]);

  useEffect(() => {
    setMods(buildMergedAdminModulesForAdminEditor());
  }, [adminModulesRevision]);

  const toggleRole = useCallback((group: RoleTemplateGroup, key: EnabledFeatureKey) => {
    const upd = (prev: EnabledFeatures) => ({ ...prev, [key]: !(prev[key] === true) });
    if (group === 'proprietario') setProp(upd);
    else if (group === 'management') setMgmt(upd);
    else setStaff(upd);
  }, []);

  const toggleOperational = useCallback((group: RoleTemplateGroup, key: SettingsOperationalPermKey) => {
    const apply = (prev: Record<SettingsOperationalPermKey, boolean>) => ({
      ...prev,
      [key]: !prev[key],
    });
    if (group === 'proprietario') setOpProp(apply);
    else if (group === 'management') setOpMgmt(apply);
    else setOpStaff(apply);
  }, []);

  const resetGroupAllOn = useCallback((group: RoleTemplateGroup) => {
    const allOn = Object.fromEntries(ENABLED_FEATURE_KEYS.map((k) => [k, true])) as EnabledFeatures;
    const allOp = allOperationalTrue();
    if (group === 'proprietario') {
      setProp(allOn);
      setTeamScheduleProp(true);
      setOpProp(allOp);
    } else if (group === 'management') {
      setMgmt(allOn);
      setTeamScheduleMgmt(true);
      setOpMgmt(allOp);
    } else {
      setStaff(allOn);
      setTeamScheduleStaff(true);
      setOpStaff(allOp);
    }
  }, []);

  const toggleMod = useCallback((key: AdminModuleKey) => {
    setMods((m) => ({ ...m, [key]: !m[key] }));
  }, []);

  const resetMods = useCallback(() => {
    setMods(Object.fromEntries(ADMIN_MODULE_KEYS.map((k) => [k, true])) as Record<AdminModuleKey, boolean>);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const disk: RoleFeatureTemplatesOnDisk = {
        proprietario: serializeTemplateGroupForDisk(prop, teamScheduleProp, opProp),
        management: serializeTemplateGroupForDisk(mgmt, teamScheduleMgmt, opMgmt),
        staff: serializeTemplateGroupForDisk(staff, teamScheduleStaff, opStaff),
      };
      await saveRoleFeatureTemplates(disk);
      await saveAdminModulesGlobal(serializeAdminModulesForDisk(mods));

      const opTemplates = { proprietario: opProp, management: opMgmt, staff: opStaff };
      for (const u of users) {
        const payload = operationalPayloadForUser(u, opTemplates);
        if (payload && Object.keys(payload).length > 0) {
          await updateUser(u.id, payload);
        }
      }

      showSuccess?.('Salvato: template, moduli Admin e permessi operativi sincronizzati sui profili.');
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Salvataggio non riuscito.';
      showError?.(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!canEditRoleFeatureTemplates(currentUser)) {
    if (variant === 'embedded') return null;
    return (
      <div className="pb-content pt-6 px-4 sm:px-6">
        <p className="text-sm text-slate-600">Solo Amministratore o Proprietario possono modificare questa configurazione.</p>
      </div>
    );
  }

  const getTeamScheduleVisible = (g: RoleTemplateGroup) =>
    g === 'proprietario' ? teamScheduleProp : g === 'management' ? teamScheduleMgmt : teamScheduleStaff;
  const setTeamScheduleVisible = (g: RoleTemplateGroup, v: boolean) => {
    if (g === 'proprietario') setTeamScheduleProp(v);
    else if (g === 'management') setTeamScheduleMgmt(v);
    else setTeamScheduleStaff(v);
  };

  const getOp = (g: RoleTemplateGroup) =>
    g === 'proprietario' ? opProp : g === 'management' ? opMgmt : opStaff;

  const switchRowClass =
    'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

  const renderAdminModulesBlock = () => (
    <div className="pt-3 border-t border-slate-100">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
        Moduli scheda Impostazioni (globali)
      </p>
      <p className="text-[11px] text-slate-500 mb-2">
        Stessi valori per tutti i profili gestionali; modificabili da qui (un solo stato condiviso tra le tre schede).
      </p>
      <div className="rounded-xl overflow-hidden border border-slate-200 divide-y divide-slate-100 bg-white">
        {ADMIN_MODULE_KEYS.map((key) => {
          const enabled = mods[key] === true;
          return (
            <div key={key} className="flex items-center justify-between py-2.5 px-3">
              <span className="text-sm text-slate-700 pr-2">{ADMIN_MODULE_LABELS[key]}</span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => toggleMod(key)}
                className={switchRowClass}
                style={{
                  backgroundColor: enabled ? ACCENT : 'rgb(226 232 240)',
                  ['--tw-ring-color' as string]: `${ACCENT}40`,
                }}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    enabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={resetMods}
        className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50"
      >
        <RotateCcw className="w-3 h-3" />
        Moduli: tutti attivi
      </button>
    </div>
  );

  const renderOperationalBlock = (group: RoleTemplateGroup) => {
    const op = getOp(group);
    return (
      <div className="pt-3 border-t border-slate-100">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Permessi operativi</p>
        <p className="text-[11px] text-slate-500 mb-2">
          Allineati al salvataggio su tutti gli utenti di questo gruppo (come nella scheda Permessi per utente).
        </p>
        <div className="rounded-xl overflow-hidden border border-slate-200 divide-y divide-slate-100 bg-white">
          {permRows.map((perm) => {
            const enabled = op[perm.key] === true;
            return (
              <div key={perm.key} className="flex items-center justify-between gap-3 py-2.5 px-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-slate-700">{perm.label}</span>
                    {perm.adminOnly && (
                      <span className="text-[9px] font-bold text-accent border border-accent/30 bg-accent/8 rounded-xl px-1.5 py-0.5 uppercase tracking-wider">
                        Gestione
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{perm.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => toggleOperational(group, perm.key)}
                  className={switchRowClass}
                  style={{
                    backgroundColor: enabled ? ACCENT : 'rgb(226 232 240)',
                    ['--tw-ring-color' as string]: `${ACCENT}40`,
                  }}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      enabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderGroup = (group: RoleTemplateGroup, state: EnabledFeatures) => {
    const expanded = roleGroupExpanded[group];
    return (
      <div key={group} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => toggleRoleGroupExpanded(group)}
            aria-expanded={expanded}
            className="flex items-center gap-2 min-w-0 flex-1 text-left rounded-lg -m-1 p-1 hover:bg-white/60 transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 shrink-0 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            />
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-widest">{GROUP_LABELS[group]}</h2>
          </button>
          <button
            type="button"
            onClick={() => resetGroupAllOn(group)}
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg border border-slate-200 hover:bg-white"
          >
            <RotateCcw className="w-3 h-3" />
            Default: tutti attivi
          </button>
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
                <RoleFeatureSectionsBlock
                  mode="toggles"
                  features={state}
                  language={effectiveLanguage}
                  onToggle={(key) => toggleRole(group, key)}
                />
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-700">Visibile in tabellone turni (Griglia)</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={getTeamScheduleVisible(group)}
                      onClick={() => setTeamScheduleVisible(group, !getTeamScheduleVisible(group))}
                      className={switchRowClass}
                      style={{
                        backgroundColor: getTeamScheduleVisible(group) ? ACCENT : 'rgb(226 232 240)',
                        ['--tw-ring-color' as string]: `${ACCENT}40`,
                      }}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                          getTeamScheduleVisible(group) ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {getTeamScheduleVisible(group)
                      ? 'Profilo visibile nel tabellone turni e nelle viste collettive.'
                      : 'Profilo nascosto dal tabellone (resta attivo; override per utente dal pulsante Griglia in Gestione team).'}
                  </p>
                </div>
                {renderAdminModulesBlock()}
                {renderOperationalBlock(group)}
              </div>
              <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold shadow-md disabled:opacity-60"
                  style={{ backgroundColor: ACCENT }}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salva tutto
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const introDescription = (
    <p className="text-slate-500 text-sm mt-1 leading-snug">
      Ogni scheda raggruppa <strong>schede app</strong>, <strong>Griglia</strong>, <strong>moduli Impostazioni</strong> (globali, stessi switch in tutte e tre) e <strong>permessi operativi</strong>.{' '}
      <strong>Salva tutto</strong> aggiorna file su Storage e sincronizza i permessi operativi su tutti gli utenti non admin.
      File:{' '}
      <code className="text-xs bg-slate-100 px-1 rounded">role_feature_templates.json</code>,{' '}
      <code className="text-xs bg-slate-100 px-1 rounded">admin_sheet_modules.json</code>.
    </p>
  );

  const groupsBlock = (
    <div className={`space-y-6 ${variant === 'embedded' ? 'mb-0' : 'mb-8'}`}>
      {renderGroup('proprietario', prop)}
      {renderGroup('management', mgmt)}
      {renderGroup('staff', staff)}
    </div>
  );

  const pageBody = (
    <>
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${ACCENT}20` }}>
          <SlidersHorizontal className="w-5 h-5" style={{ color: ACCENT }} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-slate-800 text-xl font-bold leading-tight">{t.role_templates_page_title}</h1>
          {introDescription}
        </div>
      </div>
      {groupsBlock}
    </>
  );

  if (variant === 'embedded') {
    return (
      <section className="mb-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm"
        >
          <button
            type="button"
            onClick={toggleEmbeddedPanel}
            aria-expanded={embeddedExpanded}
            aria-label={t.role_templates_embedded_toggle_aria}
            className="w-full flex items-center gap-3 px-4 py-3 text-left bg-slate-50 hover:bg-slate-100/90 transition-colors border-b border-slate-200"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${ACCENT}20` }}
            >
              <SlidersHorizontal className="w-5 h-5" style={{ color: ACCENT }} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-slate-800 text-base font-bold leading-tight">{t.role_templates_page_title}</h2>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                {embeddedExpanded ? t.role_templates_embedded_expanded_hint : t.role_templates_embedded_collapsed_hint}
              </p>
            </div>
            <ChevronDown
              className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${embeddedExpanded ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          <AnimatePresence initial={false}>
            {embeddedExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 pt-3 border-t border-slate-100">
                  <div className="mb-4">{introDescription}</div>
                  {groupsBlock}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>
    );
  }

  return (
    <div className="pb-content pt-6 w-full px-4 sm:px-6 font-sans min-h-full max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {pageBody}
      </motion.div>
    </div>
  );
}

export default function RoleFeatureTemplatesPage() {
  return <RoleFeatureTemplatesPanel variant="page" />;
}
