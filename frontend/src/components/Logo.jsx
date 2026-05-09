// ==============================================================
// Logo
// --------------------------------------------------------------
// The "K" tile in lime + Kredit wordmark. Used on landing,
// auth pages, and as the dashboard top-nav logo.
//
// size: 'sm' (24px tile) | 'md' (28px) | 'lg' (32px)
// showWord: include the wordmark text alongside the mark
// ==============================================================

const SIZE = {
  sm: { tile: 24, font: 12, gap: 8, word: "text-sm" },
  md: { tile: 28, font: 14, gap: 10, word: "text-base" },
  lg: { tile: 32, font: 16, gap: 10, word: "text-lg" },
};

export default function Logo({ size = "md", showWord = true, className = "" }) {
  const cfg = SIZE[size] || SIZE.md;
  return (
    <div className={`flex items-center ${className}`} style={{ gap: cfg.gap }}>
      <div
        className="rounded-md bg-lime text-bg font-mono font-semibold flex items-center justify-center"
        style={{ width: cfg.tile, height: cfg.tile, fontSize: cfg.font }}
        aria-hidden="true"
      >
        K
      </div>
      {showWord && (
        <span className={`${cfg.word} font-medium tracking-tight text-ink`}>Kredit</span>
      )}
    </div>
  );
}
