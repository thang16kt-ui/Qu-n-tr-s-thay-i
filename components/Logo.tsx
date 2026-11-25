/** Logo Mộc Coffee: hạt cà phê vân gỗ + mầm lá (tự thiết kế) */
export function LogoMark({ size = 40, light = false }: { size?: number; light?: boolean }) {
  const bean = light ? "#F7EBDD" : "#6B4226";
  const ring = light ? "#E2CDB4" : "#9A6A43";
  const crease = light ? "#6B4226" : "#F7EBDD";
  return (
    <svg width={size} height={size} viewBox="0 -4 120 124" aria-hidden>
      <g transform="rotate(-28 60 60)">
        <ellipse cx="60" cy="60" rx="35" ry="47" fill={bean} />
        <g fill="none" stroke={ring} strokeWidth="2.6">
          <ellipse cx="55" cy="62" rx="26" ry="37" />
          <ellipse cx="51" cy="64" rx="17" ry="26" />
          <ellipse cx="48" cy="66" rx="8.5" ry="14" />
        </g>
        <path d="M61 18 C 44 40, 80 80, 60 102" fill="none" stroke={crease} strokeWidth="6" strokeLinecap="round" />
      </g>
      <path d="M41 15 C 46 4, 58 0, 68 3 C 62 13, 50 17, 41 15 Z" fill="#7C9A5B" />
      <path d="M41 15 C 50 10, 58 6, 68 3" fill="none" stroke="#5E7A42" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ size = 40, withText = false, light = false }: { size?: number; withText?: boolean; light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <LogoMark size={size} light={light} />
      {withText && (
        <div className="leading-none">
          <div className={`text-[1.35rem] font-bold tracking-tight ${light ? "text-cream" : "text-bean-dark"}`}>Mộc</div>
          <div className={`mt-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.32em] ${light ? "text-cream/70" : "text-latte"}`}>Coffee</div>
        </div>
      )}
    </div>
  );
}
