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
    const w = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioCtx = window.AudioContext || w.webkitAudioContext;
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function audioClick(
  _startFreq = 440,
  _endFreq = 220,
  _durationMs = 22,
  _amplitude = 0.18,
): void {
  /* audio disabilitato */
}

export { hapticLight as lightHaptic, hapticHeavy as heavyHaptic } from './haptics';

/** Audio disabilitato. */
export function punchInSound(): void { /* disabilitato */ }
/** Audio disabilitato. */
export function punchOutSound(): void { /* disabilitato */ }
