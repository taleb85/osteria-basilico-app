/**
 * Monitoring & error tracking abstraction.
 *
 * Attualmente: console-based (log locale).
 * Per attivare Sentry in produzione:
 *   1. npm install @sentry/react @sentry/vite-plugin
 *   2. Aggiungere VITE_SENTRY_DSN=___ al .env
 *   3. In init(): chiamare Sentry.init({ dsn: ___, environment, release })
 *   4. In captureException(): chiamare Sentry.captureException()
 */

const ENV = import.meta.env.MODE ?? 'development';

interface MonitoringConfig {
  dsn?: string;
  environment: string;
  release?: string;
  enabled: boolean;
}

let config: MonitoringConfig = {
  environment: ENV,
  enabled: ENV === 'production',
};

export function configureMonitoring(cfg: Partial<MonitoringConfig>): void {
  config = { ...config, ...cfg };
}

export function isMonitoringEnabled(): boolean {
  return config.enabled;
}

export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!config.enabled && ENV !== 'development') return;
  console.error('[monitoring]', error.message, context ?? '');
  if (ENV === 'development') {
    console.warn('[monitoring] SENTRY NON INTEGRATO — installa @sentry/react e configura VITE_SENTRY_DSN');
  }
}

export function captureMessage(msg: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!config.enabled) return;
  console.log(`[monitoring:${level}]`, msg);
}

export function setUser(id: string, email?: string): void {
  if (!config.enabled) return;
  console.log('[monitoring] user set:', id, email ?? '');
}

export function clearUser(): void {
  if (!config.enabled) return;
  console.log('[monitoring] user cleared');
}
