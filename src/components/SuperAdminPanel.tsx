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
  UserPlus, Trash2, ChevronRight, Eye, EyeOff, ShieldCheck, Delete, LogOut,
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
    <div
      className="min-h-screen min-h-dvh flex flex-col items-center justify-center px-6 select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'radial-gradient(ellipse at 50% 10%, #0e5f75 0%, #003380 38%, #001055 75%, #000820 100%)',
      }}
    >
      {/* Bordo luminoso in alto */}
      <div className="pointer-events-none fixed inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,182,212,0.08) 0%, transparent 30%)' }} />

      {/* Logo / icona */}
      <div className="mb-8 flex flex-col items-center gap-3 relative">
        <div style={{ padding: 4, borderRadius: 22, background: 'linear-gradient(135deg, rgba(6,182,212,0.5), rgba(0,82,255,0.5))', boxShadow: '0 8px 32px rgba(0,82,255,0.35)' }}>
          <img
            src="/flow-app-icon.png"
            alt="FLOW"
            width={68}
            height={68}
            style={{ borderRadius: 18, display: 'block' }}
            draggable={false}
          />
        </div>
        <div className="text-center">
          <h1 className="text-lg font-bold text-white tracking-tight">Super Admin</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(6,182,212,0.65)' }}>Inserisci il PIN per accedere</p>
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
            className="w-3 h-3 rounded-full transition-all duration-150"
            style={i < digits.length
              ? { background: error ? '#f87171' : 'linear-gradient(110deg, #06B6D4, #0052FF)', boxShadow: error ? '0 0 8px rgba(248,113,113,0.5)' : '0 0 8px rgba(6,182,212,0.55)' }
              : { background: 'rgba(255,255,255,0.15)' }
            }
          />
        ))}
      </motion.div>

      {/* Tastierino numerico */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] relative">
        {PAD.flat().map((key, i) => {
          if (key === '') return <div key={i} />;
          const isDelete = key === '⌫';
          return (
            <button
              key={i}
              onClick={() => isDelete ? handleDelete() : handleDigit(key)}
              className={`h-14 rounded-2xl text-lg font-bold transition-all active:scale-95 ${
                isDelete ? 'bg-transparent text-white/40 hover:text-white/70' : 'text-white'
              }`}
              style={isDelete ? undefined : {
                background: 'linear-gradient(160deg, rgba(6,100,140,0.50) 0%, rgba(0,40,120,0.65) 100%)',
                border: '1px solid rgba(6,182,212,0.25)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)',
              }}
              onMouseEnter={e => { if (!isDelete) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(6,182,212,0.55)'; }}
              onMouseLeave={e => { if (!isDelete) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(6,182,212,0.25)'; }}
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
  const [confirmClearDemo, setConfirmClearDemo] = useState(false);
  const [clearingDemo, setClearingDemo] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const demoUsers = users.filter((u) => u.email?.endsWith('@demo.local'));

  const handleClearDemo = async () => {
    if (!supabase || demoUsers.length === 0) return;
    setClearingDemo(true);
    try {
      const ids = demoUsers.map((u) => u.id);
      const { error: err } = await supabase.from('users').delete().in('id', ids);
      if (err) throw err;
      setConfirmClearDemo(false);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore rimozione dati demo');
    } finally {
      setClearingDemo(false);
    }
  };

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
                  className={`p-1.5 rounded-lg transition ${u.status === 'active' ? 'text-brand-500 hover:bg-brand-50 dark:hover:bg-[#0052FF]/10' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800'}`}>
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

      {/* Banner dati demo */}
      {demoUsers.length > 0 && editingId === null && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-950/20 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-xs">⚠</span>
            <p className="text-xs font-semibold text-amber-300">
              {demoUsers.length} dipendent{demoUsers.length === 1 ? 'e demo attivo' : 'i demo attivi'} — email <span className="font-mono">@demo.local</span>
            </p>
          </div>
          {!confirmClearDemo ? (
            <button
              type="button"
              onClick={() => setConfirmClearDemo(true)}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Rimuovi dati demo
            </button>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[11px] text-amber-400/80 text-center">
                Elimina {demoUsers.length} utenti demo? L'azione è irreversibile.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmClearDemo(false)}
                  className="flex-1 rounded-xl py-1.5 text-xs font-semibold bg-white/8 text-white/50 hover:bg-white/12 transition"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleClearDemo}
                  disabled={clearingDemo}
                  className="flex-1 rounded-xl py-1.5 text-xs font-bold bg-amber-600 text-white hover:bg-amber-500 transition disabled:opacity-50"
                >
                  {clearingDemo ? 'Rimozione…' : 'Sì, rimuovi'}
                </button>
              </div>
            </div>
          )}
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
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<TenantSettings>(() => mergeSettings(DEFAULT_SETTINGS, initial));
  const [dirty, setDirty] = useState(false);

  const set = <K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setSaved(false);
  };

  const setFlag = (slug: string, enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      featureFlags: { ...(prev.featureFlags ?? {}), [slug]: enabled },
    }));
    setDirty(true);
    setSaved(false);
  };

  const setWorkRule = <K extends keyof NonNullable<TenantSettings['workRules']>>(
    key: K, value: NonNullable<TenantSettings['workRules']>[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      workRules: { ...(prev.workRules ?? {}), [key]: value },
    }));
    setDirty(true);
    setSaved(false);
  };

  const setModule = (key: keyof NonNullable<TenantSettings['modules']>, value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      modules: { ...(prev.modules ?? {}), [key]: value },
    }));
    setDirty(true);
    setSaved(false);
  };

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
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
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

        {/* Salva impostazioni — sempre visibile, disabilitato nel tab Dipendenti (salvataggio inline per-utente) */}
        <div className="pt-2 border-t border-slate-200 dark:border-neutral-800 space-y-1.5">
          {dirty && !saving && (
            <p className="text-center text-[11px] font-semibold text-amber-500 dark:text-amber-400">
              ● Modifiche non salvate
            </p>
          )}
          {saved && (
            <p className="text-center text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              ✓ Impostazioni salvate
            </p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || tab === 'staff'}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition disabled:opacity-40"
          >
            <Check className="w-4 h-4" />
            {saving ? 'Salvataggio…' : tab === 'staff' ? 'Salvataggio inline per dipendente' : 'Salva impostazioni sede'}
          </button>
        </div>
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
  /** Solo per nuova sede: se true, popola con dati demo del tenant template */
  seedDemo?: boolean;
  onSeedDemoChange?: (v: boolean) => void;
}

function TenantForm({ initial, onSave, onCancel, saving, seedDemo = true, onSeedDemoChange }: TenantFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugManual, setSlugManual] = useState(!!initial?.slug);

  useEffect(() => {
    if (!slugManual) setSlug(slugify(name));
  }, [name, slugManual]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      name: name.trim(),
      slug: slug.trim(),
      // Branding sempre FLOW — colore e font non configurabili per sede
      accent_color: '#0052FF',
      plan: 'basic',
      is_active: initial?.is_active ?? true,
      logo_url: null,
      settings: { ...(initial?.settings ?? DEFAULT_SETTINGS), header_font: 'inter' },
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

      {/* Nota branding — colore e logo fissi FLOW */}
      <div className="rounded-xl border border-[#0052FF]/20 bg-[#0052FF]/5 px-3.5 py-2.5 flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-full bg-[#0052FF] flex items-center justify-center shrink-0">
          <span className="text-white text-[10px] font-bold">F</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-neutral-400">
          Colore, font e logo sono fissi — brand FLOW per tutte le sedi.
        </p>
      </div>

      {/* Dati demo — solo per nuova sede */}
      {!initial?.id && onSeedDemoChange && (
        <div className="rounded-xl border border-[#0052FF]/20 bg-[#0052FF]/5 px-3.5 py-3 flex items-start gap-3">
          <Toggle value={seedDemo} onChange={onSeedDemoChange} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700 dark:text-neutral-200 leading-snug">
              Carica dati demo
            </p>
            <p className="text-[11px] text-slate-400 dark:text-neutral-500 leading-snug mt-0.5">
              Dipendenti anonimizzati + turni settimana corrente dal template demo
            </p>
          </div>
        </div>
      )}

      {/* Bottoni */}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving || !name.trim() || !slug.trim()}
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
      '--brand':       '#0052FF',
      '--brand-hover': '#003ACC',
      '--accent':      '#0052FF',
      '--accent-hover':'#003ACC',
    };
    Object.entries(neutralVars).forEach(([k, v]) => {
      prev[k] = root.style.getPropertyValue(k);
      root.style.setProperty(k, v);
    });
    return () => {
      Object.entries(prev).forEach(([k, v]) => root.style.setProperty(k, v));
    };
  }, []);

  if (!unlocked) {
    return <SuperAdminPinGate onUnlocked={() => setUnlocked(true)} />;
  }

  return <SuperAdminPanelInner />;
}

/** Credenziali admin create automaticamente alla nascita di una sede. */
interface NewAdminCredentials {
  tenantName: string;
  firstName: string;
  pin: string;
}

function NewAdminCredentialsModal({ creds, onClose }: { creds: NewAdminCredentials; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Sede: ${creds.tenantName}\nNome: ${creds.firstName}\nPIN: ${creds.pin}\nRuolo: Admin`;

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-white text-sm">Admin creato automaticamente</p>
            <p className="text-xs text-slate-500 dark:text-neutral-400">Salva queste credenziali in un posto sicuro</p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-neutral-800 rounded-xl p-4 space-y-2 font-mono text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-neutral-400 text-xs font-sans">Sede</span>
            <span className="font-semibold text-slate-800 dark:text-white">{creds.tenantName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-neutral-400 text-xs font-sans">Nome login</span>
            <span className="font-semibold text-slate-800 dark:text-white">{creds.firstName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-neutral-400 text-xs font-sans">PIN</span>
            <span className="text-2xl font-bold tracking-widest text-accent">{creds.pin}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-neutral-400 text-xs font-sans">Ruolo</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Admin</span>
          </div>
        </div>

        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          ⚠ Cambia il PIN subito dopo il primo accesso tramite il profilo utente nell'app.
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-neutral-700 py-2.5 text-sm font-semibold text-slate-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-800 transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiato!' : 'Copia'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition"
          >
            Ho salvato
          </button>
        </div>
      </div>
    </div>
  );
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newAdminCreds, setNewAdminCreds] = useState<NewAdminCredentials | null>(null);

  // Modalità chiara per il pannello admin
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains('dark');
    document.documentElement.classList.remove('dark');
    return () => {
      if (wasDark) document.documentElement.classList.add('dark');
    };
  }, []);

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

      if (!created?.id) throw new Error('ID sede non ricevuto dal server.');

      // ── Crea automaticamente un profilo Admin con PIN casuale ────────────────
      const adminPin = String(Math.floor(1000 + Math.random() * 9000)); // 4 cifre casuali
      const adminFirstName = 'Admin';
      const adminLastName = data.name; // usa il nome della sede come cognome
      const { error: adminErr } = await supabase.from('users').insert({
        tenant_id:            created.id,
        first_name:           adminFirstName,
        last_name:            adminLastName,
        email:                `admin@${data.slug}.local`,
        pin:                  adminPin,
        role:                 'admin',
        status:               'active',
        sort_order:           0,
        language:             'it',
        theme:                'light',
        can_create_shifts:    true,
        can_approve_shifts:   true,
        can_view_total_hours: true,
        can_edit_staff_pins:  true,
        can_manage_drafts:    true,
        can_request_holidays: false,
        can_punch_from_app:   true,
        hide_from_team_schedule: false,
        department:           null,
        hourly_rate_eur:      null,
        enabled_features:     null,
        employment_start_date: null,
        employment_end_date:   null,
      });
      if (adminErr) {
        // Non blocca la creazione sede — segnala solo
        setError(`Sede creata, ma errore creazione admin: ${adminErr.message}`);
      } else {
        setNewAdminCreds({ tenantName: data.name, firstName: adminFirstName, pin: adminPin });
      }

      if (seedDemo) {
        try {
          await seedTenantFromTemplate(supabase, created.id);
          showToast('Sede creata con dati demo!');
        } catch (seedErr) {
          setError(`Sede creata, ma errore dati demo: ${seedErr instanceof Error ? seedErr.message : String(seedErr)}`);
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

  const handleDeleteTenant = async (tenant: Tenant) => {
    if (!supabase) return;
    setDeleting(true);
    try {
      // Elimina prima gli utenti collegati, poi la sede
      await supabase.from('users').delete().eq('tenant_id', tenant.id);
      const { error: err } = await supabase.from('tenants').delete().eq('id', tenant.id);
      if (err) throw err;
      setConfirmDeleteId(null);
      setExpandedSettings(null);
      showToast(`Sede "${tenant.name}" eliminata.`);
      await fetchTenants();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore eliminazione sede.');
    } finally {
      setDeleting(false);
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
    // light mode panel
    <div className="min-h-screen min-h-dvh font-sans text-slate-900 bg-[#f8fafc]"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Modal credenziali admin create automaticamente */}
      {newAdminCreds && (
        <NewAdminCredentialsModal creds={newAdminCreds} onClose={() => setNewAdminCreds(null)} />
      )}

      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#06B6D4]/20 shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/flow-app-icon.png"
              alt="FLOW"
              width={36}
              height={36}
              style={{ borderRadius: 10, flexShrink: 0 }}
              draggable={false}
            />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 leading-tight truncate">Super Admin</h1>
              <p className="text-[11px] text-[#0284C7] leading-tight hidden sm:block">Gestione sedi</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setShowImport(!showImport); setShowForm(false); setEditingTenant(null); }}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 text-sm font-bold active:scale-95 transition ${showImport ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}
            >
              <ChevronRight className="w-4 h-4 rotate-90" />
              <span className="hidden sm:inline">Importa storico</span>
              <span className="sm:hidden">Import</span>
            </button>
            <button
              onClick={() => { setShowForm(true); setEditingTenant(null); setShowImport(false); }}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 text-sm font-bold text-white active:scale-95 transition"
              style={{ background: 'linear-gradient(110deg, #06B6D4, #0052FF)' }}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuova sede</span>
              <span className="sm:hidden">Nuova</span>
            </button>
            <button
              onClick={handleLogout}
              title="Esci da Super Admin"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-500 text-slate-400 transition active:scale-95"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4"
        style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
      >

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex gap-2 items-start">
            <X className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 shrink-0 p-1"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Import storico turni */}
        <AnimatePresence>
          {showImport && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <ImportStorico tenants={tenants} onClose={() => setShowImport(false)} />
            </motion.div>
          )}
        </AnimatePresence>

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
          <div className="text-center py-16 text-slate-400">
            <div className="w-8 h-8 border-2 border-[#06B6D4]/30 border-t-[#0052FF] rounded-full animate-spin mx-auto mb-3" />
            Caricamento…
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Nessuna sede configurata.
          </div>
        ) : (
          <div className="space-y-3">
            {tenants.map((t) => (
              <motion.div
                key={t.id}
                layout
                className={`rounded-2xl border shadow-sm ${t.is_active ? 'border-[#06B6D4]/20 bg-white' : 'border-slate-200 bg-slate-50/80 opacity-60'} overflow-hidden`}
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
                              <span className="font-bold text-slate-900 text-sm">{t.name}</span>
                              {!t.is_active && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200">Inattiva</span>}
                            </div>

                            {/* Slug */}
                            <div className="flex items-center gap-1 mt-1">
                              <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="text-xs font-mono text-slate-400 truncate">{t.slug}</span>
                              <button onClick={() => copySlug(t.slug)} className="text-slate-300 hover:text-[#0284C7] transition p-0.5 shrink-0" title="Copia slug">
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>

                            {/* URL sito */}
                            <div className="flex items-center gap-1 mt-0.5">
                              <a
                                href={`https://${t.slug}.vercel.app`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-[#0284C7] hover:underline font-medium min-w-0"
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate">{t.slug}.vercel.app</span>
                              </a>
                              <button
                                onClick={() => navigator.clipboard.writeText(`https://${t.slug}.vercel.app`).then(() => showToast('URL copiato!'))}
                                className="text-slate-300 hover:text-[#0284C7] transition p-0.5 shrink-0"
                                title="Copia URL"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Barra azioni */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#06B6D4]/12">
                          <button
                            onClick={() => setExpandedSettings(expandedSettings === t.id ? null : t.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition active:scale-95 ${
                              expandedSettings === t.id
                                ? 'bg-[#06B6D4]/10 text-[#0284C7]'
                                : 'bg-slate-100 text-slate-500 hover:bg-[#06B6D4]/8 hover:text-[#0284C7]'
                            }`}
                          >
                            <Settings className="w-3.5 h-3.5" />
                            Impostazioni
                          </button>
                          <button
                            onClick={() => { setEditingTenant(t); setShowForm(false); setExpandedSettings(null); }}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 text-xs font-semibold transition active:scale-95"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Modifica
                          </button>
                          <button
                            onClick={() => toggleActive(t)}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition active:scale-95 ${
                              t.is_active
                                ? 'bg-[#06B6D4]/10 text-[#0284C7] hover:bg-red-50 hover:text-red-500'
                                : 'bg-slate-100 text-slate-400 hover:bg-[#06B6D4]/8 hover:text-[#0284C7]'
                            }`}
                          >
                            {t.is_active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                            {t.is_active ? 'Attiva' : 'Inattiva'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(confirmDeleteId === t.id ? null : t.id)}
                            className="flex items-center justify-center rounded-xl py-2 px-2.5 bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition active:scale-95"
                            title="Elimina sede"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Pannello conferma eliminazione */}
                        <AnimatePresence>
                          {confirmDeleteId === t.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
                                <p className="text-xs font-semibold text-red-600 text-center">
                                  Eliminare <span className="font-bold text-red-700">"{t.name}"</span>?
                                </p>
                                <p className="text-[11px] text-red-500/80 text-center">
                                  Questa azione è irreversibile. Verranno eliminati tutti i dipendenti e i dati della sede.
                                </p>
                                <div className="flex gap-2 pt-1">
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="flex-1 rounded-xl py-2 text-xs font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
                                  >
                                    Annulla
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTenant(t)}
                                    disabled={deleting}
                                    className="flex-1 rounded-xl py-2 text-xs font-bold bg-red-600 text-white hover:bg-red-500 transition disabled:opacity-50"
                                  >
                                    {deleting ? 'Eliminazione…' : 'Sì, elimina sede'}
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Settings panel espandibile */}
                      <AnimatePresence>
                        {expandedSettings === t.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden border-t border-[#06B6D4]/12"
                          >
                            <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                              <ChevronDown className="w-3.5 h-3.5 text-[#0284C7]/50" />
                              <span className="text-xs font-bold text-[#0284C7]/70 uppercase tracking-wider">Impostazioni sede</span>
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
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg z-50 whitespace-nowrap"
            style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImportStorico — upload CSV turni storici
// ---------------------------------------------------------------------------

interface ParsedRow {
  rawName: string;
  userId: string | null;
  userName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  type: 'lunch' | 'dinner';
}

function ImportStorico({ tenants, onClose }: { tenants: Tenant[]; onClose: () => void }) {
  const [selectedTenantId, setSelectedTenantId] = useState(tenants[0]?.id ?? '');
  const [tenantUsers, setTenantUsers] = useState<{ id: string; first_name: string; last_name?: string }[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; skipped: string[] } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!supabase || !selectedTenantId) return;
    supabase.from('users').select('id,first_name,last_name').eq('tenant_id', selectedTenantId).eq('status', 'active')
      .then(({ data }) => setTenantUsers((data ?? []) as { id: string; first_name: string; last_name?: string }[]));
  }, [selectedTenantId]);

  const matchUser = (name: string) => {
    const n = name.trim().toLowerCase();
    return tenantUsers.find((u) => {
      const full = `${u.first_name} ${u.last_name ?? ''}`.trim().toLowerCase();
      return full === n || u.first_name.toLowerCase() === n;
    }) ?? null;
  };

  const downloadTemplate = () => {
    const csv = 'Nome,Data,Inizio,Fine\nGUSTAVO,29/01/2026,10:00,16:00\nGUSTAVO,29/01/2026,16:30,23:00\nALEXIS,30/01/2026,10:00,16:00\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = 'template_turni_storici.csv';
    a.click();
  };

  const parseDate = (raw: string): string | null => {
    const p = raw.trim().split(/[\/\-\.]/);
    if (p.length !== 3) return null;
    if (p[2].length === 4) return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
    if (p[0].length === 4) return `${p[0]}-${p[1].padStart(2,'0')}-${p[2].padStart(2,'0')}`;
    return null;
  };

  const parseTime = (raw: string): string | null => {
    const t = raw.trim();
    return /^\d{1,2}:\d{2}$/.test(t) ? t.padStart(5, '0') : null;
  };

  const handleFile = (file: File) => {
    setParseError(null); setRows([]); setImportResult(null); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? '';
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) { setParseError('File vuoto o non valido.'); return; }
      const dataLines = lines[0].toLowerCase().includes('nome') ? lines.slice(1) : lines;
      const parsed: ParsedRow[] = [];
      const errors: string[] = [];
      dataLines.forEach((line, i) => {
        const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 4) return;
        const [rawName, rawDate, rawStart, rawEnd] = cols;
        if (!rawName || !rawDate || !rawStart || !rawEnd) return;
        const date = parseDate(rawDate);
        const startTime = parseTime(rawStart);
        const endTime = parseTime(rawEnd);
        if (!date) { errors.push(`Riga ${i + 2}: data non valida "${rawDate}"`); return; }
        if (!startTime || !endTime) { errors.push(`Riga ${i + 2}: ora non valida`); return; }
        const matched = matchUser(rawName);
        parsed.push({ rawName, userId: matched?.id ?? null, userName: matched ? `${matched.first_name} ${matched.last_name ?? ''}`.trim() : null, date, startTime, endTime, type: startTime < '15:00' ? 'lunch' : 'dinner' });
      });
      if (errors.length) setParseError(errors.slice(0, 3).join(' | '));
      setRows(parsed);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (!supabase || !selectedTenantId) return;
    const valid = rows.filter((r) => r.userId);
    const skipped = [...new Set(rows.filter((r) => !r.userId).map((r) => r.rawName))];
    setImporting(true);
    try {
      const payload = valid.map((r) => ({ tenant_id: selectedTenantId, user_id: r.userId!, date: r.date, start_time: r.startTime, end_time: r.endTime, type: r.type, approval_status: 'confirmed' as const }));
      for (let i = 0; i < payload.length; i += 200) {
        const { error } = await supabase.from('shifts').insert(payload.slice(i, i + 200));
        if (error) throw error;
      }
      setImportResult({ ok: valid.length, skipped });
      setRows([]); setFileName('');
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Errore import');
    } finally {
      setImporting(false);
    }
  };

  const matched = rows.filter((r) => r.userId);
  const unmatched = [...new Set(rows.filter((r) => !r.userId).map((r) => r.rawName))];

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-50 p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-amber-700">Importa turni storici</h2>
          <p className="text-[11px] text-amber-600/70 mt-0.5">CSV con turni passati. I nomi non riconosciuti vengono ignorati.</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition p-1"><X className="w-4 h-4" /></button>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Sede di destinazione</label>
        <select value={selectedTenantId} onChange={(e) => { setSelectedTenantId(e.target.value); setRows([]); setImportResult(null); }}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/40">
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={downloadTemplate}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition">
          <ChevronRight className="w-3.5 h-3.5 -rotate-90" />
          Scarica template CSV
        </button>
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-100 py-2.5 text-xs font-bold text-amber-700 hover:bg-amber-200 transition">
          <ChevronRight className="w-3.5 h-3.5 rotate-90" />
          {fileName ? fileName.slice(0, 22) + (fileName.length > 22 ? '…' : '') : 'Carica CSV'}
        </button>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      </div>

      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Formato CSV</p>
        <code className="text-[11px] text-slate-500 leading-relaxed whitespace-pre">{`Nome,Data,Inizio,Fine\nGUSTAVO,29/01/2026,10:00,16:00\nGUSTAVO,29/01/2026,16:30,23:00`}</code>
        <p className="text-[10px] text-slate-400 mt-1.5">Una riga per turno &nbsp;·&nbsp; Data: GG/MM/AAAA &nbsp;·&nbsp; Ora: HH:MM</p>
      </div>

      {parseError && <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{parseError}</div>}

      {importResult && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-3 space-y-1">
          <p className="text-sm font-bold text-emerald-700">✓ {importResult.ok} turni importati con successo!</p>
          {importResult.skipped.length > 0 && <p className="text-[11px] text-amber-600">Ignorati (non trovati): {importResult.skipped.join(', ')}</p>}
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700">✓ {matched.length} turni pronti</span>
            {unmatched.length > 0 && <span className="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-[11px] font-bold text-red-600">✗ Non riconosciuti: {unmatched.join(', ')}</span>}
          </div>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead><tr className="bg-slate-50 text-slate-500">
                  <th className="px-3 py-2 text-left">Nome CSV</th>
                  <th className="px-3 py-2 text-left">Trovato</th>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Inizio</th>
                  <th className="px-3 py-2 text-left">Fine</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.slice(0, 15).map((r, i) => (
                    <tr key={i} className={r.userId ? 'text-slate-700' : 'text-red-500'}>
                      <td className="px-3 py-1.5 font-mono">{r.rawName}</td>
                      <td className="px-3 py-1.5">{r.userName ?? <span className="text-red-500">non trovato</span>}</td>
                      <td className="px-3 py-1.5 font-mono">{r.date}</td>
                      <td className="px-3 py-1.5 font-mono">{r.startTime}</td>
                      <td className="px-3 py-1.5 font-mono">{r.endTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 15 && <p className="text-center text-[10px] text-slate-400 py-2 border-t border-slate-100">… e altri {rows.length - 15} turni</p>}
          </div>
          {matched.length > 0 && (
            <button onClick={handleImport} disabled={importing}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 py-3 text-sm font-bold text-white transition disabled:opacity-50 active:scale-95">
              <Check className="w-4 h-4" />
              {importing ? 'Importazione in corso…' : `Importa ${matched.length} turni nel DB`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
