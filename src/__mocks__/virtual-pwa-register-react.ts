/**
 * Shim per virtual:pwa-register/react in ambiente di sviluppo.
 * In produzione, vite-plugin-pwa fornisce questo modulo.
 */
export function useRegisterSW(_options?: Record<string, unknown>) {
  return {
    needRefresh: false,
    offlineReady: false,
    updateServiceWorker: async (_reloadPage?: boolean) => {},
  };
}
