import { useMemo } from 'react';
import type { Shift } from '../types';
import { isShiftPayrollFrozen } from '../utils/timesheetFreezeCriteria';

/**
 * Riga shift nel drawer (può essere diversa dall'entità Shift completa).
 * Deve essere compatibile con l'interfaccia ShiftRow di Timesheets.tsx
 */
export interface ShiftRow {
  id: string;
  status: string;
  punched: boolean;
  actualStart: string | null;
  actualEnd: string | null;
  plannedStart: string;
  plannedEnd: string | null;
  punchInId?: string; // optional, non null
  approval_status?: string;
  payroll_locked_at?: string | null;
}

/**
 * Parametri per il calcolo dei permessi del drawer.
 */
export interface DrawerPermissionsParams {
  /** Riga shift visualizzata nel drawer */
  shiftRow: ShiftRow;
  /** Shift completo dal DB (opzionale: se disponibile, usa per determinare isFrozen) */
  fullShift?: Shift | null;
  /** Data del turno in formato 'yyyy-MM-dd' */
  dateStr: string;
  /** Data odierna in formato 'yyyy-MM-dd' */
  todayStr: string;
  /** L'utente corrente può approvare timesheet (ruolo management) */
  canTimesheetApprove: boolean;
  /** L'utente corrente può operare su team timesheet (gestire turni altrui) */
  canTeamTimesheetOps: boolean;
  /** Feature flag: richiedi PIN per operazioni protette */
  unlockWithPinEnabled: boolean;
  /** Stato unlock: shift ID per cui le timbrature sono sbloccate */
  timbratureUnlockedShiftId: string | null;
  /** Stato unlock: shift ID per cui gli orari pianificati sono sbloccati */
  plannedTimesUnlockedShiftId: string | null;
  /** Stato unlock: shift ID per cui lo storico è sbloccato */
  historyUnlockedShiftId: string | null;
  /** Sessione drawer globale: se presente, bypass PIN per tutte le operazioni */
  drawerSessionId: string | null;
  /** Sessione globale app: se presente, bypass PIN completo */
  globalSessionId?: string | null;
}

/**
 * Calcola se il turno è "frozen" per payroll (approvato = congelato).
 */
function computeIsFrozen(shiftRow: ShiftRow, fullShift?: Shift | null): boolean {
  if (fullShift) {
    return isShiftPayrollFrozen(fullShift);
  }
  // Fallback: se non abbiamo fullShift, usiamo approval_status
  return shiftRow.approval_status === 'approved' || !!shiftRow.payroll_locked_at;
}

/**
 * Hook per calcolare i permessi del drawer dettaglio turno.
 * 
 * Centralizza tutta la logica di:
 * - Quali operazioni può fare l'utente (approve, edit, mark absent, ...)
 * - Se il PIN è richiesto per ciascuna operazione
 * - Se il form di modifica deve essere visibile
 * 
 * Sostituisce le variabili locali sparse nel componente Timesheets.tsx.
 */
export function useDrawerPermissions(params: DrawerPermissionsParams) {
  const {
    shiftRow: s,
    fullShift,
    dateStr,
    todayStr,
    canTimesheetApprove,
    canTeamTimesheetOps,
    unlockWithPinEnabled,
    timbratureUnlockedShiftId,
    plannedTimesUnlockedShiftId,
    historyUnlockedShiftId,
    drawerSessionId,
    globalSessionId,
  } = params;

  return useMemo(() => {
    const isFrozen = computeIsFrozen(s, fullShift);
    const isApproved = isFrozen;
    const isAbsent = s.status === 'absent';
    const isInPast = dateStr <= todayStr;

    // ── Azioni principali ──
    
    /** Può chiudere turno aperto (punch in senza punch out) */
    const canClose = canTeamTimesheetOps && s.punched && !s.actualEnd && !!s.punchInId && !isFrozen;

    /** Può segnare "non ha lavorato" (absent) */
    const canMarkAbsent = canTimesheetApprove && !isFrozen && !isAbsent && isInPast;

    /** Può congelare (approve) il turno */
    const canFreeze = canTimesheetApprove && !isFrozen;

    /** Può sbloccare turno congelato */
    const canUnlockFrozen = canTimesheetApprove && isFrozen;

    // ── Timbrature (entrata/uscita) ──

    /** PIN richiesto per modificare timbrature */
    const pinRequiredForTimbrature =
      canTeamTimesheetOps && unlockWithPinEnabled && isInPast;

    /** Può modificare timbrature: gestionale + (non frozen O shift sbloccato) + non absent + passato */
    const timbratureEditorEligible =
      canTeamTimesheetOps &&
      (!isFrozen || timbratureUnlockedShiftId === s.id) &&
      !isAbsent &&
      isInPast;

    /** Può inserire nuove timbrature (turno non timbrato) */
    const canTimbratureInsert = timbratureEditorEligible && !s.punched;

    /** Può modificare timbrature esistenti */
    const canTimbratureEdit = timbratureEditorEligible && s.punched && !!s.punchInId;

    /** Mostra form modifica timbrature (dopo aver passato il PIN gate se necessario) */
    const showTimbratureForm =
      (canTimbratureInsert || canTimbratureEdit) &&
      (!pinRequiredForTimbrature ||
        timbratureUnlockedShiftId === s.id ||
        !!drawerSessionId ||
        !!globalSessionId);

    /** PIN gate attivo per timbrature: richiede sblocco prima di mostrare form */
    const timbraturePinGateActive =
      pinRequiredForTimbrature &&
      !isAbsent &&
      timbratureUnlockedShiftId !== s.id &&
      // Per turni congelati: sempre richiedere PIN unlock_frozen anche se la sessione è già aperta
      (isFrozen ? true : !drawerSessionId && !globalSessionId && timbratureEditorEligible);

    // ── Orari pianificati (start_time / end_time) ──

    const frozenButUnlocked = isFrozen && timbratureUnlockedShiftId === s.id;

    /** PIN richiesto per modificare orari pianificati (turni confirmed o frozen-sbloccati) */
    const pinRequiredForPlannedTimes =
      unlockWithPinEnabled &&
      (s.status === 'confirmed' || frozenButUnlocked) &&
      canTeamTimesheetOps &&
      (!isFrozen || frozenButUnlocked) &&
      !isAbsent;

    /** Mostra editor orari pianificati (turni published: confirmed o approved-sbloccato) */
    const showPlannedTimesEditor =
      (s.status === 'confirmed' || frozenButUnlocked) &&
      canTeamTimesheetOps &&
      (!isFrozen || frozenButUnlocked) &&
      !isAbsent &&
      (!pinRequiredForPlannedTimes ||
        plannedTimesUnlockedShiftId === s.id ||
        !!drawerSessionId ||
        !!globalSessionId);

    /** Mostra bottone PIN per sbloccare editor orari pianificati */
    const showPlannedTimesPinButton =
      pinRequiredForPlannedTimes &&
      plannedTimesUnlockedShiftId !== s.id &&
      !drawerSessionId &&
      !globalSessionId;

    // ── Storico modifiche ──

    /** PIN richiesto per vedere storico modifiche turno */
    const pinRequiredForHistory = canTeamTimesheetOps && unlockWithPinEnabled;

    /** Storico sbloccato: può vedere le modifiche */
    const historyUnlocked =
      !pinRequiredForHistory ||
      historyUnlockedShiftId === s.id ||
      !!drawerSessionId ||
      !!globalSessionId;

    return {
      // Stato generale
      isFrozen,
      isApproved,
      isAbsent,
      isInPast,

      // Azioni principali
      canClose,
      canMarkAbsent,
      canFreeze,
      canUnlockFrozen,

      // Timbrature
      pinRequiredForTimbrature,
      timbratureEditorEligible,
      canTimbratureInsert,
      canTimbratureEdit,
      showTimbratureForm,
      timbraturePinGateActive,

      // Orari pianificati
      pinRequiredForPlannedTimes,
      showPlannedTimesEditor,
      showPlannedTimesPinButton,

      // Storico
      pinRequiredForHistory,
      historyUnlocked,
    };
  }, [
    s,
    fullShift,
    dateStr,
    todayStr,
    canTimesheetApprove,
    canTeamTimesheetOps,
    unlockWithPinEnabled,
    timbratureUnlockedShiftId,
    plannedTimesUnlockedShiftId,
    historyUnlockedShiftId,
    drawerSessionId,
    globalSessionId,
  ]);
}
