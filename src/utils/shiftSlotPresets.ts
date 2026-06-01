export type ShiftTimePreset = { start: string; end: string };
export type ShiftSlot = 'lunch' | 'evening';

export const DEFAULT_LUNCH_PRESETS: ShiftTimePreset[] = [
  { start: '09:00', end: '14:00' },
  { start: '10:00', end: '15:00' },
  { start: '10:00', end: '16:00' },
  { start: '11:00', end: '16:00' },
  { start: '12:00', end: '16:00' },
];

export const DEFAULT_EVENING_PRESETS: ShiftTimePreset[] = [
  { start: '16:00', end: '22:00' },
  { start: '16:00', end: '23:00' },
  { start: '18:00', end: '23:00' },
  { start: '18:00', end: '00:00' },
  { start: '19:00', end: '01:00' },
];

const STORAGE_PREFIX = 'flow_slot_presets_';

export function loadShiftSlotPresets(slot: ShiftSlot): ShiftTimePreset[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${slot}`);
    if (raw) return JSON.parse(raw) as ShiftTimePreset[];
  } catch {
    /* ignore */
  }
  return slot === 'lunch' ? DEFAULT_LUNCH_PRESETS : DEFAULT_EVENING_PRESETS;
}

export function saveShiftSlotPresets(slot: ShiftSlot, presets: ShiftTimePreset[]): void {
  localStorage.setItem(`${STORAGE_PREFIX}${slot}`, JSON.stringify(presets));
}

export function getShiftSlotFromStartTime(startTime: string): ShiftSlot {
  const hour = parseInt(startTime.slice(0, 5).split(':')[0], 10);
  return Number.isFinite(hour) && hour >= 16 ? 'evening' : 'lunch';
}

export function getShiftTypeFromStartTime(startTime: string): 'lunch' | 'dinner' {
  const hour = parseInt(startTime.slice(0, 5).split(':')[0], 10);
  return Number.isFinite(hour) && hour >= 17 ? 'dinner' : 'lunch';
}
