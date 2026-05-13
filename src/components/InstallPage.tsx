/**
 * InstallPage — Schermata di installazione unica per iOS e Android.
 * Mostra 2 pulsanti grandi: "Scarica per iPhone" e "Scarica per Android".
 * iOS → scarica il profilo .mobileconfig + mostra passaggi PWA
 * Android → mostra passaggi PWA
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Smartphone, Monitor, Apple, Download } from 'lucide-react';
import { useT } from '../hooks/useT';
import { formatTrans } from '../utils/translations';
import { PATH_PROFILO } from '../config/appPaths';
import FlowLogoSvg from './FlowLogoSvg';

type InstallView = 'choose' | 'android';

function getDeviceHint(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

export default function InstallPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const t = useT() as Record<string, string>;
  const tr = (key: string) => t[key] ?? key;

  const userId = searchParams.get('userId') ?? '';
  const firstName = searchParams.get('firstName') ?? '';

  const [view, setView] = useState<InstallView>('choose');
  const [installing, setInstalling] = useState<'idle' | 'downloading' | 'done'>('idle');

  const deviceHint = useMemo(() => getDeviceHint(), []);

  // Se l'utente arriva da Android, mostra subito le istruzioni
  useEffect(() => {
    if (deviceHint === 'android') setView('android');
  }, [deviceHint, userId]);

  const handleDownloadiOS = () => {
    setInstalling('downloading');
    const link = document.createElement('a');
    link.href = '/Installa_FLOW.mobileconfig';
    link.download = 'Installa_FLOW.mobileconfig';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setInstalling('done'), 1000);
  };

  const handleChooseAndroid = () => {
    setView('android');
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

  /* ─── Schermata di caricamento ─── */
  const renderLoading = () => (
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-6 h-6 text-[#6699FF] animate-spin" strokeWidth={2.5} />
      <span className="text-sm text-white/60">{tr('install_loading')}</span>
    </div>
  );

  /* ─── Schermata di scelta (iOS / Android) ─── */
  const renderChoose = () => (
    <>
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6"
      >
        <FlowLogoSvg variant="icon-only" color="orange" style={{ width: 80, height: 80, borderRadius: 18 }} />
      </motion.div>

      <h1 className="text-xl font-bold text-white tracking-tight mb-1.5 text-center">
        {firstName ? formatTrans(tr('install_welcome_name'), { name: firstName }) : tr('install_welcome')}
      </h1>
      <p className="text-sm text-white/50 text-center leading-relaxed mb-8">
        {tr('install_choose_device')}
      </p>

      {/* Stato download completato */}
      {installing === 'done' ? (
        <>
          <div className="mb-2 px-4 py-3 rounded-xl text-sm text-green-400 text-center" style={{ background: 'rgba(52,199,89,0.1)' }}>
            {tr('install_downloaded')}
          </div>
          <div className="mb-4 px-4 py-2.5 rounded-xl text-xs text-white/50 leading-relaxed" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {tr('install_old_profile_hint')}
          </div>
        </>
      ) : installing === 'downloading' ? (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <Loader2 className="w-4 h-4 text-[#6699FF] animate-spin" />
          <span className="text-sm text-white/60">{tr('install_downloading')}</span>
        </div>
      ) : null}

      {/* Pulsante iOS */}
      <button
        type="button"
        onClick={handleDownloadiOS}
        disabled={installing === 'downloading'}
        className="w-full flex items-center gap-4 rounded-2xl px-5 py-4 text-left transition-all active:scale-[0.98] disabled:opacity-50"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(0,122,255,0.2)' }}>
          <Apple className="w-5 h-5 text-[#007AFF]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{tr('install_ios_btn')}</div>
          <div className="text-[11px] text-white/45 mt-0.5">{tr('install_ios_desc')}</div>
        </div>
        {installing === 'downloading' ? (
          <Loader2 className="w-4 h-4 text-white/40 animate-spin shrink-0" />
        ) : (
          <Download className="w-4 h-4 text-white/40 shrink-0" />
        )}
      </button>

      {/* Pulsante Android */}
      <button
        type="button"
        onClick={handleChooseAndroid}
        className="w-full flex items-center gap-4 rounded-2xl px-5 py-4 text-left transition-all active:scale-[0.98] mt-3"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(52,199,89,0.2)' }}>
          <Smartphone className="w-5 h-5 text-[#34C759]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{tr('install_android_btn')}</div>
          <div className="text-[11px] text-white/45 mt-0.5">{tr('install_android_desc')}</div>
        </div>
      </button>

      {/* Link continua senza installare */}
      <button
        type="button"
        onClick={handleContinue}
        className="w-full text-center text-xs text-white/40 hover:text-white/70 transition-colors mt-6 py-2"
      >
        {tr('install_skip')}
      </button>
    </>
  );

  /* ─── Schermata Android ─── */
  const renderAndroid = () => (
    <>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6"
      >
        <FlowLogoSvg variant="icon-only" color="orange" style={{ width: 80, height: 80, borderRadius: 18 }} />
      </motion.div>

      <h1 className="text-xl font-bold text-white tracking-tight mb-1.5 text-center">
        {tr('install_android_title')}
      </h1>
      <p className="text-sm text-white/50 text-center leading-relaxed mb-6">
        {tr('install_android_intro')}
      </p>

      {/* Passaggi */}
      <ol className="space-y-4 list-decimal list-outside pl-5 pr-1 text-left marker:text-white/30">
        <li className="text-sm text-white/80 leading-relaxed pl-2">
          {tr('install_android_step1')}
        </li>
        <li className="text-sm text-white/80 leading-relaxed pl-2">
          {tr('install_android_step2')}
        </li>
        <li className="text-sm text-white/80 leading-relaxed pl-2">
          {tr('install_android_step3')}
        </li>
      </ol>

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
          {view === 'choose' && renderChoose()}
          {view === 'android' && renderAndroid()}
        </motion.div>
        <p className="mt-8 text-white/20 text-xs font-semibold tracking-[0.2em] uppercase select-none">FLOW</p>
      </div>
    </div>
  );
}
