import { useCallback, useEffect, useState } from 'react';

export type HapticType = 'success' | 'warning' | 'error' | 'click' | 'heavy' | 'medium' | 'light';

/**
 * Hook per gestire feedback multisensoriale:
 * - Vibrazione tattile (Haptic Feedback)
 * - Suoni notifica
 */
export function useMultisensorialFeedback() {
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    // Leggi da localStorage
    const stored = localStorage.getItem('app:soundEnabled');
    return stored !== 'false'; // Default: true
  });

  const [soundVolume, setSoundVolume] = useState(() => {
    const stored = localStorage.getItem('app:soundVolume');
    return stored ? parseInt(stored, 10) : 50; // Default: 50%
  });

  const [hapticIntensity, setHapticIntensity] = useState(() => {
    const stored = localStorage.getItem('app:hapticIntensity');
    return stored ? parseInt(stored, 10) : 100; // Default: 100%
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
   * Feedback aptico (vibrazione tattile).
   * Ottimizzato per batteria: check supporto e tipo dispositivo.
   */
  const triggerHapticFeedback = useCallback((type: HapticType = 'success') => {
    // Check supporto
    if (!('vibrate' in navigator) || hapticIntensity === 0) return;

    try {
      const factor = hapticIntensity / 100;
      
      // Vibration patterns (in millisecondi: vibra, pausa, vibra, ...)
      const patterns: Record<HapticType, number[]> = {
        success: [20 * factor, 40, 20 * factor],
        warning: [40 * factor, 30, 40 * factor],
        error: [60 * factor, 40, 60 * factor],
        click: [25 * factor],
        heavy: [70 * factor],
        medium: [40 * factor],
        light: [15 * factor],
      };

      navigator.vibrate(patterns[type] || patterns.success);
    } catch (err) {
      console.warn('[Haptic] Vibration not available:', err);
    }
  }, [hapticIntensity]);

  /**
   * Riproduci suono di notifica.
   * Controlla se abilitato e volume.
   */
  const playNotificationSound = useCallback(async () => {
    if (!isSoundEnabled) return;

    try {
      // Crea AudioContext per riprodurre il suono
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Generare un semplice "ping" sinteticamente
      // Oppure usare: const audio = new Audio('/sounds/notification.mp3');
      
      // Per semplicità, generiamo un suono via Web Audio API
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Imposta volume (0-1)
      gainNode.gain.setValueAtTime(soundVolume / 100, audioContext.currentTime);
      
      // Frequenza "ping" più cristallina (A5: 880 Hz)
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.type = 'sine';
      
      // Durata leggermente più lunga: 150ms
      const duration = 0.15;
      
      // Envelope ADSR (Attack, Decay, Sustain, Release)
      gainNode.gain.setValueAtTime(0, audioContext.currentTime); // Attack
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
