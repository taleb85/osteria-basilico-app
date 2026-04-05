import { useCallback, useEffect, useState } from 'react';

export type HapticType = 'success' | 'warning' | 'error' | 'click' | 'heavy' | 'medium' | 'light';

/** True se siamo su iOS Safari (non supporta navigator.vibrate) */
const isIOS = typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(window as any).MSStream;

/**
 * Haptic per iOS via Web Audio API:
 * - oscilla a frequenza sub-bass (1–5 Hz) per pochi ms
 * - attiva il Taptic Engine indirettamente
 * - la durata/intensità cambia il tipo di feedback percepito
 */
function iosHaptic(type: HapticType) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Frequenza sub-bass — attiva il Taptic Engine senza emettere suono udibile
    const config: Record<HapticType, { freq: number; dur: number; amp: number }> = {
      light:   { freq: 1,  dur: 0.008, amp: 0.3 },
      click:   { freq: 2,  dur: 0.010, amp: 0.5 },
      medium:  { freq: 2,  dur: 0.015, amp: 0.7 },
      success: { freq: 3,  dur: 0.020, amp: 0.8 },
      warning: { freq: 4,  dur: 0.025, amp: 0.9 },
      heavy:   { freq: 5,  dur: 0.030, amp: 1.0 },
      error:   { freq: 5,  dur: 0.040, amp: 1.0 },
    };

    const { freq, dur, amp } = config[type] ?? config.success;
    const now = ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(amp, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.start(now);
    osc.stop(now + dur);
    osc.onended = () => ctx.close();
  } catch {
    // AudioContext non disponibile — silenzio
  }
}

/**
 * Hook per gestire feedback multisensoriale:
 * - Vibrazione tattile (Haptic Feedback) — Android: navigator.vibrate, iOS: Web Audio sub-bass
 * - Suoni notifica
 */
export function useMultisensorialFeedback() {
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    const stored = localStorage.getItem('app:soundEnabled');
    return stored !== 'false'; // Default: true
  });

  const [soundVolume, setSoundVolume] = useState(() => {
    const stored = localStorage.getItem('app:soundVolume');
    return stored ? parseInt(stored, 10) : 50; // Default: 50%
  });

  const [hapticIntensity, setHapticIntensity] = useState(() => {
    const stored = localStorage.getItem('app:hapticIntensity');
    const v = stored ? parseInt(stored, 10) : 100;
    // Ripristina il default se il valore salvato è 0 (evita feedback silenziosi)
    return v > 0 ? v : 100;
  });

  // Persisti le impostazioni
  useEffect(() => {
    localStorage.setItem('app:soundEnabled', String(isSoundEnabled));
  }, [isSoundEnabled]);

  useEffect(() => {
    localStorage.setItem('app:soundVolume', String(soundVolume));
  }, [soundVolume]);

  useEffect(() => {
    localStorage.setItem('app:hapticIntensity', String(hapticIntensity));
  }, [hapticIntensity]);

  /**
   * Feedback aptico.
   * - iOS: Web Audio sub-bass (attiva Taptic Engine)
   * - Android/altri: navigator.vibrate
   */
  const triggerHapticFeedback = useCallback((type: HapticType = 'success') => {
    if (hapticIntensity === 0) return;

    if (isIOS) {
      iosHaptic(type);
      return;
    }

    if (!('vibrate' in navigator)) return;

    try {
      const factor = hapticIntensity / 100;
      const patterns: Record<HapticType, number[]> = {
        success: [Math.round(20 * factor), 40, Math.round(20 * factor)],
        warning: [Math.round(40 * factor), 30, Math.round(40 * factor)],
        error:   [Math.round(60 * factor), 40, Math.round(60 * factor)],
        click:   [Math.round(25 * factor)],
        heavy:   [Math.round(70 * factor)],
        medium:  [Math.round(40 * factor)],
        light:   [Math.round(15 * factor)],
      };
      navigator.vibrate(patterns[type] ?? patterns.success);
    } catch (err) {
      console.warn('[Haptic] Vibration not available:', err);
    }
  }, [hapticIntensity]);

  /**
   * Riproduci suono di notifica via Web Audio API.
   */
  const playNotificationSound = useCallback(async () => {
    if (!isSoundEnabled) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      gainNode.gain.setValueAtTime(soundVolume / 100, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.type = 'sine';

      const duration = 0.15;
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(soundVolume / 100, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration - 0.02);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (err) {
      console.warn('[Audio] Sound not available:', err);
    }
  }, [isSoundEnabled, soundVolume]);

  /**
   * Callback combinato: vibrazione + suono.
   */
  const triggerFeedback = useCallback(
    (hapticType: HapticType = 'success', playSound = true) => {
      triggerHapticFeedback(hapticType);
      if (playSound) {
        playNotificationSound();
      }
    },
    [triggerHapticFeedback, playNotificationSound]
  );

  return {
    triggerHapticFeedback,
    playNotificationSound,
    triggerFeedback,
    hapticIntensity,
    setHapticIntensity,
    isSoundEnabled,
    setIsSoundEnabled,
    soundVolume,
    setSoundVolume,
  };
}
