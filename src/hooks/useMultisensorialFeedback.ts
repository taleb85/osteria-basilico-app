import { useCallback, useEffect, useState } from 'react';
import { audioHapticByType, unlockAudioContext } from '../utils/hapticFeedbackCore';

export type HapticType = 'success' | 'warning' | 'error' | 'click' | 'heavy' | 'medium' | 'light';

// Durate in ms — minimo 20ms per essere percepibili dalla maggior parte dei motori Android
const VIB_CONFIG: Record<HapticType, number[]> = {
  light:   [20],
  click:   [25],
  medium:  [40],
  success: [25, 60, 25],
  warning: [40, 40, 40],
  heavy:   [70],
  error:   [50, 40, 50],
};

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

    // Android: navigator.vibrate nativo
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        const factor = hapticIntensity / 100;
        const base = VIB_CONFIG[type] ?? [20];
        const scaled = base.map((v, i) => i % 2 === 0 ? Math.max(1, Math.round(v * factor)) : v);
        navigator.vibrate(scaled);
        return;
      } catch { /* fallthrough a Web Audio */ }
    }

    // iOS PWA: Web Audio click — assicura che AudioContext sia running prima di suonare
    unlockAudioContext();
    audioHapticByType(type);
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
