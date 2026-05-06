/**
 * DeepAuroraShell — Sottile profondità per lo sfondo.
 */
export default function DeepAuroraShell() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
      {/* Glow bianco in alto */}
      <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-[24rem] w-[32rem] rounded-full bg-white/[0.03] blur-[120px]" />
      {/* Glow ambra caldo al centro */}
      <div className="pointer-events-none absolute bottom-1/3 right-1/4 h-[16rem] w-[20rem] rounded-full bg-amber-500/[0.03] blur-[100px]" />
    </div>
  );
}
