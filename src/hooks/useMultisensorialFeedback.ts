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

  // Persisti le impostazioni di suono
  useEffect(() => {
    localStorage.setItem('app:soundEnabled', String(isSoundEnabled));
  }, [isSoundEnabled]);

  useEffect(() => {
    localStorage.setItem('app:soundVolume', String(soundVolume));
  }, [soundVolume]);

  /**
   * Feedback aptico (vibrazione tattile).
   * Ottimizzato per batteria: check supporto e tipo dispositivo.
   */
  const triggerHapticFeedback = useCallback((type: HapticType = 'success') => {
    // Check supporto
    if (!('vibrate' in navigator)) return;

    try {
      // Vibration patterns (in millisecondi: vibra, pausa, vibra, ...)
      const patterns: Record<HapticType, number[]> = {
        success: [10, 30, 10], // Breve e "premium"
        warning: [30, 20, 30], // Più lungo, avvertenza
        error: [50, 30, 50], // Lungo e deciso
        click: [15], // Singolo "scatto"
        heavy: [50], // Singolo pesante
        medium: [30], // Singolo medio
        light: [10], // Singolo leggero
      };

      navigator.vibrate(patterns[type] || patterns.success);
    } catch (err) {
      console.warn('[Haptic] Vibration not available:', err);
    }
  }, []);

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
      
      // Frequenza "ping" gradevole (F5: 698.46 Hz)
      oscillator.frequency.setValueAtTime(698, audioContext.currentTime);
      oscillator.type = 'sine';
      
      // Durata: 100ms
      const duration = 0.1;
      
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
    isSoundEnabled,
    setIsSoundEnabled,
    soundVolume,
    setSoundVolume,
  };
}
