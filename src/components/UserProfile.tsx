/**
 * Unificazione layout profilo e traduzioni.
 * - ProfileFormSelf: "Il mio profilo" — griglia Nome/Cognome, Email, Ruolo/PIN, Reparto (+ Telefono, Lingua). Tema: header app.
 * - ProfileFormAdmin: modale modifica dipendente (manager) — Nome, Cognome, Email, Ruolo, PIN, Reparto, Stato account, Permessi.
 * Layout: Reparto sopra Stato account (in admin). Tutte le etichette via t('chiave') per IT/EN/ES.
 * Persistenza: updateUser -> database.users.update (tabella `users`), campo `department` incluso.
 */
import { useMemo, useCallback, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Shield, CheckCircle, AlertTriangle, Euro, Link2, Copy, Phone, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslations, formatTrans } from '../utils/translations';
import { buildProfiloAccessLink } from '../config/appPaths';
import type { User as UserType, Language, Department } from '../types';
import { isPurelyManagementRole, isAdminOnly } from '../utils/permissions';
import {
  TIMESHEET_GRID_PLANNED_ONLY_KEY,
  TIMESHEET_GRID_SHIFT_TIMES_FEATURE_KEY,
  getTimesheetGridPrivacyMode,
} from '../utils/timesheetGridPrivacy';
import { translateRole } from '../utils/roles';
import { getDepartments } from '../utils/departments';
import { formatDepartmentDisplayForProfile, translateDepartmentValue } from '../utils/departmentLabels';
import { getRoleScopeHint } from '../utils/roleScopeHint';
import { DEFAULT_PHONE_PREFIX, PHONE_PREFIX_OPTIONS } from '../utils/phonePrefix';
import StaffOperationalPermissionsEditor from './StaffOperationalPermissionsEditor';
import { OPERATIONAL_STAFF_ROLES_FOR_DELEGATE } from '../utils/operationalStaffRoles';
const LANGS: Language[] = ['it', 'en', 'es', 'fr'];

export type ProfileFormSelfData = {
  first_name: string;
  last_name: string;
  email: string;
  phone_prefix: string;
  phone_national: string;
  language: Language;
  department?: Department;
  role: UserType['role'];
  pin: string;
};

/** Form "Il mio profilo": Email, Telefono, Reparto, Lingua. Con `readOnly` i campi sono disabilitati (es. anteprima). */
const inputClassLight =
  'w-full px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-neutral-100 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-colors';
const labelClassLight = 'block text-xs font-medium text-slate-600 dark:text-neutral-400 mb-1.5';

function roleSelectValue(role: UserType['role']): string {
  if (role === 'chef') return 'cook';
  if (role === 'waiter' || role === 'server') return 'server';
  return role;
}

function translatedRoleLabel(role: UserType['role'], t: ReturnType<typeof getTranslations>): string {
  const r = role === 'chef' ? 'cook' : role;
  const map: Record<string, string> = {
    server: t.waiter_role,
    waiter: t.waiter_role,
    cook: t.cook_role,
    chef: t.cook_role,
    bartender: t.bartender_role,
    dishwasher: t.dishwasher_role,
    capo: t.capo_role,
    assistant_manager: t.assistant_manager_role,
    manager: t.manager_role,
    admin: t.admin_role,
  };
  return map[r] ?? r;
}

export function ProfileFormSelf({
  formData,
  setFormData,
  onSave,
  isSaving,
  readOnly = false,
  appearance = 'dark',
  /** Se true: mostra solo il reparto assegnato (sola lettura), senza cambiare opzioni. */
  departmentLocked = false,
  /** Se true: solo il ruolo è bloccato (es. tab Profilo); PIN e resto restano modificabili se !readOnly. */
  roleLocked = false,
}: {
  formData: ProfileFormSelfData;
  setFormData: React.Dispatch<React.SetStateAction<ProfileFormSelfData>>;
  onSave: (e: React.FormEvent) => void;
  isSaving: boolean;
  readOnly?: boolean;
  /** `light` = allineato al resto dell’app (card bianche / accent) */
  appearance?: 'dark' | 'light';
  departmentLocked?: boolean;
  roleLocked?: boolean;
}) {
  const { effectiveLanguage, setLanguage, currentUser, departmentsRevision } = useApp();
  void departmentsRevision;
  const t = getTranslations(effectiveLanguage);

  const applyLanguage = (l: Language) => {
    if (readOnly) return;
    setFormData((prev) => ({ ...prev, language: l }));
    setLanguage(l);
  };

  const inputClassDark = 'w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white text-sm focus:border-white/20 focus:outline-none focus:ring-0';
  const inputClass = appearance === 'light' ? inputClassLight : inputClassDark;
  const inputClassDisabled =
    inputClass +
    (appearance === 'light'
      ? ' opacity-70 cursor-not-allowed bg-slate-50 dark:bg-neutral-900/50'
      : ' opacity-70 cursor-not-allowed');
  const labelClass = appearance === 'light' ? labelClassLight : 'block text-xs font-medium text-white/80 mb-1.5';
  const iconMuted = appearance === 'light' ? 'text-slate-500 dark:text-neutral-400' : 'text-white/40';

  const canEditRole = !readOnly && !roleLocked;
  const pinShownValue = readOnly ? (formData.pin.replace(/\D/g, '').length > 0 ? '••••' : '') : formData.pin;

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!readOnly) onSave(e); }} className="space-y-4">
      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            <User className={`w-3.5 h-3.5 inline mr-1.5 ${iconMuted}`} aria-hidden />
            {t.first_name}
          </label>
          <input
            type="text"
            value={formData.first_name}
            onChange={(e) => !readOnly && setFormData((prev) => ({ ...prev, first_name: e.target.value.toUpperCase() }))}
            readOnly={readOnly}
            className={readOnly ? inputClassDisabled : inputClass}
            placeholder={t.placeholder_first_name}
            required={!readOnly}
          />
        </div>
        <div>
          <label className={labelClass}>
            <User className={`w-3.5 h-3.5 inline mr-1.5 ${iconMuted}`} aria-hidden />
            {t.last_name_optional}
          </label>
          <input
            type="text"
            value={formData.last_name}
            onChange={(e) => !readOnly && setFormData((prev) => ({ ...prev, last_name: e.target.value.toUpperCase() }))}
            readOnly={readOnly}
            className={readOnly ? inputClassDisabled : inputClass}
            placeholder={t.placeholder_last_name}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>
          <Mail className={`w-4 h-4 inline mr-2 ${iconMuted}`} aria-hidden />
          {t.email}
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => !readOnly && setFormData((prev) => ({ ...prev, email: e.target.value }))}
          readOnly={readOnly}
          className={readOnly ? inputClassDisabled : inputClass}
          placeholder={(t as { email_placeholder?: string }).email_placeholder}
        />
      </div>

      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            <Shield className={`w-4 h-4 inline mr-2 ${iconMuted}`} aria-hidden />
            {t.role}
          </label>
          {canEditRole ? (
            <select
              value={roleSelectValue(formData.role)}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, role: e.target.value as UserType['role'] }))
              }
              className={inputClass}
              disabled={isPurelyManagementRole(formData.role) && currentUser ? !isAdminOnly(currentUser) : false}
            >
              <option value="server">{t.waiter_role}</option>
              <option value="cook">{t.cook_role}</option>
              <option value="bartender">{t.bartender_role}</option>
              <option value="dishwasher">{t.dishwasher_role}</option>
              <option value="capo">{t.capo_role}</option>
              <option value="assistant_manager">{t.assistant_manager_role}</option>
              {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                <option value="manager">{t.manager_role}</option>
              )}
              {currentUser && isAdminOnly(currentUser) && <option value="admin">{t.admin_role}</option>}
            </select>
          ) : (
            <input
              type="text"
              readOnly
              value={translatedRoleLabel(formData.role, t)}
              className={inputClassDisabled}
              aria-readonly
            />
          )}
        </div>
        <div>
          <label className={labelClass}>
            <Lock className={`w-3.5 h-3.5 inline mr-1.5 ${iconMuted}`} aria-hidden />
            {t.pin_4_digits}
          </label>
          {!readOnly ? (
            <input
              type="text"
              inputMode="numeric"
              value={formData.pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                setFormData((prev) => ({ ...prev, pin: value }));
              }}
              className={inputClass}
              placeholder="1234"
              maxLength={4}
              required
              pattern="\d{4}"
              title={t.pin_4_digits}
            />
          ) : (
            <input
              type="text"
              readOnly
              value={pinShownValue}
              className={inputClassDisabled}
              aria-readonly
            />
          )}
        </div>
      </div>

      {(() => {
        const tv = t as Record<string, string>;
        const scope = getRoleScopeHint(formData.role, tv);
        if (!scope) return null;
        return (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 dark:border-white/10 dark:bg-neutral-900/45">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 mb-1">
              {tv.profile_role_scope_label}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-neutral-300 leading-snug">{scope}</p>
          </div>
        );
      })()}

      <div>
        <label className={labelClass}>{t.department_label}</label>
        {departmentLocked || readOnly ? (
          <input
            type="text"
            readOnly
            value={formatDepartmentDisplayForProfile(formData.department, effectiveLanguage)}
            className={inputClassDisabled}
            aria-readonly
          />
        ) : (
          <select
            value={formData.department ?? ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, department: e.target.value || undefined }))}
            className={inputClass}
          >
            <option value="">— {t.department_none} —</option>
            {getDepartments().map((d) => (
              <option key={d.value} value={d.value}>
                {translateDepartmentValue(d.value, effectiveLanguage)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 min-[400px]:grid-cols-[7.25rem_1fr] gap-3 min-[400px]:gap-4">
        <div className="min-w-0">
          <label className={labelClass}>{t.phone_prefix}</label>
          <select
            value={formData.phone_prefix || DEFAULT_PHONE_PREFIX}
            onChange={(e) =>
              !readOnly &&
              setFormData((prev) => ({ ...prev, phone_prefix: e.target.value }))
            }
            disabled={readOnly}
            className={readOnly ? inputClassDisabled : inputClass}
          >
            {PHONE_PREFIX_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className={labelClass}>
            <Phone className={`w-4 h-4 inline mr-2 ${iconMuted}`} aria-hidden />
            {t.phone}
          </label>
          <input
            type="text"
            inputMode="tel"
            autoComplete="tel-national"
            value={formData.phone_national}
            onChange={(e) =>
              !readOnly &&
              setFormData((prev) => ({
                ...prev,
                phone_national: e.target.value.replace(/[^\d\s]/g, ''),
              }))
            }
            readOnly={readOnly}
            className={readOnly ? inputClassDisabled : inputClass}
            placeholder="333 1234567"
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>{t.language}</label>
        {appearance === 'light' ? (
          <div
            className={`flex gap-1 rounded-xl bg-slate-100 dark:bg-neutral-800/80 border border-slate-200 dark:border-white/10 p-1 ${readOnly ? 'pointer-events-none opacity-70' : ''}`}
          >
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => applyLanguage(l)}
                disabled={readOnly}
                className="relative flex-1 min-w-0 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors font-sans"
              >
                {formData.language === l ? (
                  <span className="relative z-10 text-white">{l.toUpperCase()}</span>
                ) : (
                  <span className="text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200 transition-colors">
                    {l.toUpperCase()}
                  </span>
                )}
                {formData.language === l && (
                  <motion.span
                    layoutId="lang-pill-bg-light"
                    className="absolute inset-0 bg-accent rounded-lg z-0 shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className={`flex rounded-xl bg-black/30 border border-white/10 overflow-hidden ${readOnly ? 'pointer-events-none opacity-70' : ''}`}>
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => applyLanguage(l)}
                disabled={readOnly}
                className="relative flex-1 min-w-[3rem] py-2.5 px-4 text-xs font-bold uppercase tracking-wider transition-colors duration-200 font-sans"
              >
                {formData.language === l ? (
                  <span className="relative z-10 text-black">{l.toUpperCase()}</span>
                ) : (
                  <span className="text-white/70 hover:text-white/90 transition-colors">{l.toUpperCase()}</span>
                )}
                {formData.language === l && (
                  <motion.span
                    layoutId="lang-pill-bg-dark"
                    className="absolute inset-0.5 bg-white rounded-xl z-0"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {!readOnly && (
        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3 rounded-xl bg-accent text-white font-bold text-sm shadow-md shadow-accent/25 hover:bg-accent-hover active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? t.saving : t.save}
        </button>
      )}
    </form>
  );
}

/** Solo admin: limita la griglia Presenze dell’utente ai soli orari pianificati pubblicati/confermati. */
export function AdminTimesheetGridPrivacyEditor({ user }: { user: UserType }) {
  const { updateUser, effectiveLanguage, showSuccess, showError } = useApp();
  const t = getTranslations(effectiveLanguage);
  const tv = t as Record<string, string>;
  const plannedOnly = getTimesheetGridPrivacyMode(user) === 'planned_only';
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const handleToggle = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const fe = { ...((user.enabled_features ?? {}) as Record<string, unknown>) };
      if (plannedOnly) {
        delete fe[TIMESHEET_GRID_PLANNED_ONLY_KEY];
      } else {
        fe[TIMESHEET_GRID_PLANNED_ONLY_KEY] = true;
        delete fe[TIMESHEET_GRID_SHIFT_TIMES_FEATURE_KEY];
      }
      await updateUser(user.id, { enabled_features: fe });
      showSuccess?.(tv.settings_operational_perm_saved ?? 'Salvato.');
    } catch (e) {
      console.error('[AdminTimesheetGridPrivacyEditor]', e);
      showError?.(tv.save_error_retry ?? 'Errore durante il salvataggio.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-3 dark:border-white/10 dark:bg-neutral-900/45">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-800 dark:text-neutral-100">
            {tv.admin_timesheet_grid_planned_only_label}
          </p>
          <p className="mt-1 text-[10px] leading-snug text-slate-500 dark:text-neutral-400">
            {tv.admin_timesheet_grid_planned_only_hint}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={plannedOnly}
          aria-label={tv.admin_timesheet_grid_planned_only_label}
          disabled={busy}
          onClick={() => void handleToggle()}
          className={`relative flex h-7 w-12 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50 ${
            plannedOnly ? 'bg-accent' : 'bg-slate-300 dark:bg-neutral-600'
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              plannedOnly ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

export type ProfileFormAdminData = {
  first_name: string;
  last_name: string;
  email: string;
  role: UserType['role'];
  pin: string;
  status: UserType['status'];
  department?: Department;
  /** Stringa per input numerico €/h */
  hourly_rate_eur: string;
  /** yyyy-MM-dd o stringa vuota */
  employment_start_date: string;
  employment_end_date: string;
};

const inputClass =
  'w-full px-3 py-2 rounded-xl text-sm bg-white border border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 focus:outline-none transition-colors font-sans dark:bg-neutral-900 dark:border-white/10 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500 dark:focus:ring-neutral-500/25 disabled:opacity-60 dark:disabled:opacity-50';
const labelClass =
  'block text-xs font-semibold text-slate-700 mb-1 font-sans dark:text-neutral-200';

/** Form modale "Modifica dipendente" (manager): layout con Reparto sopra Stato account. Tutte le etichette tradotte. */
export function ProfileFormAdmin({
  user,
  currentUser,
  formData,
  setFormData,
  onSubmit,
  onClose,
  isSaving,
  variant = 'edit',
  activePinConflictMessage = null,
  readOnly = false,
  operationalRolesOnly = false,
}: {
  user: UserType;
  currentUser: UserType;
  formData: ProfileFormAdminData;
  setFormData: React.Dispatch<React.SetStateAction<ProfileFormAdminData>>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  isSaving: boolean;
  /** `create`: nessun blocco link invito (serve `id` dopo salvataggio). */
  variant?: 'edit' | 'create';
  /** Se valorizzato: stesso PIN di un altro dipendente attivo (blocco salvataggio + hint sotto il campo). */
  activePinConflictMessage?: string | null;
  /** Solo consultazione (Manager/Assistant: scheda team delegata). */
  readOnly?: boolean;
  /** Creazione dipendente da delegato: solo ruoli operativi sala/cucina/bar. */
  operationalRolesOnly?: boolean;
}) {
  const { effectiveLanguage, showSuccess, showError, departmentsRevision } = useApp();
  void departmentsRevision;
  const t = getTranslations(effectiveLanguage);
  const tv = t as Record<string, string>;
  const layoutRole = variant === 'create' ? formData.role : user.role;
  const isSuspended =
    variant === 'edit' && (user.status === 'suspended' || user.status === 'inactive');
  const invitePinComplete = formData.pin.replace(/\D/g, '').length === 4;

  const accessLink = useMemo(
    () =>
      buildProfiloAccessLink(user.id, undefined, {
        displayName: `${formData.first_name} ${formData.last_name ?? ''}`.trim(),
        pin: formData.pin,
      }),
    [user.id, formData.first_name, formData.last_name, formData.pin]
  );

  const handleCopyAccessLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(accessLink);
      showSuccess?.(tv.admin_employee_access_link_copied ?? 'Link copiato.');
    } catch {
      showError?.(tv.copy_failed ?? 'Copia non riuscita. Seleziona il link manualmente.');
    }
  }, [accessLink, showSuccess, showError, tv.admin_employee_access_link_copied, tv.copy_failed]);

  const roleSelectDisabled =
    readOnly || (isPurelyManagementRole(user.role) && !isAdminOnly(currentUser));
  const showEmploymentEndField =
    formData.status === 'suspended' || formData.status === 'inactive';

  return (
    <>
      {readOnly && (
        <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:border-white/10 dark:bg-neutral-800/80 dark:text-neutral-300 font-sans">
          {(t as { settings_delegated_readonly_hint?: string }).settings_delegated_readonly_hint ??
            'Solo lettura. Per modifiche contatta un amministratore.'}
        </p>
      )}
      {isSuspended && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
          <p className="text-sm font-medium font-sans">{t.employee_suspended_warning}</p>
        </div>
      )}
      <form
        onSubmit={readOnly ? (e) => e.preventDefault() : onSubmit}
        className="space-y-6"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              <User className="w-3.5 h-3.5 inline mr-1.5 text-slate-400 dark:text-neutral-400" />
              {t.first_name}
            </label>
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value.toUpperCase() }))}
              className={inputClass}
              placeholder={t.placeholder_first_name}
              required={!readOnly}
              disabled={readOnly}
            />
          </div>
          <div>
            <label className={labelClass}>
              <User className="w-3.5 h-3.5 inline mr-1.5 text-slate-400 dark:text-neutral-400" />
              {t.last_name_optional}
            </label>
            <input
              type="text"
              value={formData.last_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value.toUpperCase() }))}
              className={inputClass}
              placeholder={t.placeholder_last_name}
              disabled={readOnly}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>
            <Mail className="w-4 h-4 inline mr-2 text-slate-400 dark:text-neutral-400" />
            {t.email}
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            className={inputClass}
            placeholder={t.email_placeholder}
            required={!readOnly}
            disabled={readOnly}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              <Shield className="w-4 h-4 inline mr-2 text-slate-400 dark:text-neutral-400" />
              {t.role}
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value as UserType['role'] }))}
              className={inputClass}
              disabled={roleSelectDisabled}
            >
              {operationalRolesOnly
                ? OPERATIONAL_STAFF_ROLES_FOR_DELEGATE.map((r) => (
                    <option key={r} value={r}>
                      {translateRole(r, effectiveLanguage)}
                    </option>
                  ))
                : (
                <>
                  <option value="server">{t.waiter_role}</option>
                  <option value="cook">{t.cook_role}</option>
                  <option value="bartender">{t.bartender_role}</option>
                  <option value="dishwasher">{t.dishwasher_role}</option>
                  <option value="capo">{t.capo_role}</option>
                  <option value="assistant_manager">{t.assistant_manager_role}</option>
                  {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
                    <option value="manager">{t.manager_role}</option>
                  )}
                  {isAdminOnly(currentUser) && <option value="admin">{t.admin_role}</option>}
                </>
                  )}
            </select>
          </div>
          <div>
            <label className={labelClass}>
              <Lock className="w-3.5 h-3.5 inline mr-1.5 text-slate-400 dark:text-neutral-400" />
              {t.pin_4_digits}
            </label>
            <input
              type="text"
              value={formData.pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                setFormData((prev) => ({ ...prev, pin: value }));
              }}
              className={`${inputClass} ${activePinConflictMessage ? 'border-red-400 ring-1 ring-red-200 dark:border-red-500 dark:ring-red-900/60' : ''}`}
              placeholder="1234"
              maxLength={4}
              aria-invalid={activePinConflictMessage ? true : undefined}
              disabled={readOnly}
            />
            {activePinConflictMessage && !readOnly ? (
              <p className="mt-1.5 text-[11px] font-medium text-red-600 dark:text-red-400 font-sans leading-snug">
                {activePinConflictMessage}
              </p>
            ) : null}
          </div>
        </div>

        {(() => {
          const tv = t as Record<string, string>;
          const scope = getRoleScopeHint(formData.role, tv);
          if (!scope) return null;
          return (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 dark:border-white/10 dark:bg-neutral-900/45">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 mb-1">
                {tv.profile_role_scope_label}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-neutral-300 leading-snug">{scope}</p>
            </div>
          );
        })()}

        {/* Reparto sopra Stato account (nascosto solo per Admin — profilo puramente gestionale) */}
        {!isPurelyManagementRole(layoutRole) && (
          <div>
            <label className={labelClass}>{t.department_label}</label>
            <select
              value={formData.department ?? ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  department: e.target.value || undefined,
                }))
              }
              className={inputClass}
              disabled={readOnly}
            >
              <option value="">— {t.department_none} —</option>
              {getDepartments().map((d) => (
                <option key={d.value} value={d.value}>
                  {translateDepartmentValue(d.value, effectiveLanguage)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass}>
            <Euro className="w-3.5 h-3.5 inline mr-1.5 text-slate-400 dark:text-neutral-400" />
            {(t as { profile_hourly_rate_label?: string }).profile_hourly_rate_label ?? 'Tariffa oraria (€/h)'}
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={formData.hourly_rate_eur}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.,]/g, '');
              setFormData((prev) => ({ ...prev, hourly_rate_eur: v }));
            }}
            className={inputClass}
            placeholder={(t as { profile_hourly_rate_placeholder?: string }).profile_hourly_rate_placeholder ?? 'es. 12,50'}
            disabled={readOnly}
          />
          <p className="text-[11px] text-slate-500 dark:text-neutral-300 mt-1 font-sans">
            {(t as { profile_hourly_rate_hint?: string }).profile_hourly_rate_hint ?? ''}
          </p>
        </div>

        <div>
          <label className={labelClass}>
            <CheckCircle className="w-3.5 h-3.5 inline mr-1.5 text-slate-400 dark:text-neutral-400" />
            {t.account_status}
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as UserType['status'] }))}
            className={inputClass}
            disabled={readOnly}
          >
            <option value="active">{t.status_active}</option>
            <option value="suspended">{t.status_suspended}</option>
            <option value="inactive">{t.status_inactive}</option>
          </select>
        </div>

        {variant === 'edit' && isAdminOnly(currentUser) && !readOnly && (
          <AdminTimesheetGridPrivacyEditor user={user} />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>
              <Calendar className="w-3.5 h-3.5 inline mr-1.5 text-slate-400 dark:text-neutral-400" />
              {tv.profile_employment_start_label}
            </label>
            <input
              type="date"
              value={formData.employment_start_date}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, employment_start_date: e.target.value }))
              }
              className={inputClass}
              disabled={readOnly}
              required={false}
              aria-required={false}
            />
            {tv.profile_employment_start_hint ? (
              <p className="text-[11px] text-slate-500 dark:text-neutral-300 mt-1 font-sans">
                {tv.profile_employment_start_hint}
              </p>
            ) : null}
          </div>
          {showEmploymentEndField ? (
            <div>
              <label className={labelClass}>
                <Calendar className="w-3.5 h-3.5 inline mr-1.5 text-slate-400 dark:text-neutral-400" />
                {tv.profile_employment_end_label}
              </label>
              <input
                type="date"
                value={formData.employment_end_date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, employment_end_date: e.target.value }))
                }
                className={inputClass}
                disabled={readOnly}
                required={false}
                aria-required={false}
              />
              {tv.profile_employment_end_hint ? (
                <p className="text-[11px] text-slate-500 dark:text-neutral-300 mt-1 font-sans">
                  {tv.profile_employment_end_hint}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="hidden sm:block" aria-hidden />
          )}
        </div>

        {variant === 'edit' && !isPurelyManagementRole(layoutRole) && !readOnly && (
          <div className="surface-glass-sm bg-slate-50/45 p-4 dark:bg-neutral-900/25">
            <StaffOperationalPermissionsEditor user={user} currentUser={currentUser} />
          </div>
        )}

        {variant === 'edit' && !readOnly && (
          <div className="surface-glass-sm space-y-2 bg-slate-50/40 p-3 dark:bg-neutral-900/20">
            <button
              type="button"
              onClick={() => void handleCopyAccessLink()}
              className="flex w-full items-center justify-center gap-2 surface-glass-sm py-2.5 text-sm font-semibold text-slate-800 surface-ghost-interactive dark:text-neutral-100 font-sans"
            >
              <Copy className="h-4 w-4 shrink-0 text-slate-500 dark:text-neutral-300" aria-hidden />
              {tv.admin_employee_access_link_btn ?? 'Copia link accesso'}
            </button>
            <p className="flex gap-1.5 text-[11px] leading-snug text-slate-600 dark:text-neutral-300 font-sans">
              <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-neutral-400" aria-hidden />
              <span>{tv.admin_employee_access_link_hint ?? ''}</span>
            </p>
            <p className="pl-5 text-[11px] font-medium text-slate-800 dark:text-neutral-100 font-sans">
              {formatTrans(tv.admin_employee_access_link_preview ?? 'Nome al login: {name}', {
                name: `${formData.first_name} ${formData.last_name ?? ''}`.trim() || '—',
              })}
            </p>
            {formData.status !== 'active' && (
              <p className="pl-5 text-[11px] font-medium text-amber-800 dark:text-amber-200 font-sans">
                {tv.admin_employee_access_link_inactive ?? ''}
              </p>
            )}
            {!invitePinComplete && (
              <p className="pl-5 text-[11px] font-medium text-amber-800 dark:text-amber-200 font-sans">
                {tv.admin_employee_access_link_pin_incomplete ?? ''}
              </p>
            )}
            <p className="text-[10px] text-slate-400 dark:text-neutral-400 font-mono break-all pl-5">{accessLink}</p>
          </div>
        )}

        {!readOnly && (
          <p className="text-[11px] text-slate-500 dark:text-neutral-300 mt-2">
            {(t as { permissions_in_settings?: string }).permissions_in_settings ??
              'Funzionalità, moduli e visibilità schede: Impostazioni → Team → Permessi sul dipendente (template ruoli + anteprima).'}
          </p>
        )}

        <div className="flex space-x-2 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 surface-glass-sm px-4 py-2 text-sm font-semibold text-slate-700 surface-ghost-interactive dark:text-neutral-200 font-sans"
          >
            {readOnly ? t.close ?? t.cancel : t.cancel}
          </button>
          {!readOnly && (
            <button
              type="submit"
              disabled={isSaving || Boolean(activePinConflictMessage)}
              className="flex-1 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 font-sans"
            >
              {isSaving ? t.saving : variant === 'create' ? t.create_employee_submit : t.save_changes}
            </button>
          )}
        </div>
      </form>
    </>
  );
}
