/**
 * SuperAdminPanel — Pannello di gestione multi-sede.
 * Accessibile su /super-admin (route protetta da PIN super-admin).
 * Permette di creare, modificare, configurare e disattivare sedi (tenant).
 *
 * ISOLATO: non usa AppContext né TenantContext. Ha il proprio PIN gate.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Check, X, Building2, Palette, Globe,
  ToggleLeft, ToggleRight, Copy, Settings, ChevronDown,
  MapPin, Clock, Languages, Layers, ExternalLink, Users,
  UserPlus, Trash2, ChevronRight, Eye, EyeOff, ShieldCheck, Delete,
} from 'lucide-react';
import { supabaseAdmin as supabase } from '../lib/supabase';
import type { Tenant, TenantSettings, UserRole, UserStatus } from '../types';
import { HEADER_FONTS } from '../context/TenantContext';
import { seedTenantFromTemplate } from '../utils/seedTenantFromTemplate';

// ---------------------------------------------------------------------------
// Costanti PIN
// ---------------------------------------------------------------------------

const SUPER_ADMIN_PIN = import.meta.env.VITE_SUPER_ADMIN_PIN ?? '159753';
const SESSION_KEY = 'sa_unlocked';

// ---------------------------------------------------------------------------
// PIN Gate
// ---------------------------------------------------------------------------

function SuperAdminPinGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [digits, setDigits] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleDigit = (d: string) => {
    if (digits.length >= 6) return;
    const next = digits + d;
    setDigits(next);
    setError(false);
    if (next.length === SUPER_ADMIN_PIN.length) {
      if (next === SUPER_ADMIN_PIN) {
        sessionStorage.setItem(SESSION_KEY, '1');
        onUnlocked();
      } else {
        setShake(true);
        setError(true);
        setTimeout(() => { setDigits(''); setShake(false); }, 600);
      }
    }
  };

  const handleDelete = () => setDigits((d) => d.slice(0, -1));

  const PAD = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    ['','0','⌫'],
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) handleDigit(e.key);
      else if (e.key === 'Backspace') handleDelete();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="min-h-screen min-h-dvh flex flex-col items-center justify-center bg-[#0f1117] px-6 select-none"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Logo / icona */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-[#1e2330] border border-white/10 flex items-center justify-center shadow-lg">
          <ShieldCheck className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="text-center">
          <h1 className="text-lg font-bold text-white tracking-tight">Super Admin</h1>
          <p className="text-sm text-white/40 mt-0.5">Inserisci il PIN per accedere</p>
        </div>
      </div>

      {/* Indicatore cifre */}
      <motion.div
        animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex gap-3 mb-8"
      >
        {Array.from({ length: SUPER_ADMIN_PIN.length }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-all duration-150 ${
              i < digits.length
                ? error ? 'bg-red-400' : 'bg-emerald-400'
                : 'bg-white/15'
            }`}
          />
        ))}
      </motion.div>

      {/* Tastierino numerico */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[260px]">
        {PAD.flat().map((key, i) => {
          if (key === '') return <div key={i} />;
          const isDelete = key === '⌫';
          return (
            <button
              key={i}
              onClick={() => isDelete ? handleDelete() : handleDigit(key)}
              className={`h-14 rounded-2xl text-lg font-bold transition-all active:scale-95 ${
                isDelete
                  ? 'bg-transparent text-white/40 hover:text-white/70'
                  : 'bg-white/8 border border-white/10 text-white hover:bg-white/14 active:bg-white/20'
              }`}
            >
              {isDelete ? <Delete className="w-5 h-5 mx-auto" /> : key}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-6 text-sm text-red-400 font-medium">PIN non corretto</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCENT_PRESETS = [
  { label: 'Verde oliva',  value: 'var(--brand)' },
  { label: 'Rosso',        value: '#B91C1C' },
  { label: 'Blu marino',   value: '#1D4ED8' },
  { label: 'Arancio',      value: '#C2410C' },
  { label: 'Viola',        value: '#6D28D9' },
  { label: 'Grigio scuro', value: '#374151' },
  { label: 'Teal',         value: '#0F766E' },
  { label: 'Rosa',         value: '#BE185D' },
];

const TIMEZONES = [
  { value: 'Europe/Rome',   label: 'Roma (CET/CEST)' },
  { value: 'Europe/London', label: 'Londra (GMT/BST)' },
  { value: 'Europe/Paris',  label: 'Parigi (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlino (CET/CEST)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
  { value: 'America/New_York', label: 'New York (ET)' },
  { value: 'America/Chicago', label: 'Chicago (CT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
  { value: 'UTC', label: 'UTC' },
];

const LANGUAGES = [
  { value: 'it', label: '🇮🇹 Italiano' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'fr', label: '🇫🇷 Français' },
];

const FEATURE_DEFS: { slug: string; label: string; defaultEnabled: boolean; dangerous?: boolean }[] = [
  { slug: 'auto_breaks',          label: 'Pause automatiche',       defaultEnabled: true },
  { slug: 'staff_requests',       label: 'Richieste ferie / turni', defaultEnabled: true },
  { slug: 'kiosk_active',         label: 'Modalità kiosk',          defaultEnabled: true },
  { slug: 'geofence_punch',       label: 'Geofence timbrature',     defaultEnabled: false },
  { slug: 'visibility_management',label: 'Gestione visibilità',     defaultEnabled: true },
  { slug: 'department_creation',  label: 'Gestione reparti',        defaultEnabled: true },
  { slug: 'violation_rules',      label: 'Regole violazioni',       defaultEnabled: true },
  { slug: 'master_control_panel', label: 'Pannello di controllo',   defaultEnabled: true },
  { slug: 'unlock_with_pin',      label: 'Sblocco con PIN',         defaultEnabled: true },
  { slug: 'maintenance_mode',     label: 'Modalità manutenzione',   defaultEnabled: false, dangerous: true },
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin:             'Amministratore',
  manager:           'Manager',
  assistant_manager: 'Assistente Manager',
  capo:              'Capo',
  waiter:            'Cameriere',
  server:            'Server',
  bartender:         'Bartender',
  cook:              'Cuoco',
  chef:              'Chef',
  dishwasher:        'Lavapiatti',
};

const ROLE_OPTIONS: UserRole[] = [
  'admin', 'manager', 'assistant_manager', 'capo',
  'waiter', 'server', 'bartender', 'cook', 'chef', 'dishwasher',
];

interface TenantUser {
  id: string;
  first_name: string;
  last_name?: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  pin: string;
  sort_order: number;
  tenant_id?: string;
}

const EMPTY_USER: Omit<TenantUser, 'id' | 'sort_order'> = {
  first_name: '',
  last_name: '',
  email: '',
  role: 'waiter',
  status: 'active',
  department: '',
  pin: '',
};

// ---------------------------------------------------------------------------
// DipendentiTab
// ---------------------------------------------------------------------------

function DipendentiTab({ tenantId }: { tenantId: string }) {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<Omit<TenantUser, 'id' | 'sort_order'>>(EMPTY_USER);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const loadUsers = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('users')
        .select('id,first_name,last_name,email,role,status,department,pin,sort_order,tenant_id')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });
      if (err) throw err;
      setUsers((data ?? []) as TenantUser[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const openNew = () => {
    setForm({ ...EMPTY_USER });
    setEditingId('new');
    setShowPin(false);
    setError(null);
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const openEdit = (u: TenantUser) => {
    setForm({ first_name: u.first_name, last_name: u.last_name ?? '', email: u.email, role: u.role, status: u.status, department: u.department ?? '', pin: u.pin });
    setEditingId(u.id);
    setShowPin(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!supabase) return;
    if (!form.first_name.trim()) { setError('Il nome è obbligatorio'); return; }
    if (form.pin.length !== 4 || !/^\d{4}$/.test(form.pin)) { setError('Il PIN deve essere di 4 cifre'); return; }
    setSaving(true);
    setError(null);
    try {
      if (editingId === 'new') {
        const maxOrder = users.length > 0 ? Math.max(...users.map((u) => u.sort_order)) + 1 : 0;
        const { error: err } = await supabase.from('users').insert({
          first_name: form.first_name.trim(),
          last_name: form.last_name?.trim() || null,
          email: form.email.trim() || '',
          role: form.role,
          status: form.status,
          department: form.department?.trim() || null,
          pin: form.pin,
          sort_order: maxOrder,
          tenant_id: tenantId,
          language: 'it',
          theme: 'light',
          can_create_shifts: false,
          can_approve_shifts: false,
          can_view_total_hours: false,
          can_edit_staff_pins: false,
          can_manage_drafts: false,
          can_request_holidays: true,
          can_punch_from_app: true,
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('users').update({
          first_name: form.first_name.trim(),
          last_name: form.last_name?.trim() || null,
          email: form.email.trim() || '',
          role: form.role,
          status: form.status,
          department: form.department?.trim() || null,
          pin: form.pin,
        }).eq('id', editingId!);
        if (err) throw err;
      }
      setEditingId(null);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!supabase || !window.confirm('Eliminare questo dipendente? L\'azione è irreversibile.')) return;
    setDeleting(id);
    try {
      const { error: err } = await supabase.from('users').delete().eq('id', id);
      if (err) throw err;
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore eliminazione');
    } finally {
      setDeleting(null);
    }
  };

  const toggleStatus = async (u: TenantUser) => {
    if (!supabase) return;
    const next: UserStatus = u.status === 'active' ? 'suspended' : 'active';
    try {
      await supabase.from('users').update({ status: next }).eq('id', u.id);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, status: next } : x));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore aggiornamento');
    }
  };

  const setF = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-3" ref={topRef}>
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300 flex gap-2 items-center">
          <X className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Form aggiunta/modifica */}
      <AnimatePresence>
        {editingId !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-accent/30 bg-white dark:bg-neutral-900 p-4 space-y-3 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">
                {editingId === 'new' ? 'Nuovo dipendente' : 'Modifica dipendente'}
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400">Nome *</label>
                  <input value={form.first_name} onChange={(e) => setF('first_name', e.target.value)} placeholder="Mario"
                    className="w-full rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-slate-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-accent/40" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400">Cognome</label>
                  <input value={form.last_name ?? ''} onChange={(e) => setF('last_name', e.target.value)} placeholder="Rossi"
                    className="w-full rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-slate-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-accent/40" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400">Email</label>
                <input type="email" value={form.email} onChange={(e) => setF('email', e.target.value)} placeholder="mario@email.com"
                  className="w-full rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-slate-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400">Ruolo *</label>
                  <select value={form.role} onChange={(e) => setF('role', e.target.value as UserRole)}
                    className="w-full rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-slate-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-accent/40">
                    {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400">Reparto</label>
                  <input value={form.department ?? ''} onChange={(e) => setF('department', e.target.value)} placeholder="sala, bar, cucina…"
                    className="w-full rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-slate-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-accent/40" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400">PIN (4 cifre) *</label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={form.pin}
                    onChange={(e) => setF('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    maxLength={4}
                    inputMode="numeric"
                    className="w-full rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-2 pr-9 text-sm font-mono text-slate-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  <button type="button" onClick={() => setShowPin((p) => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-accent transition">
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-bold text-white hover:bg-accent-hover transition disabled:opacity-40 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  {saving ? 'Salvataggio…' : 'Salva'}
                </button>
                <button type="button" onClick={() => { setEditingId(null); setError(null); }}
                  className="rounded-xl bg-slate-100 dark:bg-neutral-800 px-3 py-2 text-sm font-bold text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700 transition active:scale-95">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista dipendenti */}
      {loading ? (
        <div className="py-6 text-center text-slate-400 text-sm">
          <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-2" />
          Caricamento…
        </div>
      ) : users.length === 0 && editingId === null ? (
        <div className="py-6 text-center text-slate-400 text-sm">
          <Users className="w-7 h-7 mx-auto mb-2 opacity-30" />
          Nessun dipendente ancora.
        </div>
      ) : (
        <div className="space-y-1.5">
          {users.map((u) => (
            <div key={u.id} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 border transition ${u.status === 'active' ? 'border-slate-100 dark:border-neutral-800 bg-white dark:bg-neutral-900' : 'border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 opacity-60'}`}>
              {/* Avatar iniziali */}
              <span className="w-8 h-8 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center shrink-0">
                {u.first_name.charAt(0)}{u.last_name?.charAt(0) ?? ''}
              </span>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-neutral-100 truncate">
                  {u.first_name} {u.last_name}
                  {u.status !== 'active' && <span className="ml-1.5 text-[10px] font-bold text-red-400">(sospeso)</span>}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-neutral-500 truncate">
                  {ROLE_LABELS[u.role]}{u.department ? ` · ${u.department}` : ''}
                </p>
              </div>
              {/* Azioni */}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleStatus(u)} title={u.status === 'active' ? 'Sospendi' : 'Riattiva'}
                  className={`p-1.5 rounded-lg transition ${u.status === 'active' ? 'text-brand-500 hover:bg-brand-50 dark:hover:bg-green-950/30' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800'}`}>
                  {u.status === 'active' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button onClick={() => openEdit(u)} title="Modifica"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(u.id)} title="Elimina" disabled={deleting === u.id}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition disabled:opacity-40">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pulsante aggiungi */}
      {editingId === null && (
        <button
          type="button"
          onClick={openNew}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent/30 py-2.5 text-sm font-semibold text-accent hover:bg-accent/5 transition active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          Aggiungi dipendente
        </button>
      )}
    </div>
  );
}

const DEFAULT_SETTINGS: TenantSettings = {
  timezone: 'Europe/Rome',
  defaultLanguage: 'it',
  featureFlags: Object.fromEntries(FEATURE_DEFS.map((f) => [f.slug, f.defaultEnabled])),
  workRules: {
    maxDailyHours: 9,
    maxDailyHoursEnabled: true,
    maxWeeklyHours: 48,
    maxWeeklyHoursEnabled: true,
    minRestHours: 11,
    minRestHoursEnabled: true,
    lateThresholdMinutes: 10,
    lateThresholdEnabled: true,
    criticEnabled: true,
    attentionEnabled: true,
    overlapEnabled: true,
  },
  geofence: null,
  modules: {
    timesheets: true,
    shifts: true,
    holidays: true,
    statistics: true,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function mergeSettings(base: TenantSettings, overrides: TenantSettings): TenantSettings {
  return {
    ...base,
    ...overrides,
    featureFlags: { ...(base.featureFlags ?? {}), ...(overrides.featureFlags ?? {}) },
    workRules: { ...(base.workRules ?? {}), ...(overrides.workRules ?? {}) },
    modules: { ...(base.modules ?? {}), ...(overrides.modules ?? {}) },
  };
}

// ---------------------------------------------------------------------------
// SettingsConfigPanel
// ---------------------------------------------------------------------------

type SettingsTab = 'features' | 'workrules' | 'geofence' | 'locale' | 'staff';

interface SettingsConfigPanelProps {
  tenantId: string;
  initial: TenantSettings;
  onSaved: (settings: TenantSettings) => void;
}

function SettingsConfigPanel({ tenantId, initial, onSaved }: SettingsConfigPanelProps) {
  const [tab, setTab] = useState<SettingsTab>('features');
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<TenantSettings>(() => mergeSettings(DEFAULT_SETTINGS, initial));

  const set = <K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const setFlag = (slug: string, enabled: boolean) =>
    setSettings((prev) => ({
      ...prev,
      featureFlags: { ...(prev.featureFlags ?? {}), [slug]: enabled },
    }));

  const setWorkRule = <K extends keyof NonNullable<TenantSettings['workRules']>>(
    key: K, value: NonNullable<TenantSettings['workRules']>[K]
  ) =>
    setSettings((prev) => ({
      ...prev,
      workRules: { ...(prev.workRules ?? {}), [key]: value },
    }));

  const setModule = (key: keyof NonNullable<TenantSettings['modules']>, value: boolean) =>
    setSettings((prev) => ({
      ...prev,
      modules: { ...(prev.modules ?? {}), [key]: value },
    }));

  const handleSave = async () => {
    if (!supabase) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .update({ settings, updated_at: new Date().toISOString() })
        .eq('id', tenantId)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (data) onSaved((data as Tenant).settings ?? settings);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'staff',     label: 'Dipendenti',   icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'features',  label: 'Funzionalità', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'workrules', label: 'Regole turni', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'geofence',  label: 'Geofence',     icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: 'locale',    label: 'Lingua/Fuso',  icon: <Languages className="w-3.5 h-3.5" /> },
  ];

  const wr = settings.workRules ?? {};
  const mods = settings.modules ?? {};
  const flags = settings.featureFlags ?? {};

  return (
    <div className="mt-3 rounded-xl border border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-neutral-800 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'text-accent border-b-2 border-accent bg-white dark:bg-neutral-900'
                : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {/* TAB: Dipendenti */}
        {tab === 'staff' && (
          <DipendentiTab tenantId={tenantId} />
        )}

        {/* TAB: Funzionalità */}
        {tab === 'features' && (
          <>
            <p className="text-[11px] text-slate-400 dark:text-neutral-500 mb-3">Abilita o disabilita i moduli per questa sede.</p>

            <div className="space-y-1 mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Moduli principali</p>
              {([
                { key: 'timesheets', label: 'Presenze (timbrature)' },
                { key: 'shifts',     label: 'Turni (tabellone)' },
                { key: 'holidays',   label: 'Ferie e richieste' },
                { key: 'statistics', label: 'Statistiche ore' },
              ] as { key: keyof NonNullable<TenantSettings['modules']>; label: string }[]).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-slate-700 dark:text-neutral-200">{label}</span>
                  <Toggle value={mods[key] !== false} onChange={(v) => setModule(key, v)} />
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 dark:border-neutral-800 pt-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Funzionalità avanzate</p>
              {FEATURE_DEFS.map((f) => (
                <div key={f.slug} className="flex items-center justify-between py-1.5">
                  <span className={`text-sm ${f.dangerous ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-neutral-200'}`}>
                    {f.label}
                  </span>
                  <Toggle value={flags[f.slug] !== false ? (flags[f.slug] ?? f.defaultEnabled) : false} onChange={(v) => setFlag(f.slug, v)} danger={f.dangerous} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* TAB: Regole turni */}
        {tab === 'workrules' && (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-400 dark:text-neutral-500">Valori predefiniti per le regole di lavoro. L'admin della sede può modificarli.</p>

            <RuleRow
              label="Ore max giornaliere"
              enabled={wr.maxDailyHoursEnabled !== false}
              onToggle={(v) => setWorkRule('maxDailyHoursEnabled', v)}
            >
              <NumberInput value={wr.maxDailyHours ?? 9} min={4} max={16} onChange={(v) => setWorkRule('maxDailyHours', v)} suffix="h" />
            </RuleRow>

            <RuleRow
              label="Ore max settimanali"
              enabled={wr.maxWeeklyHoursEnabled !== false}
              onToggle={(v) => setWorkRule('maxWeeklyHoursEnabled', v)}
            >
              <NumberInput value={wr.maxWeeklyHours ?? 48} min={20} max={80} onChange={(v) => setWorkRule('maxWeeklyHours', v)} suffix="h" />
            </RuleRow>

            <RuleRow
              label="Riposo minimo tra turni"
              enabled={wr.minRestHoursEnabled !== false}
              onToggle={(v) => setWorkRule('minRestHoursEnabled', v)}
            >
              <NumberInput value={wr.minRestHours ?? 11} min={6} max={24} onChange={(v) => setWorkRule('minRestHours', v)} suffix="h" />
            </RuleRow>

            <RuleRow
              label="Soglia ritardo tollerato"
              enabled={wr.lateThresholdEnabled !== false}
              onToggle={(v) => setWorkRule('lateThresholdEnabled', v)}
            >
              <NumberInput value={wr.lateThresholdMinutes ?? 10} min={0} max={60} onChange={(v) => setWorkRule('lateThresholdMinutes', v)} suffix="min" />
            </RuleRow>

            <div className="border-t border-slate-200 dark:border-neutral-800 pt-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Alert automatici</p>
              {([
                { key: 'criticEnabled',    label: 'Alert critico (turno lungo + riposo insufficiente)' },
                { key: 'attentionEnabled', label: 'Alert attenzione (ore oltre limite)' },
                { key: 'overlapEnabled',   label: 'Alert sovrapposizione turni' },
              ] as { key: keyof NonNullable<TenantSettings['workRules']>; label: string }[]).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <span className="text-sm text-slate-700 dark:text-neutral-200 pr-4">{label}</span>
                  <Toggle value={(wr[key] as boolean | undefined) !== false} onChange={(v) => setWorkRule(key, v as never)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: Geofence */}
        {tab === 'geofence' && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400 dark:text-neutral-500">
              Coordinate GPS del locale per la funzione geofence (timbratura entro un raggio).
              Richiede di abilitare "Geofence timbrature" nelle Funzionalità.
            </p>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-neutral-200">Geofence attiva</span>
              <Toggle
                value={settings.geofence != null}
                onChange={(v) => set('geofence', v ? { lat: 41.9028, lng: 12.4964, radiusM: 100 } : null)}
              />
            </div>
            {settings.geofence != null && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400">Latitudine</label>
                    <input
                      type="number" step="0.000001"
                      value={settings.geofence.lat}
                      onChange={(e) => set('geofence', { ...settings.geofence!, lat: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-slate-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400">Longitudine</label>
                    <input
                      type="number" step="0.000001"
                      value={settings.geofence.lng}
                      onChange={(e) => set('geofence', { ...settings.geofence!, lng: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-slate-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400">Raggio (metri)</label>
                  <input
                    type="number" min={10} max={5000}
                    value={settings.geofence.radiusM}
                    onChange={(e) => set('geofence', { ...settings.geofence!, radiusM: parseInt(e.target.value) || 100 })}
                    className="w-full rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-slate-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Lat {settings.geofence.lat.toFixed(5)} · Lng {settings.geofence.lng.toFixed(5)} · R {settings.geofence.radiusM}m
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB: Locale */}
        {tab === 'locale' && (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-400 dark:text-neutral-500">Lingua predefinita e fuso orario della sede.</p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-neutral-300">Lingua predefinita</label>
              <select
                value={settings.defaultLanguage ?? 'it'}
                onChange={(e) => set('defaultLanguage', e.target.value as 'it' | 'en' | 'es' | 'fr')}
                className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2.5 text-sm text-slate-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-neutral-300">Fuso orario</label>
              <select
                value={settings.timezone ?? 'Europe/Rome'}
                onChange={(e) => set('timezone', e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2.5 text-sm text-slate-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Salva — non mostrato nel tab Dipendenti (ha salvataggio inline) */}
        {tab !== 'staff' && (
          <div className="pt-2 border-t border-slate-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition disabled:opacity-40"
            >
              <Check className="w-4 h-4" />
              {saving ? 'Salvataggio…' : 'Salva impostazioni sede'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small reusable components
// ---------------------------------------------------------------------------

function Toggle({ value, onChange, danger }: { value: boolean; onChange: (v: boolean) => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 shrink-0 ${
        value
          ? danger ? 'bg-red-500' : 'bg-accent'
          : 'bg-slate-200 dark:bg-neutral-700'
      }`}
      style={{ minWidth: '2.5rem', height: '1.375rem' }}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          value ? 'translate-x-[1.125rem]' : 'translate-x-0'
        }`}
        style={{ width: '1.125rem', height: '1.125rem' }}
      />
    </button>
  );
}

function RuleRow({ label, enabled, onToggle, children }: {
  label: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <Toggle value={enabled} onChange={onToggle} />
      <span className={`text-sm flex-1 ${enabled ? 'text-slate-700 dark:text-neutral-200' : 'text-slate-400 dark:text-neutral-500'}`}>{label}</span>
      <div className={`transition-opacity ${enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
        {children}
      </div>
    </div>
  );
}

function NumberInput({ value, min, max, onChange, suffix }: {
  value: number; min: number; max: number; onChange: (v: number) => void; suffix: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number" min={min} max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
        className="w-16 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 text-sm text-center text-slate-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      <span className="text-xs text-slate-400">{suffix}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TenantForm
// ---------------------------------------------------------------------------

interface TenantFormProps {
  initial?: Partial<Tenant>;
  onSave: (data: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  /** Solo per nuova sede: se true, popola con dati demo da Osteria Basilico */
  seedDemo?: boolean;
  onSeedDemoChange?: (v: boolean) => void;
}

function TenantForm({ initial, onSave, onCancel, saving, seedDemo = true, onSeedDemoChange }: TenantFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [accent, setAccent] = useState(initial?.accent_color ?? 'var(--brand)');
  const [slugManual, setSlugManual] = useState(!!initial?.slug);
  const [logoUrl, setLogoUrl] = useState(initial?.logo_url ?? '');
  const [headerFont, setHeaderFont] = useState(initial?.settings?.header_font ?? 'parisienne');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!slugManual) setSlug(slugify(name));
  }, [name, slugManual]);

  const handleLogoUpload = async (file: File) => {
    if (!supabase) return;
    if (!file.type.startsWith('image/')) { setUploadError('Seleziona un file immagine'); return; }
    if (file.size > 2 * 1024 * 1024) { setUploadError('Immagine troppo grande (max 2 MB)'); return; }
    setUploading(true);
    setUploadError(null);
    try {
      const ext = file.name.split('.').pop() ?? 'png';
      const path = `logos/${slug || slugify(name) || 'sede'}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('app-config')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('app-config').getPublicUrl(path);
      setLogoUrl(publicUrl);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Errore upload');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      name: name.trim(),
      slug: slug.trim(),
      accent_color: accent,
      plan: 'basic',
      is_active: initial?.is_active ?? true,
      logo_url: logoUrl || null,
      settings: { ...(initial?.settings ?? DEFAULT_SETTINGS), header_font: headerFont },
    });
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      onSubmit={handleSubmit}
      className="space-y-4 p-5 bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-700 shadow-sm"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{initial?.id ? 'Modifica sede' : 'Nuova sede'}</p>

      {/* Nome */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-600 dark:text-neutral-300">Nome sede *</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es. Ristorante Mario"
          className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2.5 text-sm text-slate-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
        />
      </div>

      {/* Slug */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-600 dark:text-neutral-300">Slug (sottodominio) *</label>
        <div className="flex gap-2 items-center">
          <input
            required
            value={slug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugManual(true); }}
            placeholder="es-ristorante-mario"
            pattern="[a-z0-9\-]+"
            className="flex-1 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2.5 text-sm font-mono text-slate-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
          />
          <button type="button" onClick={() => { setSlugManual(false); setSlug(slugify(name)); }} className="text-xs text-accent hover:underline shrink-0">Auto</button>
        </div>
        <p className="text-[10px] text-slate-400">Sarà il sottodominio: <span className="font-mono">{slug || '…'}.tuodominio.com</span></p>
      </div>

      {/* Colore */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600 dark:text-neutral-300">Colore principale</label>
        <div className="flex flex-wrap gap-2 items-center">
          {ACCENT_PRESETS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              title={label}
              onClick={() => setAccent(value)}
              className={`w-7 h-7 rounded-full transition-all ${accent === value ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
              style={{ backgroundColor: value }}
            />
          ))}
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer rounded-lg border border-slate-200 dark:border-neutral-600 px-2 py-1 hover:bg-slate-50 dark:hover:bg-neutral-800 transition">
            <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0" style={{ backgroundColor: accent }} />
            Custom
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="sr-only" />
          </label>
        </div>
        <div className="rounded-xl px-4 py-2.5 text-white text-sm font-semibold" style={{ backgroundColor: accent }}>
          {name || 'Nome sede'}
        </div>
      </div>

      {/* Font intestazione */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600 dark:text-neutral-300">Font intestazione app</label>
        <div className="grid grid-cols-1 gap-1.5">
          {HEADER_FONTS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setHeaderFont(f.id)}
              className={`flex items-center justify-between px-3 py-2 rounded-xl border transition text-left ${
                headerFont === f.id
                  ? 'border-accent bg-accent/10 text-accent dark:bg-accent/20'
                  : 'border-slate-200 dark:border-neutral-700 hover:border-accent/40 text-slate-700 dark:text-neutral-300'
              }`}
            >
              <span className="text-xs font-medium">{f.label}</span>
              <span className="text-base" style={{ fontFamily: f.value }}>
                {name || 'Sede'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Logo */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600 dark:text-neutral-300">Logo sede</label>
        <div className="flex items-center gap-3">
          {/* Anteprima */}
          <div className="w-14 h-14 rounded-xl border-2 border-dashed border-slate-200 dark:border-neutral-700 overflow-hidden flex items-center justify-center bg-slate-50 dark:bg-neutral-900 shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg rounded-xl"
                style={{ backgroundColor: accent }}>
                {(name || 'A').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
              </div>
            )}
          </div>
          {/* Controlli */}
          <div className="flex-1 space-y-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm font-semibold text-slate-600 dark:text-neutral-300 hover:bg-accent/5 hover:border-accent/40 hover:text-accent transition disabled:opacity-40 active:scale-95"
            >
              {uploading ? (
                <><div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />Caricamento…</>
              ) : (
                <><Plus className="w-4 h-4" />Carica immagine</>
              )}
            </button>
            {logoUrl && (
              <button type="button" onClick={() => setLogoUrl('')}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition">
                <X className="w-3.5 h-3.5" />Rimuovi logo
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }}
            />
          </div>
        </div>
        {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
        <p className="text-[10px] text-slate-400">PNG/JPG quadrata consigliata, max 2 MB. Usata come icona PWA e nell'app.</p>
      </div>

      {/* Dati demo — solo per nuova sede */}
      {!initial?.id && onSeedDemoChange && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-3 flex items-start gap-3">
          <Toggle value={seedDemo} onChange={onSeedDemoChange} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700 dark:text-neutral-200 leading-snug">
              Carica dati demo
            </p>
            <p className="text-[11px] text-slate-400 dark:text-neutral-500 leading-snug mt-0.5">
              Dipendenti anonimizzati + turni settimana corrente copiati da Osteria Basilico
            </p>
          </div>
        </div>
      )}

      {/* Bottoni */}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving || uploading || !name.trim() || !slug.trim()}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition disabled:opacity-40"
        >
          <Check className="w-4 h-4" />
          {saving ? 'Salvataggio…' : 'Salva'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl bg-slate-100 dark:bg-neutral-800 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-neutral-200 hover:bg-slate-200 dark:hover:bg-neutral-700 transition">
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.form>
  );
}

// ---------------------------------------------------------------------------
// SuperAdminPanel (main)
// ---------------------------------------------------------------------------

export default function SuperAdminPanel() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');

  // Reset brand neutro: sovrascrive le CSS var del tenant con valori fissi
  useEffect(() => {
    const root = document.documentElement;
    const prev: Record<string, string> = {};
    const neutralVars: Record<string, string> = {
      '--brand':       '#10b981',
      '--brand-hover': '#059669',
      '--accent':      '#10b981',
      '--accent-hover':'#059669',
    };
    Object.entries(neutralVars).forEach(([k, v]) => {
      prev[k] = root.style.getPropertyValue(k);
      root.style.setProperty(k, v);
    });
    // Forza dark mode neutra
    document.documentElement.classList.add('dark');
    return () => {
      Object.entries(prev).forEach(([k, v]) => root.style.setProperty(k, v));
    };
  }, []);

  if (!unlocked) {
    return <SuperAdminPinGate onUnlocked={() => setUnlocked(true)} />;
  }

  return <SuperAdminPanelInner />;
}

function SuperAdminPanelInner() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedSettings, setExpandedSettings] = useState<string | null>(null);
  const [seedDemo, setSeedDemo] = useState(true);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTenants = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase.from('tenants').select('*').order('created_at', { ascending: true });
      if (err) throw err;
      setTenants((data ?? []) as Tenant[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento sedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const handleCreate = async (data: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>) => {
    if (!supabase) return;
    setSaving(true);
    try {
      // Recupera l'id della sede appena creata per il seeding dei dati demo
      const { data: created, error: err } = await supabase
        .from('tenants')
        .insert({ ...data })
        .select('id')
        .maybeSingle();
      if (err) throw err;

      if (seedDemo && created?.id) {
        try {
          await seedTenantFromTemplate(supabase, created.id);
          showToast('Sede creata con dati demo!');
        } catch (seedErr) {
          // Il tenant è stato creato: segnala l'errore seed ma non bloccare
          setError(`Sede creata, ma errore nel caricamento dati demo: ${seedErr instanceof Error ? seedErr.message : String(seedErr)}`);
          showToast('Sede creata (dati demo parziali).');
        }
      } else {
        showToast('Sede creata!');
      }

      setShowForm(false);
      setSeedDemo(true); // reset per la prossima creazione
      await fetchTenants();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore creazione.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>) => {
    if (!supabase || !editingTenant) return;
    setSaving(true);
    try {
      const { error: err } = await supabase.from('tenants').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingTenant.id);
      if (err) throw err;
      showToast('Sede aggiornata!');
      setEditingTenant(null);
      await fetchTenants();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore aggiornamento.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (tenant: Tenant) => {
    if (!supabase) return;
    try {
      await supabase.from('tenants').update({ is_active: !tenant.is_active, updated_at: new Date().toISOString() }).eq('id', tenant.id);
      showToast(tenant.is_active ? 'Sede disattivata.' : 'Sede attivata.');
      await fetchTenants();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore toggle.');
    }
  };

  const copySlug = (slug: string) => {
    navigator.clipboard.writeText(slug).then(() => showToast('Slug copiato!'));
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.reload();
  };

  return (
    <div className="min-h-screen min-h-dvh bg-[#0f1117] font-sans text-neutral-100"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-[#0f1117]/95 backdrop-blur-md border-b border-white/8 shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" style={{ width: '1.125rem', height: '1.125rem' }} />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white leading-tight truncate">Super Admin</h1>
              <p className="text-[11px] text-white/40 leading-tight hidden sm:block">Gestione sedi</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setShowForm(true); setEditingTenant(null); }}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-2 sm:px-4 sm:py-2.5 text-sm font-bold text-white active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuova sede</span>
              <span className="sm:hidden">Nuova</span>
            </button>
            <button
              onClick={handleLogout}
              title="Esci da Super Admin"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/6 hover:bg-red-500/20 hover:text-red-400 text-white/40 transition active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4"
        style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
      >

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-950/30 border border-red-800 px-4 py-3 text-sm text-red-300 flex gap-2 items-start">
            <X className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 shrink-0 p-1"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Form nuova sede */}
        <AnimatePresence>
          {showForm && !editingTenant && (
            <TenantForm
              onSave={handleCreate}
              onCancel={() => setShowForm(false)}
              saving={saving}
              seedDemo={seedDemo}
              onSeedDemoChange={setSeedDemo}
            />
          )}
        </AnimatePresence>

        {/* Lista sedi */}
          {loading ? (
          <div className="text-center py-16 text-white/40">
            <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
            Caricamento…
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Nessuna sede configurata.
          </div>
        ) : (
          <div className="space-y-3">
            {tenants.map((t) => (
              <motion.div
                key={t.id}
                layout
                className={`rounded-2xl border ${t.is_active ? 'border-white/10 bg-white/6' : 'border-white/6 bg-white/3 opacity-60'} overflow-hidden`}
              >
                <AnimatePresence mode="wait">
                  {editingTenant?.id === t.id ? (
                    <div key="edit" className="p-4">
                      <TenantForm
                        initial={t}
                        onSave={handleUpdate}
                        onCancel={() => setEditingTenant(null)}
                        saving={saving}
                      />
                    </div>
                  ) : (
                    <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      {/* Card principale */}
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                        {/* Logo / swatch colore */}
                        <span className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center mt-0.5 overflow-hidden" style={{ backgroundColor: t.accent_color }}>
                          {t.logo_url
                            ? <img src={t.logo_url} alt={t.name} className="w-full h-full object-cover" />
                            : <Palette className="w-5 h-5 text-white/80" />}
                        </span>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-sm">{t.name}</span>
                              {!t.is_active && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-700/40">Inattiva</span>}
                            </div>

                            {/* Slug */}
                            <div className="flex items-center gap-1 mt-1">
                              <Globe className="w-3 h-3 text-white/30 shrink-0" />
                              <span className="text-xs font-mono text-white/40 truncate">{t.slug}</span>
                              <button onClick={() => copySlug(t.slug)} className="text-white/20 hover:text-emerald-400 transition p-0.5 shrink-0" title="Copia slug">
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>

                            {/* URL sito */}
                            <div className="flex items-center gap-1 mt-0.5">
                              <a
                                href={`https://${t.slug}.vercel.app`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-emerald-400 hover:underline font-medium min-w-0"
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate">{t.slug}.vercel.app</span>
                              </a>
                              <button
                                onClick={() => navigator.clipboard.writeText(`https://${t.slug}.vercel.app`).then(() => showToast('URL copiato!'))}
                                className="text-white/20 hover:text-emerald-400 transition p-0.5 shrink-0"
                                title="Copia URL"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Barra azioni */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/8">
                          <button
                            onClick={() => setExpandedSettings(expandedSettings === t.id ? null : t.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition active:scale-95 ${
                              expandedSettings === t.id
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-white/6 text-white/50 hover:bg-emerald-500/15 hover:text-emerald-400'
                            }`}
                          >
                            <Settings className="w-3.5 h-3.5" />
                            Impostazioni
                          </button>
                          <button
                            onClick={() => { setEditingTenant(t); setShowForm(false); setExpandedSettings(null); }}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 bg-white/6 text-white/50 hover:bg-white/12 hover:text-white text-xs font-semibold transition active:scale-95"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Modifica
                          </button>
                          <button
                            onClick={() => toggleActive(t)}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition active:scale-95 ${
                              t.is_active
                                ? 'bg-emerald-500/15 text-emerald-400 hover:bg-red-500/15 hover:text-red-400'
                                : 'bg-white/6 text-white/40 hover:bg-emerald-500/15 hover:text-emerald-400'
                            }`}
                          >
                            {t.is_active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                            {t.is_active ? 'Attiva' : 'Inattiva'}
                          </button>
                        </div>
                      </div>

                      {/* Settings panel espandibile */}
                      <AnimatePresence>
                        {expandedSettings === t.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden border-t border-white/8"
                          >
                            <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                              <ChevronDown className="w-3.5 h-3.5 text-white/30" />
                              <span className="text-xs font-bold text-white/40 uppercase tracking-wider">Impostazioni sede</span>
                            </div>
                            <div className="px-4 pb-4">
                              <SettingsConfigPanel
                                tenantId={t.id}
                                initial={t.settings ?? {}}
                                onSaved={(settings) => {
                                  setTenants((prev) => prev.map((x) => x.id === t.id ? { ...x, settings } : x));
                                  showToast('Impostazioni salvate!');
                                }}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}

        {/* Spazio bottom per safe area */}
        <div className="h-6" />
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg z-50 whitespace-nowrap"
            style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
