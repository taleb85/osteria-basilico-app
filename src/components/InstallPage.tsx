/**
 * InstallPage — Rilevamento automatico del dispositivo.
 * iOS → scarica il profilo .mobileconfig (web clip).
 * Android → mostra passaggi PWA (Aggiungi a schermata Home).
 * Desktop → mostra passaggi PWA.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Check, ArrowDownToLine } from 'lucide-react';
import { useT } from '../hooks/useT';
import { formatTrans } from '../utils/translations';
import { PATH_PROFILO } from '../config/appPaths';
import FlowLogoSvg from './FlowLogoSvg';

function getDeviceHint(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

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
        background: 'rgba(40, 32, 24, 0.82)',
        border: active
          ? '1px solid rgba(99,102,241,0.50)'
          : '1px solid rgba(255,255,255,0.15)',
      }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors"
        style={{
          background: done ? '#22c55e' : active ? '#6366f1' : 'rgba(59,130,246,0.30)',
        }}
      >
        {done
          ? <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          : <span className="text-white/70 text-[11px] font-bold">{icon}</span>
        }
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-white font-semibold text-sm leading-tight">{title}</p>
        {desc && <p className="text-white/65 text-xs leading-relaxed mt-0.5">{desc}</p>}
      </div>
    </motion.div>
  );
}

/** Step guide per l'installazione su iOS dopo lo scaricamento del profilo */
const IOS_POST_DOWNLOAD_STEPS = [
  { icon: '1', title: 'Vai in Impostazioni → Profilo scaricato', desc: 'Apri Impostazioni, trovi "Profilo scaricato" in alto' },
  { icon: '2', title: 'Tocca "Installa"', desc: 'In alto a destra, conferma l\'installazione del profilo' },
  { icon: '3', title: 'FLOW è pronto', desc: 'Trovi l\'icona nella schermata Home' },
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

export default function InstallPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const t = useT() as Record<string, string>;
  const tr = (key: string) => t[key] ?? key;

  const userId = searchParams.get('userId') ?? '';
  const firstName = searchParams.get('firstName') ?? '';

  const [installing, setInstalling] = useState<'idle' | 'downloading' | 'done'>('idle');
  const downloadStarted = useRef(false);
  const [activeStep, setActiveStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState<number[]>([]);

  const deviceHint = useMemo(() => getDeviceHint(), []);

  // Quando l'utente torna da Settings dopo aver installato il profilo
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && downloadStarted.current) {
        setInstalling('done');
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Auto-avanza gli step post-download iOS ogni 2.8s
  useEffect(() => {
    if (deviceHint !== 'ios') return;
    const id = setInterval(() => {
      setActiveStep((s) => {
        const next = (s + 1) % IOS_POST_DOWNLOAD_STEPS.length;
        if (next === 0) setDoneSteps([]);
        else setDoneSteps((d) => [...d, s]);
        return next;
      });
    }, 2800);
    return () => clearInterval(id);
  }, [deviceHint]);

  const handleDownloadiOS = () => {
    setInstalling('downloading');
    downloadStarted.current = true;
    // Su iOS Safari, la navigazione diretta al .mobileconfig mostra
    // un banner "Scarica profilo" SENZA lasciare la pagina (iOS 16+).
    window.location.href = '/Installa_FLOW.mobileconfig';
    setTimeout(() => setInstalling('done'), 3000);
  };

  const handleContinue = () => {
    navigate(PATH_PROFILO, { replace: true });
  };

  if (!userId) {
    return (
      <div className="min-h-screen min-h-[100dvh] w-full flex items-center justify-center px-6 font-sans">
        <p className="text-white/50 text-sm">{tr('install_no_user')}</p>
      </div>
    );
  }

  /* ─── Schermata iOS ─── */
  const renderIOS = () => (
    <>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-5"
      >
        <FlowLogoSvg variant="icon-only" color="orange" style={{ width: 80, height: 80, borderRadius: 18 }} />
      </motion.div>

      <h1 className="text-xl font-bold text-white tracking-tight mb-1.5 text-center">
        {firstName ? formatTrans(tr('install_welcome_name'), { name: firstName }) : tr('install_welcome')}
      </h1>

      {/* Stato download completato — mostra i 3 passaggi */}
      {installing === 'done' ? (
        <>
          <p className="text-sm text-white/50 text-center leading-relaxed mb-6">
            {tr('install_ios_intro')}
          </p>
          <div className="w-full space-y-2">
            {IOS_POST_DOWNLOAD_STEPS.map((step, idx) => (
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
            <div className="flex justify-center gap-2 pt-1">
              {IOS_POST_DOWNLOAD_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => { setActiveStep(idx); setDoneSteps([]); }}
                  className="w-1.5 h-1.5 rounded-full transition-all"
                  style={{
                    background: activeStep === idx ? 'white' : 'rgba(255,255,255,0.25)',
                    transform: activeStep === idx ? 'scale(1.3)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleContinue}
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 mt-6 text-sm font-semibold transition-all active:scale-[0.98]"
            style={{
              background: 'rgba(102,153,255,0.2)',
              border: '1px solid rgba(102,153,255,0.4)',
              color: 'rgb(199, 210, 255)',
            }}
          >
            {tr('install_open_app')}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-white/50 text-center leading-relaxed mb-7">
            {tr('install_ios_intro')}
          </p>
          {/* Pulsante grande: scarica profilo iOS */}
          <button
            type="button"
            onClick={handleDownloadiOS}
            disabled={installing === 'downloading'}
            className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-semibold text-[0.95rem] transition-all duration-200 active:scale-[0.97] disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: '#fff',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
            }}
          >
            {installing === 'downloading' ? (
              <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2.5} />
            ) : (
              <ArrowDownToLine className="w-5 h-5" strokeWidth={2.5} />
            )}
            {installing === 'downloading'
              ? (tr('install_downloading') ?? 'Download in corso…')
              : (tr('install_ios_download_button') ?? 'Scarica profilo di configurazione')}
          </button>
        </>
      )}
    </>
  );

  /* ─── Schermata Android ─── */
  const renderAndroid = () => (
    <>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-5"
      >
        <FlowLogoSvg variant="icon-only" color="orange" style={{ width: 80, height: 80, borderRadius: 18 }} />
      </motion.div>

      <h1 className="text-xl font-bold text-white tracking-tight mb-1.5 text-center">
        {firstName ? formatTrans(tr('install_welcome_name'), { name: firstName }) : tr('install_welcome')}
      </h1>
      <p className="text-sm text-white/50 text-center leading-relaxed mb-6">
        {tr('install_android_intro')}
      </p>

      <div className="w-full space-y-2">
        {ANDROID_STEPS.map((s, idx) => (
          <StepRow key={idx} icon={s.icon} title={s.title} desc={s.desc} delay={0.2 + idx * 0.07} />
        ))}
      </div>

      <button
        type="button"
        onClick={handleContinue}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 mt-6 text-sm font-semibold transition-all active:scale-[0.98]"
        style={{
          background: 'rgba(102,153,255,0.2)',
          border: '1px solid rgba(102,153,255,0.4)',
          color: 'rgb(199, 210, 255)',
        }}
      >
        {tr('install_open_app')}
      </button>
    </>
  );

  /* ─── Schermata Desktop ─── */
  const renderDesktop = () => (
    <>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-5"
      >
        <FlowLogoSvg variant="icon-only" color="orange" style={{ width: 80, height: 80, borderRadius: 18 }} />
      </motion.div>

      <h1 className="text-xl font-bold text-white tracking-tight mb-1.5 text-center">
        {firstName ? formatTrans(tr('install_welcome_name'), { name: firstName }) : tr('install_welcome')}
      </h1>
      <p className="text-sm text-white/50 text-center leading-relaxed mb-6">
        {tr('install_choose_device') ?? 'Installa FLOW sul tuo computer'}
      </p>

      <div className="w-full space-y-2">
        {DESKTOP_STEPS.map((s, idx) => (
          <StepRow key={idx} icon={s.icon} title={s.title} desc={s.desc} delay={0.2 + idx * 0.07} />
        ))}
      </div>

      <button
        type="button"
        onClick={handleContinue}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 mt-6 text-sm font-semibold transition-all active:scale-[0.98]"
        style={{
          background: 'rgba(102,153,255,0.2)',
          border: '1px solid rgba(102,153,255,0.4)',
          color: 'rgb(199, 210, 255)',
        }}
      >
        {tr('install_open_app')}
      </button>
    </>
  );

  return (
    <div role="main"
      className="min-h-screen min-h-[100dvh] w-full flex flex-col items-center justify-center px-6 font-sans"
      style={{ background: 'transparent' }}
    >
      <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full rounded-3xl overflow-hidden px-6 py-8"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow:
              '0 32px 64px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset',
          }}
        >
          {deviceHint === 'ios' && renderIOS()}
          {deviceHint === 'android' && renderAndroid()}
          {deviceHint === 'other' && renderDesktop()}
        </motion.div>
        <p className="mt-8 text-white/20 text-xs font-semibold tracking-[0.2em] uppercase select-none">FLOW</p>
      </div>
    </div>
  );
}
