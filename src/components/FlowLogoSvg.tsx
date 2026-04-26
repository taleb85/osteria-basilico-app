import { useId } from 'react';

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
}

/**
 * Wordmark FLOW in SVG (barre + testo), varianti colore. Distinto da {@link FlowLogo} (PNG ufficiale in app).
 */
export default function FlowLogoSvg({ variant = 'full', color = 'orange', className = '' }: FlowLogoSvgProps) {
  const rawId = useId().replace(/:/g, '');
  const gradId = `${rawId}-flow-grad`;
  const selected = COLORS[color] ?? COLORS.orange;

  const IconBars = () => (
    <>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={selected.primary} />
          <stop offset="80%" stopColor={selected.secondary} />
        </linearGradient>
      </defs>
      <rect x="50" y="70" width="100" height="15" rx="7.5" fill={`url(#${gradId})`} />
      <rect x="50" y="95" width="75" height="15" rx="7.5" fill={`url(#${gradId})`} />
      <rect x="50" y="120" width="100" height="15" rx="7.5" fill={`url(#${gradId})`} />
    </>
  );

  if (variant === 'icon-only') {
    return (
      <svg viewBox="0 0 200 200" className={className} fill="none" aria-hidden>
        <rect width="200" height="200" rx="45" fill={selected.bg} />
        <IconBars />
      </svg>
    );
  }

  if (variant === 'header') {
    return (
      <div className={`flex items-center gap-4 ${className}`}>
        <svg viewBox="0 0 200 200" className="h-10 w-10 shrink-0" fill="none" aria-hidden>
          <rect width="200" height="200" rx="45" fill={selected.bg} />
          <IconBars />
        </svg>
        <span className="text-2xl font-bold tracking-widest text-white">FLOW</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg viewBox="0 0 200 200" className="mb-4 h-32 w-32" fill="none" aria-hidden>
        <rect width="200" height="200" rx="45" fill={selected.bg} />
        <IconBars />
      </svg>
      <h1 className="text-3xl font-bold tracking-[0.2em] text-white">FLOW</h1>
      <p className="mt-2 text-xs tracking-[0.3em] text-white/70">WORK IN MOTION</p>
    </div>
  );
}
