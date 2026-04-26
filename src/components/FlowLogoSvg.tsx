import { useId } from 'react';

const COLORS = {
  orange: { primary: '#FF9500', secondary: '#2A1E15', bg: '#1A263E' },
  teal: { primary: '#00CED1', secondary: '#002B2B', bg: '#001A1A' },
  purple: { primary: '#BF40BF', secondary: '#2E0854', bg: '#120224' },
  green: { primary: '#32CD32', secondary: '#003300', bg: '#001A00' },
} as const;

/** Sfondo icona nella variante header (es. striscia blu) — come nel mockup HTML. */
const HEADER_ICON_BG = '#25334d';

export type FlowLogoSvgColor = keyof typeof COLORS;
export type FlowLogoSvgVariant = 'full' | 'icon-only' | 'header';

export interface FlowLogoSvgProps {
  variant?: FlowLogoSvgVariant;
  color?: FlowLogoSvgColor;
  className?: string;
  /**
   * Solo `full`: colore testo FLOW / sottotitolo sotto l’icona
   * (`onLight` = scuro su sfondo chiaro dietro l’SVG, come nel campione).
   */
  wordmark?: 'onLight' | 'onDark';
  /** Rendi il wrapper `header` con sfondo scuro e testo bianco (come blocco “header” del mockup). */
  headerBar?: boolean;
}

/**
 * Wordmark FLOW in SVG (barre + testo), varianti colore. Distinto da {@link FlowLogo} (PNG ufficiale in app).
 */
export default function FlowLogoSvg({
  variant = 'full',
  color = 'orange',
  className = '',
  wordmark = 'onLight',
  headerBar = false,
}: FlowLogoSvgProps) {
  const rawId = useId().replace(/:/g, '');
  const gradId = `${rawId}-flow-grad`;
  const selected = COLORS[color] ?? COLORS.orange;
  const wordDark = wordmark === 'onLight';
  const flowFill = wordDark ? '#1A263E' : '#FFFFFF';
  const subFill = wordDark ? 'rgba(26, 38, 62, 0.7)' : 'rgba(255, 255, 255, 0.7)';

  const BarsInIcon = () => (
    <>
      <rect x="45" y="65" width="110" height="16" rx="8" fill={`url(#${gradId})`} />
      <rect x="45" y="92" width="85" height="16" rx="8" fill={`url(#${gradId})`} />
      <rect x="45" y="119" width="110" height="16" rx="8" fill={`url(#${gradId})`} />
    </>
  );

  const Defs = () => (
    <defs>
      <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor={selected.primary} />
        <stop offset="80%" stopColor={selected.secondary} />
      </linearGradient>
    </defs>
  );

  if (variant === 'icon-only') {
    return (
      <svg viewBox="0 0 200 200" className={className} fill="none" role="img" aria-label="FLOW">
        <title>FLOW</title>
        <Defs />
        <rect width="200" height="200" rx="45" fill={selected.bg} />
        <BarsInIcon />
      </svg>
    );
  }

  if (variant === 'header') {
    const wrap = `flex items-center gap-4 ${headerBar ? 'rounded-[10px] bg-[#1A263E] px-6 py-3' : ''} ${className}`.trim();
    return (
      <div className={wrap}>
        <svg
          viewBox="0 0 200 200"
          className="h-10 w-10 shrink-0"
          width={50}
          height={50}
          fill="none"
          role="img"
          aria-hidden
        >
          <Defs />
          <rect width="200" height="200" rx="45" fill={HEADER_ICON_BG} />
          <BarsInIcon />
        </svg>
        <span className="text-2xl font-bold tracking-[0.2em] text-white" style={{ fontFamily: 'system-ui, Arial, sans-serif' }}>
          FLOW
        </span>
      </div>
    );
  }

  // full: viewBox 0 0 200 280 — icona 200×200 + testi nel SVG
  return (
    <svg
      viewBox="0 0 200 280"
      className={className}
      fill="none"
      role="img"
      aria-labelledby={`${rawId}-title`}
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      <title id={`${rawId}-title`}>FLOW — Work in Motion</title>
      <Defs />
      <rect width="200" height="200" rx="45" fill={selected.bg} />
      <BarsInIcon />
      <text
        x="100"
        y="245"
        fill={flowFill}
        fontFamily="system-ui, -apple-system, Arial, sans-serif"
        fontWeight="bold"
        fontSize="32"
        textAnchor="middle"
        letterSpacing="4px"
      >
        FLOW
      </text>
      <text
        x="100"
        y="270"
        fill={subFill}
        fontFamily="system-ui, -apple-system, Arial, sans-serif"
        fontSize="11"
        textAnchor="middle"
        letterSpacing="3px"
        opacity={wordDark ? 1 : 0.85}
      >
        WORK IN MOTION
      </text>
    </svg>
  );
}
