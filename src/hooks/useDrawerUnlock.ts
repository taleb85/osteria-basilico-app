import { useState, useCallback } from 'react';

/**
 * Scope di sblocco per le diverse sezioni del drawer turno.
 * - timbrature: modifica orari entrata/uscita
 * - planned: modifica orari pianificati (turni confirmed)
 * - history: visualizzazione storico modifiche e audit timbrature
 */
export type UnlockScope = 'timbrature' | 'planned' | 'history';

/**
 * Stato di unlock per un singolo shift: quali scope sono sbloccati.
 */
type ShiftUnlockState = Set<UnlockScope>;

/**
 * Hook unificato per gestire gli sblocchi PIN delle diverse sezioni del drawer.
 * 
 * Sostituisce i precedenti stati separati:
 * - timbratureEditUnlockedShiftId
 * - plannedTimesEditUnlockedShiftId
 * - shiftEditsUnlockedShiftId
 * - timbratureEditUnlockedSessionId (deprecato: ora usa drawerSessionId)
 * 
 * @returns {Object} API per gestire gli unlock
 */
export function useDrawerUnlock() {
  // Map<shiftId, Set<scope>>: quali scope sono sbloccati per ogni shift
  const [unlockedShifts, setUnlockedShifts] = useState<Map<string, ShiftUnlockState>>(new Map());
  
  // Session ID globale drawer: una volta inserito PIN, vale per tutte le operazioni nel drawer corrente
  const [drawerSessionId, setDrawerSessionId] = useState<string | null>(null);

  /**
   * Verifica se uno scope è sbloccato per un dato shift.
   * Considera sia l'unlock specifico dello shift che la sessione globale drawer.
   */
  const isUnlocked = useCallback(
    (shiftId: string, scope: UnlockScope, globalSessionId?: string | null): boolean => {
      // Sessione globale PIN (da AppContext): bypass completo
      if (globalSessionId) return true;
      
      // Sessione drawer: vale per tutte le operazioni finché il drawer è aperto
      if (drawerSessionId) return true;
      
      // Verifica unlock specifico per questo shift + scope
      const shiftScopes = unlockedShifts.get(shiftId);
      return shiftScopes?.has(scope) ?? false;
    },
    [unlockedShifts, drawerSessionId]
  );

  /**
   * Sblocca uno scope specifico per un shift (dopo verifica PIN).
   */
  const unlock = useCallback((shiftId: string, scope: UnlockScope) => {
    setUnlockedShifts((prev) => {
      const next = new Map(prev);
      const existing = next.get(shiftId) || new Set<UnlockScope>();
      existing.add(scope);
      next.set(shiftId, existing);
      return next;
    });
  }, []);

  /**
   * Sblocca la sessione drawer globale (dopo verifica PIN).
   * Una volta sbloccata, tutte le operazioni nel drawer corrente sono permesse.
   */
  const unlockDrawerSession = useCallback((sessionId: string) => {
    setDrawerSessionId(sessionId);
  }, []);

  /**
   * Rimuove unlock per uno shift specifico.
   */
  const lock = useCallback((shiftId: string) => {
    setUnlockedShifts((prev) => {
      const next = new Map(prev);
      next.delete(shiftId);
      return next;
    });
  }, []);

  /**
   * Chiude la sessione drawer: richiederà PIN alla prossima operazione protetta.
   */
  const lockDrawerSession = useCallback(() => {
    setDrawerSessionId(null);
  }, []);

  /**
   * Reset completo (chiusura drawer).
   */
  const resetAll = useCallback(() => {
    setUnlockedShifts(new Map());
    setDrawerSessionId(null);
  }, []);

  return {
    isUnlocked,
    unlock,
    unlockDrawerSession,
    lock,
    lockDrawerSession,
    resetAll,
    drawerSessionId,
  };
}
