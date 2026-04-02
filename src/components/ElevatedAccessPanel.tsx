/**
 * ElevatedAccessPanel — pannello di configurazione PIN secondario / elevazione sessione.
 * Solo visibile agli admin. Permette di assegnare a un dipendente (ruolo non-admin):
 *  - un PIN secondario (4 cifre)
 *  - un ruolo concesso temporaneamente quando usa quel PIN
 * La sessione elevata dura solo fino al refresh o al logout.
 */

import { useState, useMemo } from 'react';
import { ShieldCheck, Save, AlertTriangle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { UserRole } from '../types';
import { translateRole } from '../utils/roles';
import { getTranslations } from '../utils/translations';

const ELEVATED_ROLES: UserRole[] = ['manager', 'assistant_manager', 'admin'];

interface RowState {
  secondary_pin: string;
  elevated_role: UserRole | '';
  saving: boolean;
  saved: boolean;
  error: string;
}

export default function ElevatedAccessPanel() {
  const { users, updateUser, effectiveLanguage } = useApp();
  const t = getTranslations(effectiveLanguage);

  const eligibleUsers = useMemo(
    () => users.filter((u) => u.status === 'active' && u.role !== 'admin'),
    [users]
  );

  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const u of eligibleUsers) {
      init[u.id] = {
        secondary_pin: u.secondary_pin ?? '',
        elevated_role: (u.elevated_role as UserRole | null) ?? '',
        saving: false,
        saved: false,
        error: '',
      };
    }
    return init;
  });

  const allPrimaryPins = useMemo(
    () => users.filter((u) => u.status === 'active').map((u) => u.pin.trim()),
    [users]
  );

  const allSecondaryPins = useMemo(
    () =>
      users
        .filter((u) => u.status === 'active' && u.secondary_pin)
        .map((u) => u.secondary_pin!.trim()),
    [users]
  );

  const setRow = (id: string, patch: Partial<RowState>) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const handleSave = async (userId: string) => {
    const row = rows[userId];
    if (!row) return;

    const pin = row.secondary_pin.replace(/\D/g, '').slice(0, 4);
    const role = row.elevated_role as UserRole | '';

    // Validazione
    if (pin && pin.length !== 4) {
      setRow(userId, { error: 'Il PIN secondario deve essere di 4 cifre.' });
      return;
    }
    if (pin && allPrimaryPins.includes(pin)) {
      setRow(userId, { error: 'Questo PIN coincide con il PIN principale di un dipendente.' });
      return;
    }
    // Controlla conflitti con altri PIN secondari (escludi l'utente corrente)
    const otherSecPins = allSecondaryPins.filter((p) => {
      const owner = users.find((u) => u.secondary_pin?.trim() === p);
      return owner && owner.id !== userId;
    });
    if (pin && otherSecPins.includes(pin)) {
      setRow(userId, { error: 'Questo PIN è già usato come PIN secondario da un altro dipendente.' });
      return;
    }
    if (pin && !role) {
      setRow(userId, { error: 'Seleziona il ruolo da concedere con questo PIN.' });
      return;
    }
    if (!pin && role) {
      setRow(userId, { error: 'Inserisci un PIN secondario per attivare il ruolo concesso.' });
      return;
    }

    setRow(userId, { saving: true, error: '' });
    try {
      await updateUser(userId, {
        secondary_pin: pin || null,
        elevated_role: (role || null) as UserRole | null,
      });
      setRow(userId, { saving: false, saved: true, error: '' });
      setTimeout(() => setRow(userId, { saved: false }), 2500);
    } catch (err) {
      setRow(userId, {
        saving: false,
        error: (err as Error).message ?? 'Errore nel salvataggio.',
      });
    }
  };

  const handleClear = async (userId: string) => {
    setRow(userId, { saving: true, error: '', secondary_pin: '', elevated_role: '' });
    try {
      await updateUser(userId, { secondary_pin: null, elevated_role: null });
      setRow(userId, { saving: false, saved: true });
      setTimeout(() => setRow(userId, { saved: false }), 2500);
    } catch (err) {
      setRow(userId, { saving: false, error: (err as Error).message ?? 'Errore.' });
    }
  };

  if (eligibleUsers.length === 0) {
    return (
      <p className="text-xs text-slate-500 dark:text-neutral-400 px-1">
        Nessun dipendente non-admin attivo da configurare.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-700/30 px-3 py-2.5">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
          Il PIN secondario eleva il ruolo <strong>solo per la sessione corrente</strong>. Si azzera automaticamente al logout o al refresh della pagina. Non modificare il ruolo reale del dipendente.
        </p>
      </div>

      {eligibleUsers.map((u) => {
        const row = rows[u.id] ?? {
          secondary_pin: u.secondary_pin ?? '',
          elevated_role: (u.elevated_role as UserRole | null) ?? '',
          saving: false,
          saved: false,
          error: '',
        };
        const hasConfig = !!u.secondary_pin && !!u.elevated_role;

        return (
          <div
            key={u.id}
            className="rounded-xl border border-slate-200/60 dark:border-neutral-700/40 bg-white/60 dark:bg-neutral-800/30 p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`h-4 w-4 ${hasConfig ? 'text-accent' : 'text-slate-400 dark:text-neutral-500'}`} />
                <span className="text-sm font-medium text-slate-800 dark:text-neutral-100">
                  {u.first_name} {u.last_name ?? ''}
                </span>
                <span className="rounded-full bg-slate-100 dark:bg-neutral-700 px-1.5 py-0.5 text-[10px] text-slate-500 dark:text-neutral-400">
                  {translateRole(u.role, t)}
                </span>
              </div>
              {hasConfig && (
                <button
                  type="button"
                  onClick={() => handleClear(u.id)}
                  disabled={row.saving}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  title="Rimuovi PIN secondario"
                >
                  <X className="h-3 w-3" />
                  Rimuovi
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                  PIN accesso elevato
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="4 cifre"
                  value={row.secondary_pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setRow(u.id, { secondary_pin: val, error: '' });
                  }}
                  className="w-24 rounded-lg border border-slate-200 dark:border-neutral-600 bg-white/80 dark:bg-neutral-700/60 px-3 py-1.5 text-sm text-center tracking-[0.3em] text-slate-800 dark:text-neutral-100 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                  Ruolo concesso
                </label>
                <select
                  value={row.elevated_role}
                  onChange={(e) => setRow(u.id, { elevated_role: e.target.value as UserRole | '', error: '' })}
                  className="rounded-lg border border-slate-200 dark:border-neutral-600 bg-white/80 dark:bg-neutral-700/60 px-2 py-1.5 text-sm text-slate-800 dark:text-neutral-100 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30"
                >
                  <option value="">— nessuno —</option>
                  {ELEVATED_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {translateRole(r, t)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleSave(u.id)}
                disabled={row.saving}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent-dark transition-colors disabled:opacity-50"
              >
                {row.saving ? (
                  <span className="animate-spin h-3 w-3 border border-white/60 border-t-transparent rounded-full" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                {row.saved ? 'Salvato!' : 'Salva'}
              </button>
            </div>

            {row.error && (
              <p className="text-[11px] text-red-500 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {row.error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
