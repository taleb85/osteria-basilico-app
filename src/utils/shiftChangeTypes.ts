/**
 * Tipologie per cambiamento turni — Osteria Basilico
 *
 * Definisce le categorie di turno e le regole per il cambio delle 16:00.
 */

import type { ShiftType } from '../types';

/** Tipologie di turno (ShiftType) */
export const SHIFT_TYPES: Record<ShiftType, { label: string; labelEn: string; startBefore?: number }> = {
  lunch: {
    label: 'Pranzo',
    labelEn: 'Lunch',
    startBefore: 16, // turno diurno: inizia prima delle 16
  },
  dinner: {
    label: 'Cena',
    labelEn: 'Dinner',
    startBefore: undefined, // turno serale: inizia dalle 16 in poi
  },
};

/** Orari fine turno disponibili (cambio 16:00, pranzo, cena fino a 00:00) */
export const END_TIME_OPTIONS = [
  '16:00', // Cambio standard pranzo
  '16:30',
  '17:00',
  '17:30',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
  '21:00',
  '21:30',
  '22:00',
  '22:30',
  '23:00',
  '23:30',
  '00:00',
] as const;

/** Tipologie di cambio (transizione pranzo → cena) */
export type CambioType = 'standard' | 'esteso' | 'assente';

export const CAMBIO_TYPES: Record<CambioType, { label: string; endTime: string; description: string }> = {
  standard: {
    label: 'Cambio 16:00',
    endTime: '16:00',
    description: 'Fine turno pranzo alle 16:00 — cambio standard con turno cena',
  },
  esteso: {
    label: 'Pranzo esteso',
    endTime: '16:30', // o 17:00, 17:30
    description: 'Pranzo prolungato oltre le 16:00 — fine 16:30, 17:00 o 17:30',
  },
  assente: {
    label: 'Nessun cambio',
    endTime: '—',
    description: 'Giorno senza turno diurno — avviso se cena termina alle 16:00',
  },
};

/** Determina se un orario di fine è "cambio 16:00" (richiede turno diurno) */
export function isCambioAt16(endTime: string): boolean {
  const [h, m] = (endTime || '').split(':').map(Number);
  return h === 16 && (m ?? 0) === 0;
}

/** Determina se un turno è diurno (pranzo) in base all'orario di inizio */
export function isDayShift(startTime: string): boolean {
  const h = parseInt((startTime || '').split(':')[0] ?? '0', 10);
  return h < 16;
}
