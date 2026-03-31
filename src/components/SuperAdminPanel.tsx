/**
 * SuperAdminPanel — Pannello di gestione multi-sede.
 * Accessibile su /super-admin (route protetta da PIN super-admin).
 * Permette di creare, modificare e disattivare sedi (tenant).
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Check, X, Building2, Palette, Globe, ToggleLeft, ToggleRight, Copy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Tenant } from '../types';
import { applyTenantBrand } from '../context/TenantContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACCENT_PRESETS = [
  { label: 'Verde oliva',  value: '#2D5A27' },
  { label: 'Rosso',        value: '#B91C1C' },
  { label: 'Blu marino',   value: '#1D4ED8' },
  { label: 'Arancio',      value: '#C2410C' },
  { label: 'Viola',        value: '#6D28D9' },
  { label: 'Grigio scuro', value: '#374151' },
  { label: 'Teal',         value: '#0F766E' },
  { label: 'Rosa',         value: '#BE185D' },
];

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// TenantForm
// ---------------------------------------------------------------------------

interface TenantFormProps {
  initial?: Partial<Tenant>;
  onSave: (data: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function TenantForm({ initial, onSave, onCancel, saving }: TenantFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [accent, setAccent] = useState(initial?.accent_color ?? '#2D5A27');
  const [plan, setPlan] = useState<Tenant['plan']>(initial?.plan ?? 'basic');
  const [slugManual, setSlugManual] = useState(!!initial?.slug);

  useEffect(() => {
    if (!slugManual) setSlug(slugify(name));
  }, [name, slugManual]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ name: name.trim(), slug: slug.trim(), accent_color: accent, plan, is_active: initial?.is_active ?? true, logo_url: initial?.logo_url });
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
            pattern="[a-z0-9-]+"
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

      {/* Piano */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-600 dark:text-neutral-300">Piano</label>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value as Tenant['plan'])}
          className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2.5 text-sm text-slate-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
        >
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

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
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
      const { error: err } = await supabase.from('tenants').insert({ ...data });
      if (err) throw err;
      showToast('Sede creata!');
      setShowForm(false);
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 font-sans p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-6 h-6 text-accent" />
              Super Admin — Gestione Sedi
            </h1>
            <p className="text-sm text-slate-500 dark:text-neutral-400 mt-0.5">Crea e gestisci le sedi dell'app.</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingTenant(null); }}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition"
          >
            <Plus className="w-4 h-4" />
            Nuova sede
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex gap-2 items-start">
            <X className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Form nuova sede */}
        <AnimatePresence>
          {showForm && !editingTenant && (
            <TenantForm
              onSave={handleCreate}
              onCancel={() => setShowForm(false)}
              saving={saving}
            />
          )}
        </AnimatePresence>

        {/* Lista sedi */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Caricamento…</div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Nessuna sede configurata.</div>
        ) : (
          <div className="space-y-3">
            {tenants.map((t) => (
              <motion.div
                key={t.id}
                layout
                className={`rounded-2xl border ${t.is_active ? 'border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900' : 'border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 opacity-60'} p-4 shadow-sm`}
              >
                <AnimatePresence mode="wait">
                  {editingTenant?.id === t.id ? (
                    <TenantForm
                      key="edit"
                      initial={t}
                      onSave={handleUpdate}
                      onCancel={() => setEditingTenant(null)}
                      saving={saving}
                    />
                  ) : (
                    <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <div className="flex items-center gap-3">
                        {/* Swatch colore */}
                        <span className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center" style={{ backgroundColor: t.accent_color }}>
                          <Palette className="w-4 h-4 text-white/80" />
                        </span>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">{t.name}</span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${t.plan === 'pro' ? 'bg-blue-100 text-blue-700' : t.plan === 'enterprise' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>{t.plan}</span>
                            {!t.is_active && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-500">Inattiva</span>}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Globe className="w-3 h-3 text-slate-400" />
                            <span className="text-xs font-mono text-slate-500 dark:text-neutral-400">{t.slug}</span>
                            <button onClick={() => copySlug(t.slug)} className="text-slate-300 hover:text-accent transition ml-0.5">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {/* Azioni */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => { applyTenantBrand(t.accent_color); setEditingTenant(t); setShowForm(false); }}
                            className="rounded-lg p-2 text-slate-400 hover:text-accent hover:bg-accent/10 transition"
                            title="Modifica"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleActive(t)}
                            className={`rounded-lg p-2 transition ${t.is_active ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-950/30' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800'}`}
                            title={t.is_active ? 'Disattiva sede' : 'Attiva sede'}
                          >
                            {t.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg z-50"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
