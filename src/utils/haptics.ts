/**
 * Cross-platform haptic feedback utility.
 * - iOS Safari PWA: AudioContext click (navigator.vibrate not available)
 * - Android Chrome: navigator.vibrate()
 * - Desktop: no-op
 */

export type HapticStyle = 'light' | 'click' | 'medium' | 'heavy' | 'success' | 'error' | 'warning'

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream

const isAndroid = () => /Android/.test(navigator.userAgent)

let audioCtx: AudioContext | null = null

const getAudioContext = (): AudioContext | null => {
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return null
      audioCtx = new AudioCtx()
    }
    return audioCtx
  } catch {
    return null
  }
}

const iosHaptic = (style: HapticStyle) => {
  const ctx = getAudioContext()
  if (!ctx) return

  const run = () => {
    try {
      const config: Record<HapticStyle, { freq: number; duration: number; gain: number }> = {
        light:   { freq: 1000, duration: 0.02, gain: 0.1 },
        click:   { freq: 1000, duration: 0.02, gain: 0.1 },
        medium:  { freq: 800,  duration: 0.04, gain: 0.15 },
        heavy:   { freq: 600,  duration: 0.06, gain: 0.2 },
        success: { freq: 1200, duration: 0.05, gain: 0.12 },
        error:   { freq: 400,  duration: 0.08, gain: 0.2 },
        warning: { freq: 700,  duration: 0.05, gain: 0.15 },
      }

      const { freq, duration, gain } = config[style]
      const now = ctx.currentTime

      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      gainNode.gain.setValueAtTime(gain, now)
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration)
      oscillator.frequency.setValueAtTime(freq, now)
      oscillator.type = 'sine'

      oscillator.start(now)
      oscillator.stop(now + duration + 0.01)
    } catch { /* ignore */ }
  }

  if (ctx.state === 'running') {
    run()
  } else if (ctx.state === 'suspended') {
    ctx.resume().then(run).catch(() => {})
  }
}

const androidHaptic = (style: HapticStyle) => {
  if (!navigator.vibrate) return
  const patterns: Record<HapticStyle, number[]> = {
    light:   [10],
    click:   [10],
    medium:  [20],
    heavy:   [40],
    success: [10, 50, 10],
    error:   [40, 30, 40],
    warning: [20, 20, 20],
  }
  try { navigator.vibrate(patterns[style]) } catch { /* ignore */ }
}

export const haptic = (style: HapticStyle = 'light') => {
  try {
    if (isIOS()) {
      iosHaptic(style)
    } else if (isAndroid()) {
      androidHaptic(style)
    }
  } catch { /* fail silently */ }
}

export const hapticLight   = () => haptic('light')
export const hapticHeavy   = () => haptic('heavy')
