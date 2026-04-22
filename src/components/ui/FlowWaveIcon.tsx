import type React from 'react';

/**
 * FlowWaveIcon — logo onda FLOW usato ovunque nell'app.
 * Stessa forma del pulsante brand nella TopBar, scalabile.
 */
interface FlowWaveIconProps {
  /** Dimensione totale del quadrato contenitore (default 48) */
  size?: number;
  /** Raggio bordi (default size * 0.27) */
  radius?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function FlowWaveIcon({ size = 48, radius, className, style }: FlowWaveIconProps) {
  const r = radius ?? Math.round(size * 0.27);
  const iconSize = Math.round(size * 0.60);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        flexShrink: 0,
        background: 'rgba(26, 86, 219, 0.40)',
        border: '1px solid rgba(59, 130, 246, 0.50)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#22d3ee"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: iconSize, height: iconSize }}
        aria-hidden
      >
        <path d="M3 12l4-4 4 4 4-4 4 4" />
      </svg>
    </div>
  );
}
