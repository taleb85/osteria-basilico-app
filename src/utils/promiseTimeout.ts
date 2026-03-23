/** Errore lanciato da {@link withTimeout} allo scadere del limite. */
export class TimeoutError extends Error {
  override readonly name = 'TimeoutError';

  constructor(message = 'Timeout') {
    super(message);
  }
}

/**
 * Fallisce con {@link TimeoutError} se `promise` non si risolve entro `ms`.
 * Non annulla l’operazione sottostante (es. fetch Supabase): evita solo che l’UI resti bloccata per ore.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  if (ms <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new TimeoutError(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}
