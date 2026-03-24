/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Project URL (es. https://xxx.supabase.co). Senza questo + chiave anon/publishable, `supabase` in `src/lib/supabase.ts` è `null`. */
  readonly VITE_SUPABASE_URL?: string;
  /** Chiave pubblica (Dashboard → API → anon). */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Se valorizzata ha priorità su `VITE_SUPABASE_ANON_KEY` nel client. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /**
   * Service role: usata solo da script Node in `scripts/` tramite `.env`.
   * Non referenziare in `src/`: con prefisso `VITE_` Vite la includerebbe nel bundle se importata nel client.
   */
  readonly VITE_SUPABASE_SERVICE_ROLE_KEY?: string;
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
