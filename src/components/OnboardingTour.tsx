import { useState, useEffect, useCallback } from 'react';

interface TourStep {
  target: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="nav"]',
    title: 'Navigazione',
    description: 'Usa la barra in basso per navigare tra le sezioni',
    position: 'top',
  },
  {
    target: '[data-tour="punch"]',
    title: 'Timbratura',
    description: 'Timbra entrata e uscita da qui',
    position: 'top',
  },
  {
    target: '[data-tour="profile"]',
    title: 'Profilo',
    description: 'Gestisci le tue informazioni personali',
    position: 'top',
  },
];

export function OnboardingTour({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const updateRect = useCallback(() => {
    const current = TOUR_STEPS[step];
    if (!current) return;
    const el = document.querySelector(current.target);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setTargetRect(new DOMRect(24, window.innerHeight * 0.35, 280, 56));
    }
  }, [step]);

  useEffect(() => {
    updateRect();
  }, [updateRect]);

  useEffect(() => {
    const onResize = () => updateRect();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateRect]);

  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  if (!current) return null;

  if (!targetRect) return null;

  const tooltipTop = Math.min(
    targetRect.bottom + 16,
    window.innerHeight - 200
  );

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 600 }}
      role="dialog"
      aria-label="Tour guidato"
      aria-modal="true"
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />

      <div
        style={{
          position: 'absolute',
          top: targetRect.top - 8,
          left: targetRect.left - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16,
          borderRadius: 12,
          boxShadow: '0 0 0 4px #ffa800, 0 0 0 9999px rgba(0,0,0,0.6)',
          zIndex: 601,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: tooltipTop,
          left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 300)),
          width: 280,
          background: '#1a2744',
          border: '1px solid rgba(255,168,0,0.3)',
          borderRadius: 12,
          padding: '16px',
          zIndex: 602,
          color: '#fff',
        }}
      >
        <p style={{ fontWeight: 700, marginBottom: 8 }}>{current.title}</p>
        <p style={{ fontSize: 14, color: '#8a9bb5', marginBottom: 16 }}>{current.description}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#8a9bb5' }}>
            {step + 1} / {TOUR_STEPS.length}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Indietro
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? onComplete() : setStep((s) => s + 1))}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                background: '#ffa800',
                border: 'none',
                color: '#1a2744',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isLast ? 'Fine' : 'Avanti'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
