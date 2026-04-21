/**
 * Feedback aptico/audio — iOS PWA & Web Clip.
 *
 * Su iOS il Taptic Engine NON è accessibile da web (nemmeno da PWA).
 * navigator.vibrate è solo Android.
 *
 * Approccio iOS:
 *   - Feedback VISIVO: CSS button:active { scale(0.95) } — gestito in index.css
 *   - Feedback AUDIO: click sonoro brevissimo via Web Audio (440→220 Hz, 25ms)
 *     percepibile come "tap" discreto senza disturbare
 *
 * unlockAudioContext() va chiamato al primo tocco utente (App.tsx).
 */

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!_ctx || _ctx.state === 'closed') {
      _ctx = new AudioCtx();
    }
    return _ctx;
  } catch {
    return null;
  }
}

/** Sblocca AudioContext iOS al primo gesto utente — chiamare da App.tsx. */
export function unlockAudioContext(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  try {
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch { /* ignore */ }

  // Auto-resume AudioContext quando l'app torna in foreground (dopo background iOS)
  if (typeof document !== 'undefined') {
    const onVisible = () => {
      const c = getCtx();
      if (c && c.state === 'suspended') {
        c.resume().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onVisible();
    });
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('focus', onVisible);
  }
}

/**
 * Click audio breve — oscillatore con portamento rapido verso il basso.
 * Produce un "tick" netto e discreto percepibile sull'iPhone.
 */
function audioClick(
  startFreq = 440,
  endFreq = 220,
  durationMs = 22,
  amplitude = 0.18,
): void {
  const ctx = getCtx();
  if (!ctx) return;

  const run = () => {
    try {
      const dur = durationMs / 1000;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

      gain.gain.setValueAtTime(amplitude, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.01);
    } catch { /* ignore */ }
  };

  if (ctx.state === 'running') {
    run();
  } else if (ctx.state === 'suspended') {
    ctx.resume().then(run).catch(() => {});
  }
}

export type AudioHapticType = 'light' | 'click' | 'medium' | 'success' | 'warning' | 'heavy' | 'error';

export function audioHapticByType(type: AudioHapticType): void {
  switch (type) {
    case 'light':
      return audioClick(380, 190, 16, 0.12);
    case 'click':
      return audioClick(440, 220, 22, 0.18);
    case 'medium':
      return audioClick(500, 250, 28, 0.22);
    case 'heavy':
      return audioClick(300, 120, 35, 0.28);
    case 'success':
      audioClick(440, 660, 20, 0.18);
      setTimeout(() => audioClick(550, 770, 18, 0.15), 55);
      return;
    case 'warning':
      audioClick(350, 200, 25, 0.20);
      setTimeout(() => audioClick(350, 200, 20, 0.16), 50);
      return;
    case 'error':
      audioClick(280, 140, 30, 0.25);
      setTimeout(() => audioClick(240, 120, 25, 0.20), 40);
      return;
  }
}

export { hapticLight as lightHaptic, hapticHeavy as heavyHaptic } from './haptics';

/** Vibrate + ascending double-beep: usato per clock-in riuscito. */
export function punchInSound(): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([8, 40, 12]); } catch { /* ignore */ }
    }
    audioClick(440, 660, 90, 0.16);
    setTimeout(() => audioClick(550, 880, 80, 0.13), 110);
  } catch { /* not supported */ }
}

/** Vibrate + descending double-beep: usato per clock-out riuscito. */
export function punchOutSound(): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([12, 40, 8]); } catch { /* ignore */ }
    }
    audioClick(660, 330, 90, 0.16);
    setTimeout(() => audioClick(440, 220, 80, 0.13), 110);
  } catch { /* not supported */ }
}
