/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Project URL (es. https://xxx.supabase.co). Senza questo + chiave anon/publishable, `supabase` in `src/lib/supabase.ts` è `null`. */
  readonly VITE_SUPABASE_URL?: string;
  /** Chiave pubblica (Dashboard → API → anon). */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Se valorizzata ha priorità su `VITE_SUPABASE_ANON_KEY` nel client. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /**
   * REMOVED: Service role key non deve essere nel client.
   * Usa SUPABASE_SERVICE_ROLE_KEY (senza VITE_) solo in script Node.
   */
  /** Se "true", utenti loggati possono usare l'app nel browser senza PWA installata (solo build con questo env). */
  readonly VITE_ALLOW_BROWSER_APP?: string;
  /** Se "false", disattiva pull/push Storage config, revisione client e segnale Realtime impostazioni (DB/turni restano attivi). */
  readonly VITE_APP_CLOUD_SYNC?: string;
  readonly VITE_APP_CONFIG_STORAGE_ENABLED?: string;
  readonly VITE_APP_SETTINGS_SYNC_SIGNAL?: string;
  readonly VITE_FEATURE_FLAGS_STORAGE_ENABLED?: string;
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;

declare module 'virtual:pwa-register' {
  export function registerSW(options?: {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (swScriptUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  }): (reloadPage?: boolean) => Promise<void>;
}

declare module 'virtual:pwa-register/react' {
  type RegisterSWOptions = {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  };
  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, import('react').Dispatch<import('react').SetStateAction<boolean>>];
    offlineReady: [boolean, import('react').Dispatch<import('react').SetStateAction<boolean>>];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}
