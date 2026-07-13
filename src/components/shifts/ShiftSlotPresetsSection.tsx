import { useMemo, useState } from 'react';
import { TimeInputField } from '../ui/TimeInputField';
import { useT } from '../../hooks/useT';
import {
  getShiftSlotFromStartTime,
  loadShiftSlotPresets,
  saveShiftSlotPresets,
  type ShiftTimePreset,
} from '../../utils/shiftSlotPresets';

type Props = {
  startTime: string;
  endTime: string;
  onApply: (start: string, end: string) => void;
};

export function ShiftSlotPresetsSection({ startTime, endTime, onApply }: Props) {
  const t = useT();
  const tv = t as Record<string, string>;
  const [editMode, setEditMode] = useState(false);
  const [revision, setRevision] = useState(0);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const slot = getShiftSlotFromStartTime(startTime);
  const presets = useMemo(() => loadShiftSlotPresets(slot), [slot, revision]);

  const persist = (next: ShiftTimePreset[]) => {
    saveShiftSlotPresets(slot, next);
    setRevision((n) => n + 1);
  };

  const slotLabel =
    slot === 'lunch'
      ? (tv.wst_preset_lunch ?? 'Preset pranzo')
      : (tv.wst_preset_dinner ?? 'Preset cena');

  const addPreset = () => {
    const start = newStart.trim().slice(0, 5);
    const end = newEnd.trim().slice(0, 5);
    if (!start || !end) return;
    persist([...presets, { start, end }]);
    setNewStart('');
    setNewEnd('');
  };

  const removePreset = (index: number) => {
    persist(presets.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">{slotLabel}</p>
        <button
          type="button"
          onClick={() => {
            setEditMode((v) => !v);
            setNewStart('');
            setNewEnd('');
          }}
          className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
            editMode
              ? 'bg-accent/20 text-accent'
              : 'bg-white/10 text-white/60 hover:text-white'
          }`}
        >
          {editMode ? (tv.done ?? 'Fatto') : (tv.edit ?? 'Modifica')}
        </button>
      </div>

      {editMode ? (
        <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-2">
          {presets.length === 0 ? (
            <p className="py-1 text-center text-[10px] text-white/40">
              {tv.no_presets ?? 'Nessun orario salvato'}
            </p>
          ) : (
            presets.map(({ start, end }, i) => (
              <div key={`${start}-${end}-${i}`} className="flex items-center gap-1.5">
                <span className="flex-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold tabular-nums text-white">
                  {start}–{end}
                </span>
                <button
                  type="button"
                  onClick={() => removePreset(i)}
                  aria-label={tv.delete ?? 'Elimina'}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-[11px] font-bold text-red-300 hover:bg-red-500/25"
                >
                  ✕
                </button>
              </div>
            ))
          )}
          <div className="border-t border-white/10 pt-2">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
              {tv.add_preset ?? 'Aggiungi orario'}
            </p>
            <div className="mb-2 flex items-center gap-1.5">
              <TimeInputField
                value={newStart}
                onChange={setNewStart}
                size="md"
                className="min-w-0 flex-1 border-white/20 bg-white/10"
              />
              <span className="text-[11px] text-white/40">–</span>
              <TimeInputField
                value={newEnd}
                onChange={setNewEnd}
                size="md"
                className="min-w-0 flex-1 border-white/20 bg-white/10"
              />
            </div>
            <button
              type="button"
              onClick={addPreset}
              disabled={!newStart.trim() || !newEnd.trim()}
              className="w-full rounded-lg bg-accent/20 py-1.5 text-[11px] font-bold text-accent transition-colors hover:bg-accent/30 disabled:opacity-40"
            >
              + {tv.add ?? 'Aggiungi'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {presets.map(({ start, end }, i) => {
            const isActive = selectedIdx === i;
            return (
              <button
                key={`${start}-${end}-${i}`}
                type="button"
                onClick={() => {
                  setSelectedIdx(i);
                  onApply(start, end);
                }}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold tabular-nums transition-all duration-200 border ${
                  isActive
                    ? 'border-[3px] border-white bg-white/15 text-white shadow-[0_0_8px_#fff]'
                    : 'border-transparent bg-white/15 text-white hover:bg-white/20'
                }`}
              >
                {start}–{end}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
