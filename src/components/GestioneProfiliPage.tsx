import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronDown, ChevronUp, Shield, Save, RotateCcw, Eye } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { translateRole } from '../utils/roles';
import { getEnabledFeatures, type EnabledFeatureKey } from '../utils/enabledFeatures';
import RoleFeatureSectionsBlock from './RoleFeatureSectionsBlock';
import { getTranslations } from '../utils/translations';
import AdminRow from './ui/AdminRow';
import ProfileVisibilityHub from './ProfileVisibilityHub';

const ACCENT = 'var(--brand)';

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
      .filter((u) => u.role !== 'admin')
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
    } catch (_err) {
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
            <h1 className="text-white/90 text-xl font-bold leading-tight">Gestione Profili</h1>
            <p className="text-white/60 text-sm mt-0.5">
              Personalizza i permessi per ogni singolo dipendente. Le modifiche qui sovrascrivono il template del ruolo.
            </p>
          </div>
        </div>

        <div className="surface-glass-sm overflow-hidden">
          <div className="border-b px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.18)', background: 'rgba(15, 35, 90, 0.82)' }}>
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80">
              <Users className="w-4 h-4" />
              Dipendenti
            </h2>
          </div>

          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
            {displayUsers.map((user) => {
              const isExpanded = expandedUserId === user.id;
              const currentTab = activeTab[user.id] || 'permissions';
              const baseFeatures = getEnabledFeatures(user);
              const hasLocalOverride = !!localOverrides[user.id];
              const features = localOverrides[user.id] || baseFeatures;
              const isSaving = savingId === user.id;

              return (
                <div key={user.id} className="">
                  <div className="flex items-center justify-between px-4 py-4 transition-colors" style={{ cursor: 'default' }} onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.07)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ''; }}>
                    <button
                      type="button"
                      onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white/70" style={{ background: 'rgba(15, 35, 90, 0.85)' }}>
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <div>
                        <span className="font-semibold text-white/90 block">
                          {user.first_name} {user.last_name}
                          {user.enabled_features && typeof user.enabled_features === 'object' && Object.keys(user.enabled_features).length > 0 && (
                            <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-amber-400" title="Permessi personalizzati" />
                          )}
                        </span>
                        <span className="text-xs text-white/60 uppercase tracking-wider">
                          {translateRole(user.role, currentUser?.language)}
                        </span>
                      </div>
                    </button>

                    <div className="flex items-center gap-2">
                      <div className="flex bg-white/10 rounded-lg p-0.5 mr-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleTab(user.id, 'permissions'); }}
                          className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${currentTab === 'permissions' ? 'bg-white/20 text-accent shadow-sm' : 'text-white/60'}`}
                        >
                          Permessi
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleTab(user.id, 'visibility'); }}
                          className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${currentTab === 'visibility' ? 'bg-white/20 text-accent shadow-sm' : 'text-white/60'}`}
                        >
                          Cosa vede
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleTab(user.id, 'grid'); }}
                          className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${currentTab === 'grid' ? 'bg-white/20 text-accent shadow-sm' : 'text-white/60'}`}
                        >
                          Griglia
                        </button>
                      </div>
                      <button
                        onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                        className="p-1 hover:bg-white/15 rounded-full transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-white/50" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-white/50" />
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
                        <div className="px-4 pb-6 pt-0 space-y-4" style={{ background: 'rgba(255,255,255,0.05)', borderTop: '1px solid rgba(15, 35, 90, 0.82)' }}>
                          {currentTab === 'permissions' ? (
                            <>
                              {user.role === 'admin' && (
                                <div className="mt-4 p-4 rounded-xl mb-4" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.40)' }}>
                                  <p className="text-xs" style={{ color: 'rgba(251,191,36,0.95)' }}>
                                    <strong>Amministratore:</strong> Gli amministratori hanno sempre accesso completo a tutte le funzionalità. I loro permessi non possono essere limitati individualmente.
                                  </p>
                                </div>
                              )}
                              <div className="flex items-center justify-between mt-4">
                                <p className="text-[11px] text-white/60">
                                  Personalizzazione permessi per <strong>{user.first_name}</strong>
                                </p>
                                {hasLocalOverride && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleReset(user.id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/70 text-[11px] font-bold transition-colors" style={{ background: 'rgba(15, 35, 90, 0.82)' }}
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

                              <div className="rounded-xl border border-white/15 p-4" style={{ background: 'rgba(255, 255, 255, 0.14)' }}>
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
                                <p className="text-[11px] text-white/60">
                                  Anteprima interfaccia per <strong>{user.first_name}</strong>
                                </p>
                                <button
                                  onClick={() => toggleTab(user.id, 'permissions')}
                                  className="text-[10px] font-bold text-accent uppercase hover:underline"
                                >
                                  Torna ai permessi
                                </button>
                              </div>
                              <div className="rounded-xl overflow-hidden border border-white/15" style={{ background: 'rgba(255, 255, 255, 0.14)' }}>
                                <div className="p-4 border-b border-white/10 bg-white/5">
                                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Configurazione Visualizzazione</p>
                                </div>
                                <div className="p-4">
                                  <button
                                    onClick={() => {
                                      // L'hub si apre perché currentTab === 'visibility' renderizza il componente sotto
                                    }}
                                    className="w-full py-8 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white/20 rounded-xl hover:border-accent/50 hover:bg-accent/[0.05] transition-all group"
                                  >
                                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                      <Eye className="w-6 h-6 text-accent" />
                                    </div>
                                    <div className="text-center">
                                      <p className="text-sm font-bold text-white/90">Apri Anteprima "Cosa vede {user.first_name}"</p>
                                      <p className="text-xs text-white/60 mt-1">Configura widget, moduli e visibilità sezioni</p>
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
                              <p className="text-[11px] text-white/60">
                                Impostazioni visibilità in griglia per <strong>{user.first_name}</strong>
                              </p>
                              <div className="rounded-xl border border-white/15 p-4" style={{ background: 'rgba(255, 255, 255, 0.14)' }}>
                                <AdminRow
                                  icon={<Users className="h-4 w-4 text-white/60" aria-hidden />}
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
                                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 ${user.team_schedule_visible !== false ? 'bg-accent' : 'bg-white/20'}`}
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
