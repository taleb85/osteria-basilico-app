/**
 * Cross-platform haptic feedback utility.
 * - iOS Safari PWA: AudioContext click (navigator.vibrate not available)
 * - Android Chrome: navigator.vibrate()
 * - Desktop: no-op
 */

export type HapticStyle = 'light' | 'click' | 'medium' | 'heavy' | 'success' | 'error' | 'warning'

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(window as Window & { MSStream?: unknown }).MSStream

const isAndroid = () => /Android/.test(navigator.userAgent)

const iosHaptic = (_style: HapticStyle) => {
  /* vibrazione audio disabilitata */
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
