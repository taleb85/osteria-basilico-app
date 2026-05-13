import { motion } from 'framer-motion';
import { Download, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { isIOS, isAndroid, isDesktop, isSafariDesktop } from '../utils/pwaStandalone';
import { useApp } from '../context/appContextCore';
import FlowWaveIcon from './ui/FlowWaveIcon';

const BG = 'radial-gradient(ellipse at 50% 30%, rgba(255,149,0,0.18) 0%, transparent 60%)';
const ACCENT = '#FF9500';

/* ─── Icona Condividi Safari ─── */
function ShareIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 5.5L12 2l3.5 3.5" />
      <line x1="12" y1="2" x2="12" y2="14" />
      <path d="M4 12v8a1 1 0 001 1h14a1 1 0 001-1v-8" />
    </svg>
  );
}

/* ─── Step row dark ─── */
function StepRow({
  icon,
  title,
  desc,
  active,
  done,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  active?: boolean;
  done?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay ?? 0, duration: 0.35 }}
      className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all"
      style={{
        background: active
          ? 'rgba(255,149,0,0.22)'
          : 'rgba(40, 32, 24, 0.82)',
        border: active
          ? '1px solid rgba(255,149,0,0.50)'
          : '1px solid rgba(255,255,255,0.15)',
      }}
    >
      {/* Status dot */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors"
        style={{
          background: done ? '#22c55e' : active ? ACCENT : 'rgba(59,130,246,0.30)',
        }}
      >
        {done
          ? <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          : <span className="text-white/70 text-[11px] font-bold">{icon}</span>
        }
      </div>

      {/* Testo */}
      <div className="min-w-0 flex-1">
        <p className="text-white font-semibold text-sm leading-tight">{title}</p>
        {desc && <p className="text-white/65 text-xs leading-relaxed mt-0.5">{desc}</p>}
      </div>
    </motion.div>
  );
}

const IOS_STEPS = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="5" cy="12" r="1.8" fill="white" />
        <circle cx="12" cy="12" r="1.8" fill="white" />
        <circle cx="19" cy="12" r="1.8" fill="white" />
      </svg>
    ),
    title: 'Tocca i tre puntini',
    desc: 'In basso a destra nella barra di Safari',
  },
  {
    icon: <ShareIcon />,
    title: 'Tocca «Condividi»',
    desc: 'Seleziona l\'icona ↑ nel menu',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
    title: 'Aggiungi a schermo Home',
    desc: 'Scorri nel menu e tocca «Aggiungi», poi «Aggiungi»',
  },
];

const ANDROID_STEPS = [
  { icon: '⋮', title: 'Tocca i tre puntini', desc: 'In alto a destra del browser' },
  { icon: '↓', title: 'Seleziona «Installa App»', desc: 'O «Aggiungi a schermata Home»' },
  { icon: '✓', title: 'Conferma l\'installazione', desc: 'Tocca «Installa» nel popup' },
];

const DESKTOP_STEPS = [
  { icon: '⊕', title: 'Clicca l\'icona di installazione', desc: 'Nella barra degli indirizzi del browser, a destra' },
  { icon: '↓', title: 'Clicca «Installa»', desc: 'Chrome / Edge / Brave su PC' },
  { icon: '✓', title: 'FLOW è pronto', desc: 'Trovi l\'icona sul desktop o nel menu Start' },
];

const SAFARI_DESKTOP_STEPS = [
  { icon: '↑', title: 'Clicca «Condividi»', desc: 'Nella barra degli strumenti di Safari, in alto a destra' },
  { icon: '+', title: 'Seleziona «Aggiungi al Dock»', desc: 'Oppure «Aggiungi alla schermata Home»' },
  { icon: '✓', title: 'FLOW è pronto', desc: 'Trovi l\'icona nel Dock di macOS' },
];

export default function PWAInstallRequired() {
  const { effectiveLanguage } = useApp();
  void effectiveLanguage;

  // All hooks unconditionally at the top — Rules of Hooks
  const ios = isIOS();
  const android = isAndroid();
  const desktop = isDesktop();
  const safariDesktop = isSafariDesktop();

  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [installing, setInstalling] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState<number[]>([]);

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

  /* Auto-avanza gli step ogni 2.8s */
  useEffect(() => {
    if (!ios) return;
    const id = setInterval(() => {
      setActiveStep((s) => {
        const next = (s + 1) % IOS_STEPS.length;
        if (next === 0) setDoneSteps([]);
        else setDoneSteps((d) => [...d, s]);
        return next;
      });
    }, 2800);
    return () => clearInterval(id);
  }, [ios]);

  // SECURITY: check bypass env — after all hooks
  const allowBrowser = import.meta.env.VITE_ALLOW_BROWSER_APP === 'true';
  if (allowBrowser) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white p-6 text-center" style={{ background: 'transparent' }}>
        <div>
          <h1 className="text-xl font-bold mb-2">Bypass Attivo</h1>
          <p className="text-white/50">VITE_ALLOW_BROWSER_APP è true: gate PWA disabilitato.</p>
        </div>
      </div>
    );
  }

  const handleInstall = () => {
    if (!deferredPrompt) return;
    const p = deferredPrompt as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };
    p.prompt();
    setInstalling(true);
    p.userChoice
      .then(() => {
        setInstalling(false);
        setDeferredPrompt(null);
        (window as { __deferredInstallPrompt?: Event }).__deferredInstallPrompt = undefined;
      })
      .catch(() => setInstalling(false));
  };

  return (
    <div
      className="min-h-screen min-h-[100dvh] w-full flex flex-col items-center justify-center px-6 py-10 text-center font-sans"
      style={{ background: BG }}
    >
      <div className="max-w-sm w-full flex flex-col items-center gap-0">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{
            opacity: 1,
            scale: 1,
            boxShadow: [
              '0 0 32px rgba(255,149,0,0.70), 0 0 12px rgba(255,200,150,0.50)',
              '0 0 56px rgba(255,149,0,1.00), 0 0 24px rgba(255,200,150,0.80)',
              '0 0 32px rgba(255,149,0,0.70), 0 0 12px rgba(255,200,150,0.50)',
            ],
          }}
          transition={{
            opacity:   { duration: 0.5, ease: 'easeOut' },
            scale:     { duration: 0.5, ease: [0.34, 1.2, 0.64, 1] },
            boxShadow: { duration: 2.4, ease: 'easeInOut', repeat: Infinity, delay: 0.5 },
          }}
          style={{ borderRadius: 30, marginBottom: 16 }}
        >
          <FlowWaveIcon size={110} radius={30} />
        </motion.div>

        {/* Titolo */}
        <motion.h1
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="text-xl font-extrabold text-white tracking-tight mb-1"
        >
          Installa FLOW
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="text-white/50 text-sm mb-7"
        >
          Aggiungi l&apos;app alla schermata Home
        </motion.p>

        {/* ── iOS: 3 passi ── */}
        {ios && (
          <div className="w-full space-y-2.5">
            {IOS_STEPS.map((step, idx) => (
              <StepRow
                key={idx}
                icon={step.icon}
                title={step.title}
                desc={step.desc}
                active={activeStep === idx}
                done={doneSteps.includes(idx)}
                delay={0.2 + idx * 0.07}
              />
            ))}

            {/* Dots */}
            <div className="flex justify-center gap-2 pt-2">
              {IOS_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className="w-1.5 h-1.5 rounded-full transition-all"
                  style={{
                    background: activeStep === idx ? 'white' : 'rgba(255,255,255,0.25)',
                    transform: activeStep === idx ? 'scale(1.3)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Android ── */}
        {android && (
          <div className="w-full space-y-2.5">
            {deferredPrompt ? (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={handleInstall}
                disabled={installing}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-bold text-sm transition active:scale-[0.97] disabled:opacity-50"
                style={{ background: ACCENT, border: '1px solid rgba(255,210,160,0.35)' }}
              >
                <Download className="w-4 h-4" />
                {installing ? 'Installazione…' : 'Installa FLOW'}
              </motion.button>
            ) : (
              ANDROID_STEPS.map((s, idx) => (
                <StepRow key={idx} icon={s.icon} title={s.title} desc={s.desc} delay={0.2 + idx * 0.07} />
              ))
            )}
          </div>
        )}

        {/* ── Desktop ── */}
        {desktop && (
          <div className="w-full space-y-2.5">
            {deferredPrompt ? (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={handleInstall}
                disabled={installing}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-bold text-sm transition active:scale-[0.97] disabled:opacity-50"
                style={{ background: ACCENT, border: '1px solid rgba(255,210,160,0.35)' }}
              >
                <Download className="w-4 h-4" />
                {installing ? 'Installazione…' : 'Installa FLOW'}
              </motion.button>
            ) : safariDesktop ? (
              SAFARI_DESKTOP_STEPS.map((s, idx) => (
                <StepRow key={idx} icon={s.icon} title={s.title} desc={s.desc} delay={0.2 + idx * 0.07} />
              ))
            ) : (
              DESKTOP_STEPS.map((s, idx) => (
                <StepRow key={idx} icon={s.icon} title={s.title} desc={s.desc} delay={0.2 + idx * 0.07} />
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="mt-7 text-white/25 text-xs"
        >
          {ios ? 'Safari su iPhone / iPad' : android ? 'Chrome / Firefox su Android' : safariDesktop ? 'Safari su Mac' : 'Chrome / Edge / Brave su PC'}
        </motion.p>
      </div>
    </div>
  );
}
