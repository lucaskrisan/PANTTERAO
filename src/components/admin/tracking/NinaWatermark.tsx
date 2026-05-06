/**
 * Nina Tracking™ — selo de marca discreto.
 * Aparece no canto inferior direito de cards premium.
 */
const NinaWatermark = ({ className = "" }: { className?: string }) => (
  <span
    className={`pointer-events-none absolute bottom-1.5 right-2 text-[9px] font-medium tracking-wider opacity-30 select-none ${className}`}
    style={{
      background: "linear-gradient(135deg, #14B8A6 0%, #D4AF37 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    }}
    aria-hidden="true"
  >
    nina ✦
  </span>
);

export default NinaWatermark;
