/**
 * ElevatedAccessPanel — toggle per utente "Accesso scheda Admin".
 * Quando attivo, mostra la scheda Admin nella navigazione del profilo senza PIN aggiuntivo.
 */

import { useState, useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { translateRole } from '../utils/roles';
import { getTranslations } from '../utils/translations';

export default function ElevatedAccessPanel() {
  const { users, updateUser, effectiveLanguage } = useApp();
  const t = getTranslations(effectiveLanguage);

  const eligibleUsers = useMemo(
    () => users.filter((u) => u.status === 'active' && u.role !== 'admin'),
    [users]
  );

  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const handleToggle = async (userId: string, currentlyEnabled: boolean) => {
    setSaving((prev) => ({ ...prev, [userId]: true }));
    try {
      await updateUser(userId, {
        elevated_role: currentlyEnabled ? null : 'manager',
        secondary_pin: null,
      } as any);
    } finally {
      setSaving((prev) => ({ ...prev, [userId]: false }));
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
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500 dark:text-white/35 leading-relaxed mb-3">
        Quando attivato, il dipendente vede la scheda <strong className="text-slate-700 dark:text-white/60">Admin</strong> nella navigazione e può accedere all'area gestionale senza PIN aggiuntivo.
      </p>

      {eligibleUsers.map((u) => {
        const enabled = !!u.elevated_role;
        const isSaving = saving[u.id] ?? false;

        return (
          <div
            key={u.id}
            className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-white/[0.08] px-3 py-2.5"
            style={
              typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                ? { background: enabled ? 'rgba(51,102,204,0.06)' : 'transparent' }
                : { background: enabled ? 'rgba(51,102,204,0.04)' : '#ffffff' }
            }
          >
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className={`h-4 w-4 shrink-0 ${enabled ? 'text-[#3366CC]' : 'text-slate-300 dark:text-white/20'}`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-white/90 truncate">
                  {u.first_name} {u.last_name ?? ''}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-wide">
                  {translateRole(u.role, t)}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleToggle(u.id, enabled)}
              role="switch"
              aria-checked={enabled}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                enabled ? 'bg-[#3366CC]' : 'bg-slate-200 dark:bg-white/10'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}
