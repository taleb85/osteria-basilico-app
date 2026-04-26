import { useId, type CSSProperties } from 'react';

/**
 * Palette brand. `bg` = navy quasi nero dello squircle; `bgGloss` = chiarore in alto;
 * `hi` = picco giallo/secondario per i segmenti "accesi" del logo.
 */
const COLORS = {
  orange: {
    primary: '#FF9500',
    secondary: '#2A1E15',
    bg: '#0A1020',
    bgGloss: '#121a34',
    bgDeep: '#040810',
    hi: '#FFCC00',
  },
  teal: {
    primary: '#00CED1',
    secondary: '#002B2B',
    bg: '#001A1A',
    bgGloss: '#0a2a2c',
    bgDeep: '#000808',
    hi: '#66F0F0',
  },
  purple: {
    primary: '#BF40BF',
    secondary: '#2E0854',
    bg: '#120224',
    bgGloss: '#1a0a32',
    bgDeep: '#080218',
    hi: '#E8A0FF',
  },
  green: {
    primary: '#32CD32',
    secondary: '#003300',
    bg: '#001A00',
    bgGloss: '#0a280a',
    bgDeep: '#000800',
    hi: '#9FFF9F',
  },
} as const;

type Theme = (typeof COLORS)['orange'];

export type FlowLogoSvgColor = keyof typeof COLORS;
export type FlowLogoSvgVariant = 'full' | 'icon-only' | 'header';

export interface FlowLogoSvgProps {
  variant?: FlowLogoSvgVariant;
  color?: FlowLogoSvgColor;
  className?: string;
  style?: CSSProperties;
  /**
   * `full`: sotto l’icona. `header`: testo "FLOW" a destra. Default `onDark` (bianco);
   * `onLight` = testo scuro.
   */
  wordmark?: 'onLight' | 'onDark';
  /** Opzionale: contenitore attorno al logo header inline (es. striscia barra). */
  headerBar?: boolean;
}

/** Icona 200×200: squircle con gloss + tre pill orizzontali (segmenti luminosi scartati, come app icon design). */
function Icon200DefsAndBars({ gid, t }: { gid: string; t: Theme }) {
  return (
    <>
      <defs>
        <linearGradient
          id={`${gid}-face`}
          x1="0"
          y1="0"
          x2="0"
          y2="200"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={t.bgGloss} />
          <stop offset="42%" stopColor={t.bg} />
          <stop offset="100%" stopColor={t.bgDeep} />
        </linearGradient>
        {/*
          Tre tracciati uguali (x, w, h, rx). Il segmento "acceso" differisce solo nel gradiente:
          - top: glow a sinistra ~60% poi dissolvenza nel navy
          - mid: segmento centrale (dark | glow | dark)
          - bottom: glow a sinistra ~40% poi dissolvenza
        */}
        <linearGradient
          id={`${gid}-b-top`}
          x1="36"
          y1="0"
          x2="164"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={t.hi} />
          <stop offset="28%" stopColor={t.primary} />
          <stop offset="52%" stopColor={t.primary} />
          <stop offset="62%" stopColor={t.secondary} />
          <stop offset="72%" stopColor={t.bg} stopOpacity="0.92" />
          <stop offset="100%" stopColor={t.bg} />
        </linearGradient>
        <linearGradient
          id={`${gid}-b-mid`}
          x1="36"
          y1="0"
          x2="164"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={t.bg} />
          <stop offset="10%" stopColor={t.bg} />
          <stop offset="16%" stopColor={t.secondary} stopOpacity="0.85" />
          <stop offset="24%" stopColor={t.primary} />
          <stop offset="50%" stopColor={t.hi} />
          <stop offset="76%" stopColor={t.primary} />
          <stop offset="84%" stopColor={t.secondary} stopOpacity="0.9" />
          <stop offset="92%" stopColor={t.bg} />
          <stop offset="100%" stopColor={t.bg} />
        </linearGradient>
        <linearGradient
          id={`${gid}-b-bot`}
          x1="36"
          y1="0"
          x2="164"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={t.hi} />
          <stop offset="22%" stopColor={t.primary} />
          <stop offset="40%" stopColor={t.primary} />
          <stop offset="48%" stopColor={t.secondary} />
          <stop offset="58%" stopColor={t.bg} stopOpacity="0.9" />
          <stop offset="100%" stopColor={t.bg} />
        </linearGradient>
      </defs>
      <rect width="200" height="200" rx="44" fill={`url(#${gid}-face)`} />
      <rect x="36" y="61" width="128" height="15" rx="7.5" fill={`url(#${gid}-b-top)`} />
      <rect x="36" y="93" width="128" height="15" rx="7.5" fill={`url(#${gid}-b-mid)`} />
      <rect x="36" y="125" width="128" height="15" rx="7.5" fill={`url(#${gid}-b-bot)`} />
    </>
  );
}

/**
 * Wordmark FLOW in SVG. Icona: tre barre a pillola con segmenti luminosi scartati (stile app reference).
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
  const t = (COLORS[color] ?? COLORS.orange) as Theme;
  const wordDark = wordmark === 'onLight';
  const flowFill = wordDark ? '#0A1020' : '#FFFFFF';
  const subFill = wordDark ? 'rgba(10, 16, 32, 0.8)' : '#FFFFFF';
  const gid = `${rawId}-mark`;

  if (variant === 'icon-only') {
    return (
      <svg
        width={200}
        height={200}
        viewBox="0 0 200 200"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="FLOW"
        style={{ maxWidth: '100%', height: 'auto', ...style }}
      >
        <title>FLOW</title>
        <Icon200DefsAndBars gid={gid} t={t} />
      </svg>
    );
  }

  if (variant === 'header') {
    const headerTextFill = wordDark ? '#0A1020' : '#FFFFFF';
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
        <svg
          x="0"
          y="0"
          width="60"
          height="60"
          viewBox="0 0 200 200"
          role="presentation"
        >
          <Icon200DefsAndBars gid={`${gid}-h`} t={t} />
        </svg>
        <text
          x="80"
          y="40"
          fill={headerTextFill}
          fontFamily="Arial, sans-serif"
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
        <div className={`inline-flex max-w-full rounded-[10px] bg-[#0A1020] px-3 py-1.5 ${className}`.trim()}>
          {svg}
        </div>
      );
    }
    return svg;
  }

  return (
    <svg
      width={200}
      height={280}
      viewBox="0 0 200 280"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-labelledby={`${rawId}-title`}
      style={{ maxWidth: '100%', height: 'auto', ...style }}
    >
      <title id={`${rawId}-title`}>FLOW — Work in Motion</title>
      <g>
        <Icon200DefsAndBars gid={gid} t={t} />
      </g>
      <text
        x="100"
        y="240"
        fill={flowFill}
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fontSize="28"
        textAnchor="middle"
        letterSpacing="4"
      >
        FLOW
      </text>
      <text
        x="100"
        y="265"
        fill={subFill}
        fontFamily="Arial, sans-serif"
        fontSize="10"
        textAnchor="middle"
        letterSpacing="2"
        opacity={wordDark ? 1 : 0.8}
      >
        WORK IN MOTION
      </text>
    </svg>
  );
}
