import { useCallback, useEffect, useState } from 'react';
import { haptic } from '../utils/haptics';
import { unlockAudioContext } from '../utils/hapticFeedbackCore';

export type HapticType = 'success' | 'warning' | 'error' | 'click' | 'heavy' | 'medium' | 'light';


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

  const triggerHapticFeedback = useCallback((type: HapticType = 'success') => {
    if (hapticIntensity === 0) return;
    unlockAudioContext();
    haptic(type);
  }, [hapticIntensity]);

  /**
   * Suono notifica disabilitato.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const playNotificationSound = useCallback(async (_isSoundEnabled?: boolean, _soundVolume?: number) => {
    /* suono disabilitato */
  }, []);

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
