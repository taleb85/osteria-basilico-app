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
      {/* Icona PNG ufficiale FLOW */}
      {showIcon && (
        <img
          src="/icon-flow-final.png"
          alt="FLOW"
          width={size}
          height={size}
          draggable={false}
          style={{ width: size, height: size, borderRadius: size * 0.22, flexShrink: 0, objectFit: 'cover' }}
        />
      )}

      {/* Wordmark + subtitle opzionali */}
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            style={{
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              fontSize: size * 0.72,
              fontWeight: 800,
              letterSpacing: '-0.045em',
              lineHeight: 1,
              ...(isWhite
                ? { color: '#FFFFFF' }
                  : { color: '#0052FF' }),
            }}
          >
            FLOW
          </span>
          {subtitle && (
            <span
              style={{
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                fontSize: size * 0.22,
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginTop: size * 0.07,
                ...(isWhite
                  ? { color: 'rgba(255,255,255,0.55)' }
                  : { color: '#64748b' }),
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
