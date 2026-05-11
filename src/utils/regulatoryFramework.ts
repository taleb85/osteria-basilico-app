/**
 * Regulatory framework — compliance rules per country/region.
 *
 * Instead of hardcoding Italian CCNL rules, each tenant can configure
 * a regulatory framework that adapts work rules, overtime, breaks,
 * holiday accrual, and minimum wage to the local legislation.
 */

export type RegulatoryFramework =
  | 'it_ccnl_ristorazione'
  | 'it_ccnl_commercio'
  | 'eu_generic'
  | 'uk_generic'
  | 'us_generic'
  | 'custom';

export interface RegulatoryConfig {
  /** Paese/regulatory framework ID */
  framework: RegulatoryFramework;
  /** Label visualizzata nelle impostazioni */
  label: string;
  /** Valuta predefinita (EUR, GBP, USD, CHF, …) */
  currency: string;
  /** Ore massime per giorno */
  maxDailyHours: number;
  /** Ore massime per settimana */
  maxWeeklyHours: number;
  /** Minimo riposo tra turni (minuti) */
  minRestBetweenShifts: number;
  /** Giorni consecutivi massimi */
  maxConsecutiveDays: number;
  /** Soglia straordinario (ore/settimana) */
  overtimeThreshold: number;
  /** Moltiplicatore straordinario */
  overtimeMultiplier: number;
  /** Ore notturne: inizio (es. 22) */
  nightWorkStart: number;
  /** Ore notturne: fine (es. 6) */
  nightWorkEnd: number;
  /** Maggiorazione notturna (%) */
  nightPremiumPercent: number;
  /** Festivo: moltiplicatore */
  holidayPremiumMultiplier: number;
  /** Pausa obbligatoria ogni N ore */
  breakAfterHours: number;
  /** Durata minima pausa (minuti) */
  breakDurationMinutes: number;
}

export const REGULATORY_FRAMEWORKS: Record<RegulatoryFramework, RegulatoryConfig> = {
  it_ccnl_ristorazione: {
    framework: 'it_ccnl_ristorazione',
    label: 'Italia — CCNL Ristorazione',
    currency: 'EUR',
    maxDailyHours: 9,
    maxWeeklyHours: 48,
    minRestBetweenShifts: 660, // 11 ore
    maxConsecutiveDays: 6,
    overtimeThreshold: 40,
    overtimeMultiplier: 1.25,
    nightWorkStart: 22,
    nightWorkEnd: 6,
    nightPremiumPercent: 30,
    holidayPremiumMultiplier: 1.40,
    breakAfterHours: 6,
    breakDurationMinutes: 30,
  },
  it_ccnl_commercio: {
    framework: 'it_ccnl_commercio',
    label: 'Italia — CCNL Commercio',
    currency: 'EUR',
    maxDailyHours: 8,
    maxWeeklyHours: 40,
    minRestBetweenShifts: 660,
    maxConsecutiveDays: 6,
    overtimeThreshold: 40,
    overtimeMultiplier: 1.15,
    nightWorkStart: 22,
    nightWorkEnd: 6,
    nightPremiumPercent: 20,
    holidayPremiumMultiplier: 1.30,
    breakAfterHours: 6,
    breakDurationMinutes: 15,
  },
  eu_generic: {
    framework: 'eu_generic',
    label: 'European Union — Generic',
    currency: 'EUR',
    maxDailyHours: 10,
    maxWeeklyHours: 48,
    minRestBetweenShifts: 660,
    maxConsecutiveDays: 7,
    overtimeThreshold: 40,
    overtimeMultiplier: 1.25,
    nightWorkStart: 23,
    nightWorkEnd: 6,
    nightPremiumPercent: 25,
    holidayPremiumMultiplier: 1.25,
    breakAfterHours: 6,
    breakDurationMinutes: 30,
  },
  uk_generic: {
    framework: 'uk_generic',
    label: 'United Kingdom — Generic',
    currency: 'GBP',
    maxDailyHours: 10,
    maxWeeklyHours: 48,
    minRestBetweenShifts: 660,
    maxConsecutiveDays: 7,
    overtimeThreshold: 40,
    overtimeMultiplier: 1.25,
    nightWorkStart: 23,
    nightWorkEnd: 6,
    nightPremiumPercent: 20,
    holidayPremiumMultiplier: 1.25,
    breakAfterHours: 6,
    breakDurationMinutes: 20,
  },
  us_generic: {
    framework: 'us_generic',
    label: 'United States — Generic',
    currency: 'USD',
    maxDailyHours: 12,
    maxWeeklyHours: 60,
    minRestBetweenShifts: 480,
    maxConsecutiveDays: 7,
    overtimeThreshold: 40,
    overtimeMultiplier: 1.50,
    nightWorkStart: 0,
    nightWorkEnd: 0,
    nightPremiumPercent: 0,
    holidayPremiumMultiplier: 1.50,
    breakAfterHours: 5,
    breakDurationMinutes: 30,
  },
  custom: {
    framework: 'custom',
    label: 'Custom — Configurable',
    currency: 'EUR',
    maxDailyHours: 10,
    maxWeeklyHours: 48,
    minRestBetweenShifts: 660,
    maxConsecutiveDays: 7,
    overtimeThreshold: 40,
    overtimeMultiplier: 1.25,
    nightWorkStart: 22,
    nightWorkEnd: 6,
    nightPremiumPercent: 25,
    holidayPremiumMultiplier: 1.25,
    breakAfterHours: 6,
    breakDurationMinutes: 30,
  },
};

export function getRegulatoryConfig(framework: RegulatoryFramework): RegulatoryConfig {
  return REGULATORY_FRAMEWORKS[framework] ?? REGULATORY_FRAMEWORKS.eu_generic;
}

export function getDefaultWorkRulesFromFramework(framework: RegulatoryFramework) {
  const cfg = getRegulatoryConfig(framework);
  return {
    maxDailyHours: cfg.maxDailyHours,
    maxWeeklyHours: cfg.maxWeeklyHours,
    minRestBetweenShifts: cfg.minRestBetweenShifts,
    maxConsecutiveDays: cfg.maxConsecutiveDays,
    overtimeThreshold: cfg.overtimeThreshold,
    overtimeEnabled: true,
    nightWorkStart: String(cfg.nightWorkStart).padStart(2, '0') + ':00',
    nightWorkEnd: String(cfg.nightWorkEnd).padStart(2, '0') + ':00',
  };
}

export function getDefaultBreakRulesFromFramework(framework: RegulatoryFramework) {
  const cfg = getRegulatoryConfig(framework);
  return [
    {
      id: 'regulatory_auto_break',
      label: 'Auto break',
      minWorkDuration: cfg.breakAfterHours * 60,
      breakDuration: cfg.breakDurationMinutes,
      appliesToDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    },
  ];
}
