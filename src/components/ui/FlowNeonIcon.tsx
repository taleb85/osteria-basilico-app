import { motion, type Transition } from 'framer-motion';

export interface FlowNeonIconProps {
  size?: number;
  progress?: number;
  transition?: Transition;
  idPrefix?: string;
}

const C0 = '#0033CC';  // blu navy — top-left icona
const C1 = '#0055FF';  // blu vivace — centro icona
const C2 = '#00DDFF';  // cyan brillante — bottom-right icona

export function FlowNeonIcon({
  size = 112,
  progress = 1,
  transition = { duration: 1.5, ease: 'easeOut' },
  idPrefix = 'fni',
}: FlowNeonIconProps) {
  const SW     = 1.5;  // tratto nitido
  const GAP    = 6;    // rientro del ring dal bordo icona
  const GLOW_GAP = 2;  // il layer glow è più vicino al bordo → glow si irradia verso l'esterno

  // Ring nitido (inset)
  const rX = GAP;
  const rY = GAP;
  const rW = size - 2 * GAP;
  const rH = rW;
  const rx = Math.max(4, size * 0.266 - GAP);

  // Layer glow più vicino al bordo → il blur si irradia verso il bordo dell'icona
  const gX = GLOW_GAP;
  const gY = GLOW_GAP;
  const gW = size - 2 * GLOW_GAP;
  const gH = gW;
  const grx = Math.max(4, size * 0.266 - GLOW_GAP);

  const sId  = `${idPrefix}-s`;
  const fId  = `${idPrefix}-glow`;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>

      {/* SVG sopra all'icona */}
      <svg
        aria-hidden
        style={{
          position: 'absolute', left: 0, top: 0,
          width: size, height: size,
          overflow: 'visible',
          zIndex: 5,
        }}
        viewBox={`0 0 ${size} ${size}`}
      >
        <defs>
          <linearGradient id={sId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={C0} />
            <stop offset="50%"  stopColor={C1} />
            <stop offset="100%" stopColor={C2} />
          </linearGradient>
          {/* Blur puro — il glow layer è già vicino al bordo, il blur si espande verso l'esterno */}
          <filter id={fId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" />
          </filter>
        </defs>

        {/* Layer glow: posizionato vicino al bordo, stroke largo + blur → luce verso esterno */}
        <motion.rect
          x={gX} y={gY} width={gW} height={gH} rx={grx} ry={grx}
          fill="none"
          stroke={`url(#${sId})`}
          strokeWidth={22}
          strokeOpacity={0.9}
          strokeLinecap="round"
          style={{ filter: `url(#${fId})` }}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: progress }}
          transition={transition}
        />

        {/* Ring nitido sopra il glow */}
        <motion.rect
          x={rX} y={rY} width={rW} height={rH} rx={rx} ry={rx}
          fill="none"
          stroke={`url(#${sId})`}
          strokeWidth={SW}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: progress }}
          transition={transition}
        />
      </svg>

      {/* Icona */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 20,
          borderRadius: `${(size * 0.266).toFixed(1)}px`,
          overflow: 'hidden',
        }}
      >
        <img
            src="/icon-flow-final.png"
          alt="FLOW"
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.6)' }}
        />
      </div>
    </div>
  );
}
