import { Volume2, VolumeX, Smartphone, BellRing } from 'lucide-react';
import { useMultisensorialFeedback } from '../hooks/useMultisensorialFeedback';

interface SoundSettingsProps {
  compact?: boolean;
}

/**
 * Componente per gestire le impostazioni di suono e vibrazione.
 * Da inserire nella scheda Profilo.
 */
export function SoundSettings({ compact = false }: SoundSettingsProps) {
  const { 
    isSoundEnabled, 
    setIsSoundEnabled, 
    soundVolume, 
    setSoundVolume,
    hapticIntensity,
    setHapticIntensity,
    triggerFeedback 
  } = useMultisensorialFeedback();

  const handleToggleSound = () => {
    const next = !isSoundEnabled;
    setIsSoundEnabled(next);
    if (next) {
      // Piccolo feedback per confermare l'attivazione
      triggerFeedback('click', true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSoundVolume(parseInt(e.target.value, 10));
  };

  const handleTestSound = () => {
    triggerFeedback('success', true);
  };

  if (compact) {
    return (
      <button
        onClick={handleToggleSound}
        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
          isSoundEnabled 
            ? 'bg-accent/10 text-accent' 
            : 'bg-slate-100 text-white/50'
        }`}
        title={isSoundEnabled ? 'Muta suoni' : 'Attiva suoni'}
      >
        {isSoundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
    );
  }

  return (
    <div className="space-y-4 rounded-3xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <BellRing size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-tight">
            Notifiche e Feedback
          </h3>
          <p className="text-[10px] font-medium text-white/60 uppercase tracking-wider">
            Personalizza suoni e vibrazioni
          </p>
        </div>
      </div>

      <div className="space-y-5 pt-2">
        {/* Toggle Suono */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isSoundEnabled ? 'bg-brand-50 text-brand-600' : 'bg-slate-50 text-white/50'}`}>
              {isSoundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </div>
            <span className="text-xs font-bold text-white/80">Suoni Notifica</span>
          </div>
          <button
            onClick={handleToggleSound}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              isSoundEnabled ? 'bg-accent' : 'bg-slate-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isSoundEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Slider Volume */}
        {isSoundEnabled && (
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Volume</span>
              <span className="text-[10px] font-black text-accent">{soundVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={soundVolume}
              onChange={handleVolumeChange}
              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-accent"
            />
          </div>
        )}

        {/* Info Vibrazione */}
        <div className="flex flex-col gap-2 border-t border-slate-50 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10 text-accent">
                <Smartphone size={16} />
              </div>
              <span className="text-xs font-bold text-white/80">Feedback Aptico</span>
            </div>
            <span className="text-[10px] font-black text-accent uppercase tracking-widest">{hapticIntensity}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="25"
            value={hapticIntensity}
            onChange={(e) => setHapticIntensity(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-accent"
          />
        </div>

        {/* Tasto Test */}
        <button
          onClick={handleTestSound}
          className="w-full py-3 rounded-2xl bg-[#001A80]/8 text-[10px] font-black text-[#001A80] uppercase tracking-[0.2em] hover:bg-[#001A80]/15 transition-colors border border-[#001A80]/20"
        >
          Prova Feedback
        </button>
      </div>
    </div>
  );
}
