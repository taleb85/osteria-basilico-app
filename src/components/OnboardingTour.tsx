import { useState, useEffect, useCallback, useMemo } from 'react';

interface TourStep {
  target: string;
  title: string;
  description: string;
}

const BASE_STEPS: TourStep[] = [
  {
    target: '[data-tour="nav"]',
    title: 'Navigazione',
    description: 'Usa le tab in alto per navigare tra le sezioni',
  },
  {
    target: '[data-tour="punch"]',
    title: 'Timbratura',
    description: 'Timbra la tua entrata e uscita da qui',
  },
  {
    target: '[data-tour="profile"]',
    title: 'Profilo',
    description: 'Gestisci le tue informazioni personali',
  },
];

const MANAGER_STEPS: TourStep[] = [
  {
    target: '[data-tour="shifts"]',
    title: 'Turni',
    description: 'Pianifica e gestisci i turni del tuo team',
  },
  {
    target: '[data-tour="stats"]',
    title: 'Statistiche',
    description: 'Monitora presenze e ore lavorate',
  },
];

function buildSteps(includeManager: boolean): TourStep[] {
  return includeManager ? [...BASE_STEPS, ...MANAGER_STEPS] : [...BASE_STEPS];
}

export function OnboardingTour({
  onComplete,
  includeManagerSteps = false,
}: {
  onComplete: () => void;
  includeManagerSteps?: boolean;
}) {
  const steps = useMemo(() => buildSteps(includeManagerSteps), [includeManagerSteps]);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const updateRect = useCallback(() => {
    const current = steps[step];
    if (!current) return;
    const el = document.querySelector(current.target);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setTargetRect(new DOMRect(24, window.innerHeight * 0.35, 280, 56));
    }
  }, [step, steps]);

  useEffect(() => {
    updateRect();
  }, [updateRect]);

  useEffect(() => {
    const onResize = () => updateRect();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateRect]);

  const current = steps[step];
  const isLast = step === steps.length - 1;

  if (!current) return null;

  if (!targetRect) return null;

  const tooltipHeight = 160;
  const tooltipWidth = 280;
  const margin = 16;

  const spaceBelow = window.innerHeight - targetRect.bottom;
  const spaceAbove = targetRect.top;
  const showBelow = spaceBelow >= tooltipHeight + margin || spaceBelow >= spaceAbove;

  const idealLeft = targetRect.left;
  const maxLeft = window.innerWidth - tooltipWidth - margin;
  const tooltipLeft = Math.max(margin, Math.min(idealLeft, maxLeft));

  const rawTop = showBelow
    ? targetRect.bottom + margin
    : targetRect.top - tooltipHeight - margin;
  const tooltipTop = Math.max(
    margin,
    Math.min(rawTop, window.innerHeight - tooltipHeight - margin),
  );

  const pad = 8;
  const { top, left, bottom, right, width, height } = targetRect;
  const holeTop = top - pad;
  const holeLeft = left - pad;
  const holeBot = bottom + pad;
  const holeRight = right + pad;
  const holeW = width + pad * 2;
  const holeH = height + pad * 2;
  const midH = Math.max(0, holeBot - holeTop);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 600 }}
      role="dialog"
      aria-label="Tour guidato"
      aria-modal="true"
    >
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: Math.max(0, holeTop),
          background: 'rgba(0,0,0,0.6)',
          zIndex: 600,
          pointerEvents: 'auto',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: holeBot,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 600,
          pointerEvents: 'auto',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: holeTop,
          left: 0,
          width: Math.max(0, holeLeft),
          height: midH,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 600,
          pointerEvents: 'auto',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: holeTop,
          left: holeRight,
          right: 0,
          height: midH,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 600,
          pointerEvents: 'auto',
        }}
      />

      <div
        style={{
          position: 'fixed',
          top: holeTop,
          left: holeLeft,
          width: holeW,
          height: holeH,
          border: '2px solid #ffa800',
          borderRadius: 12,
          zIndex: 601,
          pointerEvents: 'none',
          boxSizing: 'border-box',
        }}
      />

      <div
        style={{
          position: 'fixed',
          top: tooltipTop,
          left: tooltipLeft,
          width: tooltipWidth,
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
            {step + 1} / {steps.length}
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
