import type { CSSProperties } from 'react';

/** Icona app "OB" — quadrato verde accent (var(--brand)), lettere bianche più grandi */
export default function AppIcon({ className = 'w-12 h-12' }: { className?: string }) {
  const containerStyle: CSSProperties = { containerType: 'size' };
  return (
    <div
      aria-hidden
      style={containerStyle}
      className={`rounded-[22%] bg-accent shadow-sm flex items-center justify-center aspect-square box-border overflow-hidden text-white select-none font-sans font-bold ${className}`}
    >
      <span className="leading-none text-center block translate-y-px w-full [font-size:clamp(0.8rem,min(62cqi,58cqh),1.55rem)] [letter-spacing:0.08em]">
        OB
      </span>
    </div>
  );
}
