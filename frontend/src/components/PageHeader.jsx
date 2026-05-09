// ==============================================================
// PageHeader
// --------------------------------------------------------------
// Used at the top of every authenticated page. Wraps the title +
// optional subtitle + optional right-side actions in a consistent
// layout that handles wrapping on narrow viewports.
// ==============================================================

export default function PageHeader({ eyebrow, title, subtitle, actions, className = "" }) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 mb-6 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs text-ink-muted mb-1">{eyebrow}</p>
        )}
        <h1 className="text-h1 font-medium tracking-tight text-ink truncate">{title}</h1>
        {subtitle && (
          <p className="text-sm text-ink-muted mt-1.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
