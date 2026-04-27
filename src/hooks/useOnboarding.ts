import { useState, useEffect } from 'react';

const ONBOARDING_KEY = 'flow-onboarding-done';

export function useOnboarding() {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    try {
      const done = localStorage.getItem(ONBOARDING_KEY);
      if (!done) setShowTour(true);
    } catch {
      setShowTour(true);
    }
  }, []);

  const completeTour = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {
      /* ignore */
    }
    setShowTour(false);
  };

  const resetTour = () => {
    try {
      localStorage.removeItem(ONBOARDING_KEY);
    } catch {
      /* ignore */
    }
    setShowTour(true);
  };

  return { showTour, completeTour, resetTour };
}
