import { useState, useEffect } from 'react';

/**
 * Ora locale del dispositivo, aggiornata a ogni cambio minuto (allineata al wall clock)
 * e subito al mount / ritorno in primo piano. Evita il ritardo fino a ~59s rispetto
 * all’orologio di sistema quando si usava solo `setInterval(..., 60_000)` da un tick arbitrario.
 */
export function useWallAlignedMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const sync = () => setNow(new Date());
    sync();

    /** Timer id browser (evita conflitto tipi DOM vs @types/node). */
    let intervalId: number | undefined;
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    const timeoutId = window.setTimeout(() => {
      sync();
      intervalId = window.setInterval(sync, 60_000) as unknown as number;
    }, msToNextMinute);

    const onForeground = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('focus', onForeground);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('focus', onForeground);
    };
  }, []);

  return now;
}
