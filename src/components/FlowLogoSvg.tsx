import { useId, type CSSProperties } from 'react';

/**
 * Sistema a traccia + riempimento come flow-brand-assets.html:
 * stessa faccia blu 145° per tutte le varianti; cambiano i gradienti delle barre.
 */
const TRACK = '#3a2e35';

const APP = {
  W: 160,
  trackW: 118,
  trackH: 22,
  gap: 10,
  wTop: 86,
  wMid: 118,
  wBot: 60,
} as const;

const FULL_CARD = { W: 195, H: 235, faceRx: 34 } as const;
const FULL = { trackW: 135, trackH: 23, gap: 9, wTop: 100, wMid: 135, wBot: 70 } as const;

type BarGrads = { fill0: string; fill1: string; fill2: string; mid0: string; mid1: string; mid2: string };

const BAR_GRADIENTS: Record<string, BarGrads> = {
  orange: {
    fill0: '#ffcc00',
    fill1: '#ff9900',
    fill2: '#e07800',
    mid0: '#ffd700',
    mid1: '#ffaa00',
    mid2: '#e08800',
  },
  teal: {
    fill0: '#5dcaa5',
    fill1: '#2a9d72',
    fill2: '#0f6e56',
    mid0: '#9fe1cb',
    mid1: '#4fb892',
    mid2: '#1d9e75',
  },
  purple: {
    fill0: '#afa9ec',
    fill1: '#7a72c8',
    fill2: '#534ab7',
    mid0: '#cecbf6',
    mid1: '#a8a0e8',
    mid2: '#7f77dd',
  },
  green: {
    fill0: '#97c459',
    fill1: '#6a9a28',
    fill2: '#3b6d11',
    mid0: '#c0dd97',
    mid1: '#9bc84a',
    mid2: '#639922',
  },
} as const;

export type FlowLogoSvgColor = keyof typeof BAR_GRADIENTS;
export type FlowLogoSvgVariant = 'full' | 'icon-only' | 'header';

export interface FlowLogoSvgProps {
  variant?: FlowLogoSvgVariant;
  color?: FlowLogoSvgColor;
  className?: string;
  style?: CSSProperties;
  wordmark?: 'onLight' | 'onDark';
  headerBar?: boolean;
}

function BarFillOnlyDefs({ gid, b }: { gid: string; b: BarGrads }) {
  return (
    <defs>
      <linearGradient id={`${gid}-f`} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
        <stop offset="0%" stopColor={b.fill0} />
        <stop offset="60%" stopColor={b.fill1} />
        <stop offset="100%" stopColor={b.fill2} />
      </linearGradient>
      <linearGradient id={`${gid}-fm`} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
        <stop offset="0%" stopColor={b.mid0} />
        <stop offset="60%" stopColor={b.mid1} />
        <stop offset="100%" stopColor={b.mid2} />
      </linearGradient>
    </defs>
  );
}

/** Faccia rettangolare (quadrata o per card) + clip arrotondato + gloss superiore. */
function IconFaceGlossWithClip({
  gid,
  width,
  height,
  rx,
}: {
  gid: string;
  width: number;
  height: number;
  rx: number;
}) {
  return (
    <defs>
      <linearGradient id={`${gid}-face`} x1="0" y1="0" x2={String(width)} y2={String(height)} gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#253660" />
        <stop offset="40%" stopColor="#1a2744" />
        <stop offset="100%" stopColor="#111c36" />
      </linearGradient>
      <linearGradient id={`${gid}-gloss`} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
      </linearGradient>
      <clipPath id={`${gid}-clip`}>
        <rect width={width} height={height} rx={rx} />
      </clipPath>
    </defs>
  );
}

/** 160×160 — HTML “Icon Applications / App Icon (Large)”. */
function IconApp160({ gid, color }: { gid: string; color: FlowLogoSvgColor }) {
  const b = BAR_GRADIENTS[color] ?? BAR_GRADIENTS.orange;
  const th = APP.trackH;
  const r = th / 2;
  const tx = (APP.W - APP.trackW) / 2;
  const hBlock = 3 * th + 2 * APP.gap;
  const y0 = (APP.W - hBlock) / 2;
  const y1 = y0;
  const y2 = y0 + th + APP.gap;
  const y3 = y0 + 2 * (th + APP.gap);
  return (
    <>
      <IconFaceGlossWithClip gid={gid} width={160} height={160} rx={28} />
      <BarFillOnlyDefs gid={gid} b={b} />
      <g clipPath={`url(#${gid}-clip)`}>
        <rect width="160" height="160" rx="28" fill={`url(#${gid}-face)`} />
        <rect x="0" y="0" width="160" height="85" fill={`url(#${gid}-gloss)`} />
        <g>
          <rect x={tx} y={y1} width={APP.trackW} height={th} rx={r} fill={TRACK} />
          <rect x={tx} y={y1} width={APP.wTop} height={th} rx={r} fill={`url(#${gid}-f)`} />
          <rect x={tx} y={y2} width={APP.trackW} height={th} rx={r} fill={TRACK} />
          <rect x={tx} y={y2} width={APP.wMid} height={th} rx={r} fill={`url(#${gid}-fm)`} />
          <rect x={tx} y={y3} width={APP.trackW} height={th} rx={r} fill={TRACK} />
          <rect x={tx} y={y3} width={APP.wBot} height={th} rx={r} fill={`url(#${gid}-f)`} />
        </g>
      </g>
    </>
  );
}

/**
 * Full logo 195×235 — HTML “Full Logo (Print & Web Header)”.
 * Barre: 100 / 135 / 70 su traccia 135; testo sotto in SVG.
 */
function IconFull195({
  gid,
  color,
  wordmark,
}: {
  gid: string;
  color: FlowLogoSvgColor;
  wordmark: 'onLight' | 'onDark';
}) {
  const b = BAR_GRADIENTS[color] ?? BAR_GRADIENTS.orange;
  const w = FULL_CARD.W;
  const h = FULL_CARD.H;
  const th = FULL.trackH;
  const r = th / 2;
  const tx = (w - FULL.trackW) / 2;
  const hBars = 3 * th + 2 * FULL.gap;
  const y0 = 36;
  const y1 = y0;
  const y2 = y0 + th + FULL.gap;
  const y3 = y0 + 2 * (th + FULL.gap);
  const barBottom = y3 + th;
  const tFlow = wordmark === 'onLight' ? '#1a2744' : '#ffffff';
  const tSub = wordmark === 'onLight' ? 'rgba(26, 39, 68, 0.8)' : '#7a8fad';
  const yFlow = barBottom + 16 + 28;

  return (
    <>
      <IconFaceGlossWithClip gid={gid} width={w} height={h} rx={FULL_CARD.faceRx} />
      <BarFillOnlyDefs gid={gid} b={b} />
      <g clipPath={`url(#${gid}-clip)`}>
        <rect width={w} height={h} rx={FULL_CARD.faceRx} fill={`url(#${gid}-face)`} />
        <rect x="0" y="0" width={w} height={h * 0.48} fill={`url(#${gid}-gloss)`} />
        <g>
          <rect x={tx} y={y1} width={FULL.trackW} height={th} rx={r} fill={TRACK} />
          <rect x={tx} y={y1} width={FULL.wTop} height={th} rx={r} fill={`url(#${gid}-f)`} />
          <rect x={tx} y={y2} width={FULL.trackW} height={th} rx={r} fill={TRACK} />
          <rect x={tx} y={y2} width={FULL.wMid} height={th} rx={r} fill={`url(#${gid}-fm)`} />
          <rect x={tx} y={y3} width={FULL.trackW} height={th} rx={r} fill={TRACK} />
          <rect x={tx} y={y3} width={FULL.wBot} height={th} rx={r} fill={`url(#${gid}-f)`} />
        </g>
        <text
          x={w / 2}
          y={yFlow}
          textAnchor="middle"
          fill={tFlow}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="32"
          letterSpacing="4"
        >
          FLOW
        </text>
        <text
          x={w / 2}
          y={yFlow + 6 + 12}
          textAnchor="middle"
          fill={tSub}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="12"
          fontWeight="600"
          letterSpacing="3"
        >
          <tspan x={w / 2}>WORK IN</tspan>
          <tspan x={w / 2} dy="1.15em">
            MOTION
          </tspan>
        </text>
      </g>
    </>
  );
}

/**
 * Wordmark SVG — struttura brand da flow-brand-assets.html
 */
export default function FlowLogoSvg({
  variant = 'full',
  color = 'orange',
  className = '',
  style,
  wordmark = 'onDark',
  headerBar = false,
}: FlowLogoSvgProps) {
  const rawId = useId().replace(/:/g, '');
  const c = (color in BAR_GRADIENTS ? color : 'orange') as FlowLogoSvgColor;
  const gid = `${rawId}-mark`;
  const gidH = `${rawId}-mh`;

  if (variant === 'icon-only') {
    return (
      <svg
        width={160}
        height={160}
        viewBox="0 0 160 160"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="FLOW"
        style={{ maxWidth: '100%', height: 'auto', ...style }}
      >
        <title>FLOW</title>
        <IconApp160 gid={gid} color={c} />
      </svg>
    );
  }

  if (variant === 'header') {
    const headerTextFill = wordmark === 'onLight' ? '#1a2744' : '#FFFFFF';
    const svg = (
      <svg
        width={300}
        height={60}
        viewBox="0 0 300 60"
        className={headerBar ? undefined : className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="FLOW"
        style={{ maxWidth: '100%', height: 'auto', ...style }}
      >
        <title>FLOW</title>
        <svg x="0" y="0" width="60" height="60" viewBox="0 0 160 160" role="presentation">
          <IconApp160 gid={gidH} color={c} />
        </svg>
        <text
          x="80"
          y="40"
          fill={headerTextFill}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="bold"
          fontSize="24"
          letterSpacing="2"
        >
          FLOW
        </text>
      </svg>
    );
    if (headerBar) {
      return (
        <div className={`inline-flex max-w-full rounded-[10px] bg-[#1a2744] px-3 py-1.5 ${className}`.trim()}>
          {svg}
        </div>
      );
    }
    return svg;
  }

  return (
    <svg
      width={FULL_CARD.W}
      height={FULL_CARD.H}
      viewBox={`0 0 ${FULL_CARD.W} ${FULL_CARD.H}`}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-labelledby={`${rawId}-title`}
      style={{ maxWidth: '100%', height: 'auto', ...style }}
    >
      <title id={`${rawId}-title`}>FLOW — Work in Motion</title>
      <IconFull195 gid={gid} color={c} wordmark={wordmark} />
    </svg>
  );
}
