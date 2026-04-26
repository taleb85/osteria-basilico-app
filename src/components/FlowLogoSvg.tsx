import { useId, type CSSProperties } from 'react';

const COLORS = {
  orange: { primary: '#FF9500', secondary: '#2A1E15', bg: '#1A263E' },
  teal: { primary: '#00CED1', secondary: '#002B2B', bg: '#001A1A' },
  purple: { primary: '#BF40BF', secondary: '#2E0854', bg: '#120224' },
  green: { primary: '#32CD32', secondary: '#003300', bg: '#001A00' },
} as const;

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

/**
 * Wordmark FLOW in SVG. Barre 1 e 3: gradiente LTR (accordo → scuro); barra 2: inverso (scuro → accento), come brand.
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
  const gradLtr = `${rawId}-flow-grad-ltr`;
  const gradMid = `${rawId}-flow-grad-mid`;
  const selected = COLORS[color] ?? COLORS.orange;
  const wordDark = wordmark === 'onLight';
  const flowFill = wordDark ? '#1A263E' : '#FFFFFF';
  const subFill = wordDark ? 'rgba(26, 38, 62, 0.8)' : '#FFFFFF';

  const BarsInIcon = () => (
    <>
      <rect x="45" y="65" width="110" height="16" rx="8" fill={`url(#${gradLtr})`} />
      <rect x="45" y="92" width="85" height="16" rx="8" fill={`url(#${gradMid})`} />
      <rect x="45" y="119" width="110" height="16" rx="8" fill={`url(#${gradLtr})`} />
    </>
  );

  /** LTR = accento → scuro; MID = inverso (scuro → accento) per la barra centrale. */
  const Defs = () => (
    <defs>
      <linearGradient
        id={gradLtr}
        x1="45"
        y1="0%"
        x2="155"
        y2="0%"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor={selected.primary} />
        <stop offset="80%" stopColor={selected.secondary} />
      </linearGradient>
      <linearGradient
        id={gradMid}
        x1="45"
        y1="0%"
        x2="155"
        y2="0%"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor={selected.secondary} />
        <stop offset="80%" stopColor={selected.primary} />
      </linearGradient>
    </defs>
  );

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
        <rect width="200" height="200" rx="45" fill={selected.bg} />
        <Defs />
        <BarsInIcon />
      </svg>
    );
  }

  /** Header orizzontale 300×60: icona 60 + wordmark (gradient `userSpace` 0–60 come l’asset). */
  if (variant === 'header') {
    const gradHeaderLtr = `${rawId}-grad-h-ltr`;
    const gradHeaderMid = `${rawId}-grad-h-mid`;
    const headerTextFill = wordDark ? '#1A263E' : '#FFFFFF';
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
        <defs>
          <linearGradient
            id={gradHeaderLtr}
            x1="0"
            y1="0"
            x2="60"
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={selected.primary} />
            <stop offset="80%" stopColor={selected.secondary} />
          </linearGradient>
          <linearGradient
            id={gradHeaderMid}
            x1="0"
            y1="0"
            x2="60"
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={selected.secondary} />
            <stop offset="80%" stopColor={selected.primary} />
          </linearGradient>
        </defs>
        <rect width="60" height="60" rx="15" fill={selected.bg} />
        <rect x="15" y="20" width="30" height="4" rx="2" fill={`url(#${gradHeaderLtr})`} />
        <rect x="15" y="28" width="22" height="4" rx="2" fill={`url(#${gradHeaderMid})`} />
        <rect x="15" y="36" width="30" height="4" rx="2" fill={`url(#${gradHeaderLtr})`} />
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
        <div className={`inline-flex max-w-full rounded-[10px] bg-[#1A263E] px-3 py-1.5 ${className}`.trim()}>
          {svg}
        </div>
      );
    }
    return svg;
  }

  // full: viewBox 0 0 200 280 — come asset (testo bianco sotto; su sfondo chiaro usare wordmark="onLight")
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
      <Defs />
      <rect width="200" height="200" rx="45" fill={selected.bg} />
      <BarsInIcon />
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
