import { lightHaptic as baseLightHaptic } from './hapticFeedbackCore';

export const lightHaptic = () => {
  try {
    baseLightHaptic();
  } catch (e) {
    // Fallback if not supported
  }
};
