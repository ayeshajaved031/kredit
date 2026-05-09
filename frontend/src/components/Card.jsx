// ==============================================================
// Card + MetricCard
// --------------------------------------------------------------
// Card     — standard surface container. Most page content sits
//            inside one of these. variant 'promoted' gets the
//            subtle lime gradient (the "next payment" treatment).
//
// MetricCard — small KPI tile. Tiny uppercase label + big mono
//              number underneath. Used in 2-4 column grids.
// ==============================================================

export function Card({ children, className = "", variant = "default", ...rest }) {
  const base = "rounded-lg border border-divider";
  const styles = {
    default: "bg-surface",
    promoted: "card-promoted",
    bare: "bg-transparent",
  };
  return (
    <div className={`${base} ${styles[variant]} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className = "" }) {
  return (
    <div className={`flex items-start justify-between gap-4 px-5 pt-5 pb-3 ${className}`}>
      <div className="min-w-0">
        {subtitle && <p className="text-xs text-ink-muted mb-1">{subtitle}</p>}
        {title && <h3 className="text-h3 font-medium text-ink truncate">{title}</h3>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ children, className = "" }) {
  return <div className={`px-5 pb-5 ${className}`}>{children}</div>;
}

// ==============================================================
// MetricCard — KPI tile
// --------------------------------------------------------------
// label:   small uppercased label
// value:   big mono number / string
// accent:  'lime' | 'lavender' | 'default' (controls value color)
// hint:    optional small text below the value
// ==============================================================
export function MetricCard({ label, value, accent = "default", hint, className = "" }) {
  const accentColor = {
    lime: "text-lime",
    lavender: "text-lavender",
    default: "text-ink",
  }[accent];

  return (
    <div
      className={`bg-surface border border-divider rounded-md px-4 py-3.5 ${className}`}
    >
      <p className="text-[11px] text-ink-muted uppercase tracking-wider mb-1.5">
        {label}
      </p>
      <p className={`font-mono text-xl font-medium ${accentColor}`}>{value}</p>
      {hint && <p className="text-xs text-ink-muted mt-1">{hint}</p>}
    </div>
  );
}
