import { motion } from 'framer-motion';
import { Download, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { isIOS, isAndroid, isDesktop } from '../utils/pwaStandalone';
import { useApp } from '../context/appContextCore';
import { useTenant } from '../context/TenantContext';
import FlowLogo from './FlowLogo';

/* ─── Icona Condividi Safari (SVG nativo iOS) ─── */
function SafareShareIcon({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 5.5L12 2l3.5 3.5" />
      <line x1="12" y1="2" x2="12" y2="14" />
      <path d="M4 12v8a1 1 0 001 1h14a1 1 0 001-1v-8" />
    </svg>
  );
}

/* ─── Icona "Aggiungi a Home" (quadrato + plus) ─── */
function AddHomeIcon({ size = 26, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

const IOS_STEPS = [
  {
    num: 1,
    icon: (
      <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="12" r="1.2" fill="white" stroke="none" />
        <circle cx="12" cy="12" r="1.2" fill="white" stroke="none" />
        <circle cx="19" cy="12" r="1.2" fill="white" stroke="none" />
      </svg>
    ),
    title: 'Tocca i tre puntini ••• in basso a destra',
    desc: 'Nella barra compatta di Safari in basso, oppure tocca direttamente ↑ se visibile',
    highlight: true,
  },
  {
    num: 2,
    icon: <SafareShareIcon size={26} color="white" />,
    title: 'Tocca «Condividi»',
    desc: 'Nel menu che si apre, seleziona l\'opzione Condividi con l\'icona ↑',
    highlight: false,
  },
  {
    num: 3,
    icon: <AddHomeIcon size={26} color="white" />,
    title: 'Aggiungi a schermo Home',
    desc: 'Scorri giù nella lista e tocca «Aggiungi a schermo Home», poi «Aggiungi»',
    highlight: false,
  },
];

/* ─── Freccia fissa che indica il pulsante Condividi nella barra Safari ─── */
function SafariToolbarHint({ color }: { color: string }) {
  return (
    <motion.div
      className="fixed left-0 right-0 flex flex-col items-center z-50 pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 52px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.7, duration: 0.5 }}
    >
      {/* Label + freccia che rimbalza */}
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        className="flex flex-col items-center gap-1"
      >
        {/* Etichetta */}
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full shadow-2xl"
          style={{ backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="5" cy="12" r="2.2" fill="white" />
            <circle cx="12" cy="12" r="2.2" fill="white" />
            <circle cx="19" cy="12" r="2.2" fill="white" />
          </svg>
          <span className="text-white text-xs font-bold tracking-wide">Tocca ••• in basso a destra ↓</span>
        </div>

        {/* Freccia grande */}
        <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
          <path d="M14 0 L14 16" stroke="white" strokeWidth="3" strokeLinecap="round" />
          <path d="M5 10 L14 20 L23 10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* Cerchio che imita i tre puntini di Safari */}
        <div
          className="flex items-center justify-center shadow-2xl rounded-full w-11 h-11"
          style={{
            background: color,
            border: '2.5px solid rgba(255,255,255,0.6)',
            boxShadow: '0 0 0 4px rgba(255,255,255,0.25), 0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="5" cy="12" r="1.8" fill="white" />
            <circle cx="12" cy="12" r="1.8" fill="white" />
            <circle cx="19" cy="12" r="1.8" fill="white" />
          </svg>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function PWAInstallRequired() {
  const { effectiveLanguage } = useApp();
  void useTenant(); // mantiene import attivo senza usare dati tenant
  const tenantName = 'FLOW'; // sempre FLOW — ignora nome DB tenant
  const BG_COLOR = '#0052FF'; // colore FLOW blue — usato per accenti, bottoni e cerchi
  const PAGE_BG = '#ffffff';  // sfondo pagina bianco
  const ios = isIOS();
  const android = isAndroid();
  const desktop = isDesktop();
  void effectiveLanguage;

  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [installing, setInstalling] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const already = (window as { __deferredInstallPrompt?: Event }).__deferredInstallPrompt;
    if (already) { setDeferredPrompt(already); return; }
    const handler = (e: Event) => {
      e.preventDefault();
      (window as { __deferredInstallPrompt?: Event }).__deferredInstallPrompt = e;
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  /* Auto-avanza i passi ogni 3 s per richiamare attenzione */
  useEffect(() => {
    if (!ios) return;
    const id = setInterval(() => setActiveStep((s) => (s + 1) % IOS_STEPS.length), 3000);
    return () => clearInterval(id);
  }, [ios]);

  const handleInstall = () => {
    if (!deferredPrompt) return;
    const p = deferredPrompt as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };
    p.prompt();
    setInstalling(true);
    p.userChoice
      .then(() => { setInstalling(false); setDeferredPrompt(null); (window as { __deferredInstallPrompt?: Event }).__deferredInstallPrompt = undefined; })
      .catch(() => setInstalling(false));
  };

  return (
    <div
      className="min-h-screen min-h-[100dvh] w-full flex flex-col items-center justify-start px-5 pt-10 pb-40 text-center"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="max-w-sm w-full">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-20 h-20 mx-auto mb-5 drop-shadow-xl"
        >
          <FlowLogo size={80} showText={false} />
        </motion.div>

        {/* Titolo */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-2xl font-extrabold text-slate-800 leading-tight mb-1"
          style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.04em' }}
        >
          <span style={{ color: '#0052FF' }}>F</span>LOW
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="text-slate-500 text-sm mb-8"
        >
          Installa l&apos;app per accedere
        </motion.p>

        {/* ── iOS: 3 passi numerati ── */}
        {ios && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="space-y-3 text-left"
          >
            {IOS_STEPS.map((step, idx) => {
              const isActive = activeStep === idx;
              return (
                <motion.div
                  key={step.num}
                  animate={isActive ? { scale: 1.02 } : { scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-colors"
                  style={{
                    backgroundColor: isActive ? `${BG_COLOR}0D` : '#f8fafc',
                    border: isActive ? `1.5px solid ${BG_COLOR}40` : '1.5px solid #e2e8f0',
                  }}
                >
                  {/* Numero */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                    style={{
                      backgroundColor: isActive ? BG_COLOR : '#e2e8f0',
                      color: isActive ? 'white' : '#64748b',
                    }}
                  >
                    {step.num}
                  </div>

                  {/* Icona */}
                  <motion.div
                    animate={isActive && step.num === 1 ? { y: [0, -4, 0] } : {}}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: isActive ? `${BG_COLOR}15` : '#f1f5f9' }}
                  >
                    {step.icon}
                  </motion.div>

                  {/* Testo */}
                  <div className="min-w-0">
                    <p className="text-slate-800 font-semibold text-sm leading-tight">{step.title}</p>
                    <p className="text-slate-500 text-xs leading-relaxed mt-0.5">{step.desc}</p>
                  </div>
                </motion.div>
              );
            })}

            {/* Dots progress */}
            <div className="flex justify-center gap-2 pt-1">
              {IOS_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{ backgroundColor: activeStep === idx ? BG_COLOR : '#cbd5e1' }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Android ── */}
        {android && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {deferredPrompt ? (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="w-full flex items-center justify-center gap-3 bg-white text-sm font-bold py-4 px-5 rounded-2xl shadow-xl transition active:scale-95 disabled:opacity-60"
                style={{ color: BG_COLOR }}
              >
                <Download className="w-5 h-5" />
                {installing ? 'Installazione…' : `Installa ${tenantName}`}
              </button>
            ) : (
              <div className="space-y-3 text-left">
                {[
                  { num: 1, title: 'Tocca i tre puntini ⋮', desc: 'In alto a destra del browser Chrome' },
                  { num: 2, title: 'Seleziona «Installa App»', desc: 'O «Aggiungi a schermata Home»' },
                  { num: 3, title: 'Conferma l\'installazione', desc: 'Tocca «Installa» nel popup' },
                ].map((s) => (
                  <div key={s.num} className="flex items-center gap-4 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0" style={{ backgroundColor: BG_COLOR, color: 'white' }}>{s.num}</div>
                    <div>
                      <p className="text-slate-800 font-semibold text-sm">{s.title}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Desktop ── */}
        {desktop && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {deferredPrompt ? (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="w-full flex items-center justify-center gap-3 bg-white text-sm font-bold py-4 px-5 rounded-2xl shadow-xl transition active:scale-95 disabled:opacity-60"
                style={{ color: BG_COLOR }}
              >
                <Download className="w-5 h-5" />
                {installing ? 'Installazione…' : `Installa ${tenantName}`}
              </button>
            ) : (
              <div className="space-y-3 text-left">
                {[
                  { num: 1, title: 'Trova l\'icona di installazione', desc: 'Nella barra degli indirizzi del browser, a destra' },
                  { num: 2, title: 'Clicca «Installa»', desc: 'Chrome/Edge mostrano un popup di conferma' },
                ].map((s) => (
                  <div key={s.num} className="flex items-center gap-4 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0" style={{ backgroundColor: BG_COLOR, color: 'white' }}>{s.num}</div>
                    <div>
                      <p className="text-slate-800 font-semibold text-sm">{s.title}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Nota finale */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-6 flex items-center justify-center gap-2"
        >
          <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <p className="text-slate-400 text-xs">
            Dopo l&apos;installazione, apri l&apos;app dalla schermata Home
          </p>
        </motion.div>
      </div>

      {/* Freccia che indica il pulsante Condividi di Safari (solo iOS) */}
      {ios && <SafariToolbarHint color={BG_COLOR} />}
    </div>
  );
}
