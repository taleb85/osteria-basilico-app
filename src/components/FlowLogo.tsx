/**
 * FlowLogo — logo SVG "F stilizzata + FLOW" del brand FLOW.
 *
 * La F è composta da:
 *  • Una barra verticale arrotondata (pilastro sinistro)
 *  • Una barra superiore piena (Blu Elettrico #0052FF)
 *  • Una barra mediana più corta (Ciano #00D1FF) che si assottiglia
 *    verso destra, suggerendo il "flow"/movimento
 *
 * Props:
 *  - size       → altezza del logo in px (default 32)
 *  - showText   → se true mostra "FLOW" e sottotitolo accanto (default true)
 *  - subtitle   → testo sotto "FLOW" (default "Work in Motion")
 *  - className  → className extra
 */
interface FlowLogoProps {
  size?: number;
  showText?: boolean;
  subtitle?: string | false;
  className?: string;
  /**
   * 'blue'  → F in #0052FF, wordmark dark/light via Tailwind (default — su sfondi chiari)
   * 'white' → tutto bianco (su sfondi blu scuro, es. onboarding)
   */
  colorScheme?: 'blue' | 'white';
}

export default function FlowLogo({
  size = 32,
  showText = true,
  subtitle = 'Work in Motion',
  className = '',
  colorScheme = 'blue',
}: FlowLogoProps) {
  const isWhite = colorScheme === 'white';
  const fColor      = isWhite ? '#FFFFFF' : '#0052FF';
  const lowColor    = isWhite ? '#FFFFFF' : undefined; // undefined → usa Tailwind class
  const subColor    = isWhite ? 'rgba(255,255,255,0.55)' : undefined;
  const dotColor    = isWhite ? 'rgba(255,255,255,0.8)' : '#00D1FF';
  // Mark SVG scale factor (mark always at 32px native, scale to `size`)
  const markSize = size;

  return (
    <div className={`flex items-center gap-2 leading-none select-none ${className}`}>
      {/* ── SVG Mark ───────────────────────────────────────────────── */}
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
        style={{ flexShrink: 0 }}
      >
        <defs>
          {/* Cyan gradient for mid bar: fades toward the trailing end */}
          <linearGradient id={`fl-cyan-${isWhite ? 'w' : 'b'}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={isWhite ? '#FFFFFF' : '#00D1FF'} stopOpacity="1"/>
            <stop offset="80%"  stopColor={isWhite ? '#FFFFFF' : '#00D1FF'} stopOpacity="0.85"/>
            <stop offset="100%" stopColor={isWhite ? '#FFFFFF' : '#00D1FF'} stopOpacity={isWhite ? 0.55 : 0.45}/>
          </linearGradient>
          {/* Soft glow behind cyan bar */}
          <filter id="fl-glow" x="-30%" y="-80%" width="160%" height="260%">
            <feGaussianBlur stdDeviation="1.2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Slight italic lean for the whole mark */}
        <g transform="skewX(-4)">

          {/* PILLAR — vertical bar, rounded caps */}
          <rect x="6" y="5" width="7" height="30" rx="3.5" fill={fColor}/>

          {/* TOP BAR — full-width stroke, right end fully rounded */}
          <rect x="6" y="5" width="28" height="10" rx="5" fill={fColor}/>

          {/* MID BAR — shorter, Cyan accent, flows/tapers to the right */}
          <rect
            x="6" y="20" width="21" height="9" rx="4.5"
            fill={`url(#fl-cyan-${isWhite ? 'w' : 'b'})`}
            filter="url(#fl-glow)"
          />

          {/* Motion dot — trailing point at the end of the mid bar */}
          <circle cx="28.5" cy="24.5" r="2.2" fill={dotColor} opacity="0.55"/>
          <circle cx="32"   cy="24.5" r="1.2" fill={dotColor} opacity="0.28"/>
        </g>
      </svg>

      {/* ── Wordmark + subtitle ─────────────────────────────────────── */}
      {showText && (
        <div className="flex flex-col leading-none">
          {/* FLOW wordmark */}
          <span
            style={{
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              fontSize: size * 0.72,
              fontWeight: 800,
              letterSpacing: '-0.045em',
              lineHeight: 1,
            }}
          >
            <span style={{ color: fColor }}>F</span>
            <span
              style={{ color: lowColor }}
              className={lowColor ? undefined : 'text-slate-800 dark:text-neutral-100'}
            >
              LOW
            </span>
            <span
              style={{
                display: 'inline-block',
                width: size * 0.16,
                height: size * 0.16,
                borderRadius: '50%',
                background: dotColor,
                marginLeft: size * 0.06,
                marginBottom: size * 0.06,
                verticalAlign: 'baseline',
              }}
            />
          </span>

          {/* Subtitle */}
          {subtitle && (
            <span
              style={{
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                fontSize: size * 0.22,
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: subColor,
                marginTop: size * 0.07,
              }}
              className={subColor ? undefined : 'text-slate-400 dark:text-neutral-500'}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * FlowMarkOnly — solo l'icona SVG (senza testo), usato nelle icone e favicon.
 * Comodo per <img> placeholders o badge piccoli.
 */
export function FlowMarkOnly({ size = 24, className = '' }: { size?: number; className?: string }) {
  return <FlowLogo size={size} showText={false} className={className} />;
}
