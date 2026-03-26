/**
 * Legacy (`users.enabled_features`): nascondeva tutti gli orari in griglia.
 * Trattato come `planned_only` per compatibilità dati esistenti.
 */
export const TIMESHEET_GRID_SHIFT_TIMES_FEATURE_KEY = 'timesheet_show_shift_times_in_grid';

/**
 * Admin: in griglia Presenze mostra orario pianificato per turni pubblicati/confermati e,
 * se congelati, le ore approvate ufficiali (non timbrature grezze); nasconde delta,
 * totali da timbrature, badge audit (il drawer resta completo).
 */
export const TIMESHEET_GRID_PLANNED_ONLY_KEY = 'timesheet_presences_grid_planned_only';

export type TimesheetGridPrivacyMode = 'full' | 'planned_only';

export function getTimesheetGridPrivacyMode(
  user: { enabled_features?: unknown } | null | undefined
): TimesheetGridPrivacyMode {
  if (!user) return 'full';
  const fe = user.enabled_features as Record<string, unknown> | undefined;
  if (fe?.[TIMESHEET_GRID_PLANNED_ONLY_KEY] === true) return 'planned_only';
  if (fe?.[TIMESHEET_GRID_SHIFT_TIMES_FEATURE_KEY] === false) return 'planned_only';
  return 'full';
}
