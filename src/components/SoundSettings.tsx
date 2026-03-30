import { Volume2, VolumeX } from 'lucide-react';
import { useMultisensorialFeedback } from '../hooks/useMultisensorialFeedback';

interface SoundSettingsProps {
  compact?: boolean;
}

/**
 * Componente per controllare le impostazioni audio/vibrazione nel profilo.
 */
export function SoundSettings({ compact = false }: SoundSettingsProps) {
  const { isSoundEnabled, setIsSoundEnabled, soundVolume, setSoundVolume, triggerFeedback } =
    useMultisensorialFeedback();

  const handleSoundToggle = () => {
    setIsSoundEnabled(!isSoundEnabled);
    // Feedback: vibrazione al toggle
    triggerFeedback(isSoundEnabled ? 'warning' : 'success', false);
  };

  const handleVolumeChange = (newVolume: number) => {
    setSoundVolume(newVolume);
    // Prova il suono al cambio volume
    triggerFeedback('success', true);
  };

  if (compact) {
    return (
      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-neutral-700 dark:bg-neutral-900/50">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-neutral-300">
            {isSoundEnabled ? (
              <Volume2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-400 dark:text-neutral-600" />
            )}
            Suoni & Vibrazioni
          </span>
          <button
            type="button"
            onClick={handleSoundToggle}
            className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
              isSoundEnabled
                ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-950/40 dark:text-green-300'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-neutral-800 dark:text-neutral-400'
            }`}
          >
            {isSoundEnabled ? 'Attivo' : 'Muto'}
          </button>
        </div>

        {isSoundEnabled && (
          <div>
            <label className="text-[11px] font-semibold text-slate-600 dark:text-neutral-400">
              Volume: {soundVolume}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="10"
              value={soundVolume}
              onChange={(e) => handleVolumeChange(parseInt(e.target.value, 10))}
              className="mt-1 w-full"
            />
          </div>
        )}
      </div>
    );
  }

  // Versione full (expanded)
  return (
    <div className="space-y-3 rounded-lg border-2 border-green-300 bg-green-50 p-4 dark:border-green-700/50 dark:bg-green-950/30">
      <h3 className="flex items-center gap-2 text-sm font-bold text-green-900 dark:text-green-200">
        <Volume2 className="h-5 w-5" />
        Suoni & Vibrazioni
      </h3>

      {/* Toggle Suoni */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-green-900 dark:text-green-100">
            Abilita Notifiche Audio
          </p>
          <p className="text-xs text-green-700 dark:text-green-300">
            Ping quando arrivano nuovi messaggi
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isSoundEnabled}
            onChange={handleSoundToggle}
            className="h-5 w-5 rounded"
          />
          <span className="text-sm font-semibold text-green-900 dark:text-green-100">
            {isSoundEnabled ? 'Attivo' : 'Disattivo'}
          </span>
        </label>
      </div>

      {/* Volume Control */}
      {isSoundEnabled && (
        <div className="space-y-2 rounded bg-white/50 p-3 dark:bg-neutral-900/50">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-green-900 dark:text-green-200">
              Volume Notifiche
            </label>
            <span className="text-sm font-bold text-green-700 dark:text-green-300 tabular-nums">
              {soundVolume}%
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            step="10"
            value={soundVolume}
            onChange={(e) => handleVolumeChange(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-green-200 dark:bg-green-800 rounded-lg appearance-none cursor-pointer"
          />

          <p className="text-xs text-green-700 dark:text-green-400">
            {soundVolume === 0 ? '🔇 Muto' : soundVolume <= 33 ? '🔉 Basso' : soundVolume <= 66 ? '🔊 Medio' : '🔉 Alto'}
          </p>
        </div>
      )}

      {/* Vibrazione Info */}
      <div className="flex items-start gap-2 rounded bg-white/50 p-3 dark:bg-neutral-900/50 text-xs text-green-700 dark:text-green-300">
        <span className="mt-0.5">📳</span>
        <p>
          Le vibrazioni tattili vengono attivate automaticamente su dispositivi compatibili quando ricevi notifiche push.
        </p>
      </div>

      {/* Test Button */}
      <button
        type="button"
        onClick={() => triggerFeedback('success', true)}
        className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
      >
        🔊 Prova Suono & Vibrazione
      </button>
    </div>
  );
}
