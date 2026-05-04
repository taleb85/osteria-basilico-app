/** Parametri configurabili per sede — salvati in tenants.settings (JSONB). */
export interface TenantSettings {
  /** Font dell'intestazione app (id stringa, es. inter, parisienne) */
  header_font?: string;
  /** Timezone IANA, es. 'Europe/Rome' */
  timezone?: string;
  /** Lingua predefinita per i nuovi utenti */
  defaultLanguage?: 'it' | 'en' | 'es' | 'fr';
  /** Feature flag attivi/disattivi per questa sede */
  featureFlags?: Record<string, boolean>;
  /** Regole lavoro predefinite */
  workRules?: {
    maxDailyHours?: number;
    maxDailyHoursEnabled?: boolean;
    maxWeeklyHours?: number;
    maxWeeklyHoursEnabled?: boolean;
    minRestHours?: number;
    minRestHoursEnabled?: boolean;
    lateThresholdMinutes?: number;
    lateThresholdEnabled?: boolean;
    criticEnabled?: boolean;
    attentionEnabled?: boolean;
    overlapEnabled?: boolean;
  };
  /** Geofence predefinita */
  geofence?: {
    lat: number;
    lng: number;
    radiusM: number;
  } | null;
  /** Moduli attivi per questa sede */
  modules?: {
    timesheets?: boolean;
    shifts?: boolean;
    holidays?: boolean;
    statistics?: boolean;
  };
}

/** Configurazione di una sede (tenant). */
export interface Tenant {
  id: string;
  slug: string;
  name: string;
  accent_color: string;
  logo_url?: string | null;
  plan?: string;
  is_active: boolean;
  settings: TenantSettings;
  created_at: string;
  updated_at: string;
}

export type UserRole =
  | 'admin'
  | 'manager'
  | 'assistant_manager'
  | 'waiter'
  | 'server'
  | 'bartender'
  | 'cook'
  | 'chef'
  | 'dishwasher';

export type UserStatus = 'active' | 'suspended' | 'inactive';

export type ShiftType = 'lunch' | 'dinner';

export type ApprovalStatus = 'draft' | 'confirmed' | 'absent';

export type HolidayStatus = 'pending' | 'approved' | 'rejected';

export type Language = 'it' | 'en' | 'es' | 'fr';

export type Theme = 'light' | 'dark';

/** Reparto del dipendente — valore libero; i built-in sono 'sala_bar' | 'sala' | 'bar' | 'kitchen' */
export type Department = string;

/** Dati mensili confermati per un singolo mese (es. "2025-03") */
export interface MonthlyConfirmedData {
  minutes: number;
  shiftsCount: number;
}

export interface User {
  id: string;
  tenant_id?: string;
  first_name: string;
  /** Cognome opzionale */
  last_name?: string;
  email: string;
  /** Telefono opzionale */
  phone?: string;
  role: UserRole;
  pin: string;
  status: UserStatus;
  sort_order: number;
  language: Language;
  theme: Theme;
  can_create_shifts: boolean;
  can_approve_shifts: boolean;
  can_view_total_hours: boolean;
  can_edit_staff_pins: boolean;
  can_manage_drafts: boolean;
  /** Permette allo staff di richiedere ferie/permessi dalla dashboard personale */
  can_request_holidays?: boolean;
  /** Permette allo staff di timbrare entrata/uscita dalla dashboard personale */
  can_punch_from_app?: boolean;
  /** Ore e turni confermati per mese. Chiave: "YYYY-MM", valore: { minutes, shiftsCount } */
  monthly_confirmed?: Record<string, MonthlyConfirmedData>;
  /** Euro/ora (lordo) per stima costo in Ore; assente = non configurato */
  hourly_rate_eur?: number | null;
  /** Reparto: valori fissi sala | kitchen | bar */
  department?: Department;
  /** Moduli abilitati per questo profilo. Se vuoto, si usano i default per ruolo. */
  enabled_modules?: string[];
  /** Funzionalità abilitate (JSONB). Controlla visibilità dinamica: tabellone, PDF, Ore, ecc. */
  enabled_features?: Record<string, boolean>;
  /** Sezioni UI nascoste per scheda (`false` = non mostrare). Chiavi dal registro `UI_SCREEN_WIDGETS`. */
  ui_section_overrides?: Record<string, boolean>;
  /** Se true: account attivo ma non compare nel tabellone turni, presenze collettive e ore di gruppo (es. solo back-office). */
  hide_from_team_schedule?: boolean;
  /** Visibilità nel planning settimanale (template ruoli / Profili); `false` = nascosto dal planning. */
  team_schedule_visible?: boolean;
  /** Foto profilo (data URL o URL pubblico); opzionale, può non esistere come colonna su DB. */
  avatar_url?: string | null;
  /** Inizio rapporto (yyyy-MM-dd), opzionale */
  employment_start_date?: string | null;
  /** Fine rapporto / sospensione (yyyy-MM-dd), opzionale */
  employment_end_date?: string | null;
  /** PIN secondario per elevazione sessione temporanea (non persiste al refresh). */
  secondary_pin?: string | null;
  /** Ruolo effettivo concesso quando si usa il secondary_pin (session-only). */
  elevated_role?: UserRole | null;
}

export interface Shift {
  id: string;
  tenant_id?: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  type: ShiftType;
  approval_status: ApprovalStatus;
  /** Note opzionali visibili direttamente sul badge del turno */
  notes?: string;
  /** Nota interna visibile solo ai manager/admin */
  admin_note?: string;
  /** Se false, non si detrae la mezz'ora di pausa dal calcolo ore (default true). */
  deduct_break?: boolean;
  /** Minuti di pausa da detrarre (0 = nessuna; se null/undefined si usa regola automatica o breakRules). */
  break_minutes?: number;
  /** true se la pausa è stata applicata automaticamente (es. turno > 6h). */
  is_auto_break?: boolean;
  /** ID delle regole pausa (admin) da non detrarre su questo turno. */
  deduct_excluded_rule_ids?: string[];
  /** Reparto del turno (pianificazione; opzionale). */
  department?: Department;
  /** Competenze/task richieste per questo turno (es. "sommelier,cassa") */
  skills?: string;
}

export interface HolidayRequest {
  id: string;
  tenant_id?: string;
  user_id: string;
  start_date: string;
  end_date: string;
  /** ferie = annual leave, permesso = day-off, indisponibilita = unavailability marker */
  type?: 'ferie' | 'permesso' | 'indisponibilita';
  status: HolidayStatus;
  created_at: string;
  /** Motivazione opzionale (es. "Visita medica", "Ferie estive") */
  reason?: string;
  /** Email del richiedente per risposte automatiche */
  requester_email?: string;
}

/** Come è stata registrata la timbratura (persistita in `punch_records.source`). */
export type PunchRecordSource = 'kiosk' | 'manual' | 'manager';

export interface PunchRecord {
  id: string;
  tenant_id?: string;
  user_id: string;
  shift_id?: string;
  timestamp: string;
  calculated_time?: string;
  clock_out_time?: string | null;
  type: 'in' | 'out';
  /** kiosk = terminale / app self; manual = inserimento da Presenze; manager = responsabile per altro utente */
  source?: PunchRecordSource | null;
  /** ID admin che ha eseguito il quick-switch prima di questa timbratura (audit impersonazione). */
  impersonated_by?: string | null;
}
