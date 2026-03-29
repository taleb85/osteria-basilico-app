import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronDown, ChevronUp, Shield, Save, RotateCcw, Eye } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { translateRole } from '../utils/roles';
import { getEnabledFeatures, type EnabledFeatureKey } from '../utils/enabledFeatures';
import RoleFeatureSectionsBlock from './RoleFeatureSectionsBlock';
import { getTranslations } from '../utils/translations';
import AdminRow from './ui/AdminRow';
import ProfileVisibilityHub from './ProfileVisibilityHub';

const ACCENT = '#2D5A27';

export default function GestioneProfiliPage() {
  const { users, currentUser, effectiveLanguage, updateUser, showSuccess, showError } = useApp();
  const t = getTranslations(effectiveLanguage);
  const tv = t as Record<string, string>;
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, 'permissions' | 'grid' | 'visibility'>>({});
  const [localOverrides, setLocalOverrides] = useState<Record<string, Record<string, boolean>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const displayUsers = useMemo(() => {
    return users
      .filter((u) => u.status === 'active' || u.status === 'suspended' || u.status === 'inactive')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [users]);

  const toggleTab = (userId: string, tab: 'permissions' | 'grid' | 'visibility') => {
    setActiveTab(prev => ({ ...prev, [userId]: tab }));
  };

  const handleToggleFeature = (userId: string, key: EnabledFeatureKey, currentFeatures: any) => {
    setLocalOverrides((prev) => {
      const userPrev = prev[userId] || (currentFeatures as Record<string, boolean>);
      return {
        ...prev,
        [userId]: {
          ...userPrev,
          [key]: !userPrev[key],
        },
      };
    });
  };

  const handleReset = (userId: string) => {
    setLocalOverrides((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const handleSave = async (userId: string) => {
    const overrides = localOverrides[userId];
    if (!overrides) return;

    setSavingId(userId);
    try {
      await updateUser(userId, { enabled_features: overrides });
      showSuccess?.(tv.save_success ?? 'Modifiche salvate con successo');
      handleReset(userId);
    } catch (err) {
      showError?.(tv.save_error ?? 'Errore durante il salvataggio');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="pb-content pt-6 w-full app-horizontal-pad font-sans">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${ACCENT}20` }}>
            <Shield className="w-5 h-5" style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="text-slate-800 text-xl font-bold leading-tight">Gestione Profili</h1>
            <p className="text-slate-500 dark:text-neutral-300 text-sm mt-0.5">
              Personalizza i permessi per ogni singolo dipendente. Le modifiche qui sovrascrivono il template del ruolo.
            </p>
          </div>
        </div>

        <div className="surface-glass-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-neutral-800/50">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-neutral-200">
              <Users className="w-4 h-4" />
              Dipendenti
            </h2>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/10">
            {displayUsers.map((user) => {
              const isExpanded = expandedUserId === user.id;
              const currentTab = activeTab[user.id] || 'permissions';
              const baseFeatures = getEnabledFeatures(user);
              const hasLocalOverride = !!localOverrides[user.id];
              const features = localOverrides[user.id] || baseFeatures;
              const isSaving = savingId === user.id;

              return (
                <div key={user.id} className="">
                  <div className="flex items-center justify-between px-4 py-4 hover:bg-slate-50/80 transition-colors">
                    <button
                      type="button"
                      onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-neutral-800 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-neutral-300">
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800 block">
                          {user.first_name} {user.last_name}
                          {user.enabled_features && typeof user.enabled_features === 'object' && Object.keys(user.enabled_features).length > 0 && (
                            <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-amber-400" title="Permessi personalizzati" />
                          )}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-neutral-300 uppercase tracking-wider">
                          {translateRole(user.role, currentUser?.language)}
                        </span>
                      </div>
                    </button>

                    <div className="flex items-center gap-2">
                      <div className="flex bg-slate-100 dark:bg-neutral-800 rounded-lg p-0.5 mr-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleTab(user.id, 'permissions'); }}
                          className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${currentTab === 'permissions' ? 'bg-white dark:bg-neutral-700 text-accent shadow-sm' : 'text-slate-500'}`}
                        >
                          Permessi
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleTab(user.id, 'visibility'); }}
                          className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${currentTab === 'visibility' ? 'bg-white dark:bg-neutral-700 text-accent shadow-sm' : 'text-slate-500'}`}
                        >
                          Cosa vede
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleTab(user.id, 'grid'); }}
                          className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${currentTab === 'grid' ? 'bg-white dark:bg-neutral-700 text-accent shadow-sm' : 'text-slate-500'}`}
                        >
                          Griglia
                        </button>
                      </div>
                      <button
                        onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded-full transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 dark:text-neutral-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 dark:text-neutral-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-6 pt-0 bg-slate-50/50 border-t border-slate-100 space-y-4 dark:bg-neutral-900/30">
                          {currentTab === 'permissions' ? (
                            <>
                              {user.role === 'admin' && (
                                <div className="mt-4 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50 mb-4">
                                  <p className="text-xs text-amber-800 dark:text-amber-200">
                                    <strong>Amministratore:</strong> Gli amministratori hanno sempre accesso completo a tutte le funzionalità. I loro permessi non possono essere limitati individualmente.
                                  </p>
                                </div>
                              )}
                              <div className="flex items-center justify-between mt-4">
                                <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                                  Personalizzazione permessi per <strong>{user.first_name}</strong>
                                </p>
                                {hasLocalOverride && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleReset(user.id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 text-[11px] font-bold hover:bg-slate-300 transition-colors"
                                    >
                                      <RotateCcw className="w-3 h-3" /> Annulla
                                    </button>
                                    <button
                                      onClick={() => handleSave(user.id)}
                                      disabled={isSaving}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-[11px] font-bold hover:bg-accent-hover transition-colors disabled:opacity-50"
                                    >
                                      <Save className="w-3 h-3" /> {isSaving ? 'Salvataggio...' : 'Salva Modifiche'}
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="rounded-xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-white/10 p-4">
                                <RoleFeatureSectionsBlock
                                  mode="toggles"
                                  features={features}
                                  language={effectiveLanguage}
                                  onToggle={(key) => handleToggleFeature(user.id, key, baseFeatures)}
                                  lockAlwaysOnFeatures={['home_tab']}
                                  disabled={user.role === 'admin'}
                                />
                              </div>

                              {hasLocalOverride && (
                                <div className="flex justify-end pt-2">
                                  <button
                                    onClick={() => handleSave(user.id)}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-hover transition-colors shadow-md disabled:opacity-50"
                                  >
                                    <Save className="w-4 h-4" /> {isSaving ? 'Salvataggio...' : 'Salva Modifiche'}
                                  </button>
                                </div>
                              )}
                            </>
                          ) : currentTab === 'visibility' ? (
                            <div className="mt-4">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                                  Anteprima interfaccia per <strong>{user.first_name}</strong>
                                </p>
                                <button
                                  onClick={() => toggleTab(user.id, 'permissions')}
                                  className="text-[10px] font-bold text-accent uppercase hover:underline"
                                >
                                  Torna ai permessi
                                </button>
                              </div>
                              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-neutral-950">
                                <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-neutral-900/50">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configurazione Visualizzazione</p>
                                </div>
                                <div className="p-4">
                                  <button
                                    onClick={() => {
                                      // L'hub si apre perché currentTab === 'visibility' renderizza il componente sotto
                                    }}
                                    className="w-full py-8 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl hover:border-accent/50 hover:bg-accent/[0.02] transition-all group"
                                  >
                                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                      <Eye className="w-6 h-6 text-accent" />
                                    </div>
                                    <div className="text-center">
                                      <p className="text-sm font-bold text-slate-800 dark:text-neutral-100">Apri Anteprima "Cosa vede {user.first_name}"</p>
                                      <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">Configura widget, moduli e visibilità sezioni</p>
                                    </div>
                                  </button>
                                </div>
                              </div>
                              
                              {currentTab === 'visibility' && (
                                <ProfileVisibilityHub 
                                  initialSelectedUserId={user.id} 
                                  onClose={() => toggleTab(user.id, 'permissions')} 
                                />
                              )}
                            </div>
                          ) : (
                            <div className="mt-4 space-y-4">
                              <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                                Impostazioni visibilità in griglia per <strong>{user.first_name}</strong>
                              </p>
                              <div className="rounded-xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-white/10 p-4">
                                <AdminRow
                                  icon={<Users className="h-4 w-4 text-slate-500 dark:text-neutral-300" aria-hidden />}
                                  label="Visibile in tabellone turni"
                                  description={user.team_schedule_visible !== false ? 'L\'utente compare nel planning settimanale' : 'L\'utente è nascosto dal planning settimanale'}
                                  action={
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={user.team_schedule_visible !== false}
                                      onClick={async () => {
                                        const next = !(user.team_schedule_visible !== false);
                                        await updateUser(user.id, { team_schedule_visible: next });
                                        showSuccess?.(`Visibilità ${next ? 'attivata' : 'disattivata'}`);
                                      }}
                                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-neutral-900 ${user.team_schedule_visible !== false ? 'bg-accent' : 'bg-slate-200 dark:bg-neutral-600'}`}
                                    >
                                      <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white toggle-knob shadow transition ${user.team_schedule_visible !== false ? 'translate-x-5' : 'translate-x-1'}`}
                                      />
                                    </button>
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
