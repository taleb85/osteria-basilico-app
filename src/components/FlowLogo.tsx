/**
 * FlowLogo — logo ufficiale FLOW (immagine PNG).
 * Sostituisce il precedente SVG con la nuova icona brand rosa/viola/blu.
 */
interface FlowLogoProps {
  size?: number;
  showText?: boolean;
  showIcon?: boolean;
  subtitle?: string | false;
  className?: string;
  colorScheme?: 'blue' | 'white';
}

export default function FlowLogo({
  size = 32,
  showText = true,
  showIcon = true,
  subtitle = 'Work in Motion',
  className = '',
  colorScheme = 'blue',
}: FlowLogoProps) {
  const isWhite = colorScheme === 'white';

  return (
    <div className={`flex items-center gap-2.5 leading-none select-none ${className}`}>
      {/* Icona PNG ufficiale FLOW — Smart Pair container */}
      {showIcon && (
        <div
          style={{
            background: '#0f2a4a',
            border: '1px solid rgba(34, 211, 238, 0.3)',
            boxShadow: '0 0 20px rgba(34, 211, 238, 0.15)',
            borderRadius: size * 0.22,
            width: size,
            height: size,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <img
            src="/icon-flow-final.png"
            alt="FLOW"
            width={size - 4}
            height={size - 4}
            draggable={false}
            style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) * 0.18, objectFit: 'cover' }}
          />
        </div>
      )}

      {/* Wordmark + subtitle opzionali */}
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            style={{
              fontFamily: '\'Outfit\', \'Inter\', system-ui, -apple-system, sans-serif',
              fontSize: size * 0.72,
              fontWeight: 600,
              letterSpacing: '-0.045em',
              lineHeight: 1,
              ...(isWhite
                ? { color: '#FFFFFF' }
                : { color: '#22d3ee' }),
            }}
          >
            FLOW
          </span>
          {subtitle && (
            <span
              style={{
                fontFamily: '\'Outfit\', \'Inter\', system-ui, -apple-system, sans-serif',
                fontSize: size * 0.22,
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginTop: size * 0.07,
                ...(isWhite
                  ? { color: 'rgba(255,255,255,0.55)' }
                  : { color: 'rgba(34, 211, 238, 0.6)' }),
              }}
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
 * FlowMarkOnly — solo l'icona (senza testo), per badge e favicon in-app.
 */
export function FlowMarkOnly({ size = 24, className = '' }: { size?: number; className?: string }) {
  return <FlowLogo size={size} showText={false} className={className} />;
}
