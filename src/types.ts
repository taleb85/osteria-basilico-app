export type UserRole =
  | 'admin'
  | 'manager'
  | 'assistant_manager'
  | 'capo'
  | 'waiter'
  | 'server'
  | 'bartender'
  | 'cook'
  | 'chef'
  | 'dishwasher';

export type UserStatus = 'active' | 'suspended' | 'inactive';

export type ShiftType = 'lunch' | 'dinner';

export type ApprovalStatus = 'draft' | 'approved' | 'confirmed' | 'absent';

export type HolidayStatus = 'pending' | 'approved' | 'rejected';

export type Language = 'it' | 'en' | 'es' | 'fr';

export type Theme = 'light' | 'dark';

/** Reparto del dipendente — valore libero; i built-in sono 'sala' | 'kitchen' | 'bar' */
export type Department = string;

/** Dati mensili confermati per un singolo mese (es. "2025-03") */
export interface MonthlyConfirmedData {
  minutes: number;
  shiftsCount: number;
}

export interface User {
  id: string;
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
  /** Foto profilo (data URL o URL pubblico); opzionale, può non esistere come colonna su DB. */
  avatar_url?: string | null;
  /** Inizio rapporto (yyyy-MM-dd), opzionale */
  employment_start_date?: string | null;
  /** Fine rapporto / sospensione (yyyy-MM-dd), opzionale */
  employment_end_date?: string | null;
}

export interface Shift {
  id: string;
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
  /** Reparto del turno (pianificazione; opzionale). */
  department?: Department;
  /** Competenze/task richieste per questo turno (es. "sommelier,cassa") */
  skills?: string;
  /** Timestamp di quando il turno è stato approvato (ISO string); null per svuotare in update */
  approved_at?: string | null;
  /** Nome del manager che ha approvato; null per svuotare in update */
  approved_by?: string | null;
  /** Orari congelati alla approvazione definitiva (HH:mm), distinti dal pianificato su start_time/end_time */
  approved_start_time?: string | null;
  approved_end_time?: string | null;
}

export interface HolidayRequest {
  id: string;
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
  user_id: string;
  shift_id?: string;
  timestamp: string;
  calculated_time?: string;
  clock_out_time?: string | null;
  type: 'in' | 'out';
  /** kiosk = terminale / app self; manual = inserimento da Presenze; manager = responsabile per altro utente */
  source?: PunchRecordSource | null;
}

/**
 * Audit log entry per ogni modifica manuale a un punch_record effettuata da un Admin/Manager.
 * Persistito nella tabella Supabase `punch_audit_log`.
 */
export interface PunchAuditEntry {
  id: string;
  punch_record_id: string;
  actor_id?: string;
  actor_name: string;
  /** Campo modificato: 'timestamp' | 'calculated_time' | 'clock_out_time' */
  field: string;
  old_value?: string;
  new_value?: string;
  changed_at: string;
}
