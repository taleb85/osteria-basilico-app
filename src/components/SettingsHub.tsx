import { useState } from 'react';
import { Users, SlidersHorizontal, Shield, Settings, Info, LogOut, ChevronRight } from 'lucide-react';
import ImpostazioniPage from './ImpostazioniPage';
import GestioneProfiliPage from './GestioneProfiliPage';
import { RoleFeatureTemplatesPanel } from './RoleFeatureTemplatesPage';
import { useApp } from '../context/AppContext';

const MENU = [
  { key: 'account', label: 'Utente', icon: <Shield className="w-5 h-5" />, component: 'account' },
  { key: 'users', label: 'Gestione utenti', icon: <Users className="w-5 h-5" />, component: 'users' },
  { key: 'features', label: 'Funzionalità e regole', icon: <Settings className="w-5 h-5" />, component: 'features' },
  { key: 'advanced', label: 'Avanzate', icon: <Info className="w-5 h-5" />, component: 'advanced' },
];

export default function SettingsHub() {
  const { currentUser } = useApp();
  const [selected, setSelected] = useState('account');

  const filteredMenu = MENU.filter(item => {
    if (currentUser?.role !== 'admin') {
      return item.key === 'account' || item.key === 'users';
    }
    // Rimosso 'roles' per tutti, inclusi gli admin
    return item.key !== 'roles';
  });

  return (
    <div className="flex flex-col md:flex-row w-full min-h-[80vh]">
      {/* Sidebar */}
      <nav className="md:w-64 w-full md:border-r border-white/10 bg-white/5 flex md:flex-col flex-row overflow-x-auto md:overflow-x-visible">
        {filteredMenu.map((item) => (
          <button
            key={item.key}
            className={`flex items-center gap-2 px-4 py-3 md:w-full md:justify-start justify-center border-b md:border-b-0 md:border-r-0 border-white/10 text-sm font-semibold transition-colors ${selected === item.key ? 'bg-accent/10 text-accent' : 'hover:bg-white/8 text-white/80'}`}
            onClick={() => setSelected(item.key)}
          >
            {item.icon}
            <span className="hidden md:inline">{item.label}</span>
            <ChevronRight className="w-4 h-4 md:hidden ml-2" />
          </button>
        ))}
      </nav>
      {/* Main content */}
      <div className="flex-1 min-h-0 overflow-y-auto app-horizontal-pad py-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
        {selected === 'account' && <ImpostazioniPage />}
        {selected === 'users' && <GestioneProfiliPage />}
        {selected === 'features' && <ImpostazioniPage onOpenProfilesTab={() => setSelected('users')} />}
        {selected === 'advanced' && (
          <div className="surface-glass-sm p-6 rounded-xl mt-6">
            <h2 className="text-lg font-bold mb-2">Avanzate</h2>
            <p className="text-white/60 text-sm mb-4">Backup, ripristino, esportazione dati, impostazioni tecniche.</p>
            {/* Qui puoi aggiungere altre funzioni avanzate */}
          </div>
        )}
      </div>
    </div>
  );
}
