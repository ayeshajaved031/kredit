// ==============================================================
// Badge
// --------------------------------------------------------------
// Small status pill. Two style modes:
//
//   tone='lime'      → translucent lime fill, lime text
//   tone='lavender'  → translucent lavender fill, lavender text
//   tone='danger'    → translucent red fill, red text
//   tone='warn'      → translucent amber fill
//   tone='success'   → translucent green fill
//   tone='neutral'   → divider-tone fill, muted text
//
// mono — render in JetBrains Mono uppercase (the "DUE IN 3 DAYS"
//        style from the mockups). Use for system/state pills.
// ==============================================================

const TONES = {
  lime: "bg-lime-glow text-lime",
  lavender: "bg-lavender-glow text-lavender",
  danger: "bg-danger-soft text-danger",
  warn: "bg-amber-500/15 text-amber-400",
  success: "bg-emerald-500/15 text-emerald-400",
  neutral: "bg-divider/60 text-ink-muted",
};

export default function Badge({
  children,
  tone = "neutral",
  mono = false,
  className = "",
}) {
  return (
    <span
      className={`
        inline-flex items-center
        px-2.5 py-1
        text-xs font-medium
        rounded-full
        whitespace-nowrap
        ${mono ? "font-mono text-[11px] uppercase tracking-wider" : "font-sans"}
        ${TONES[tone] || TONES.neutral}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

// Helper: map a backend status string to a tone + label
// so pages don't have to hand-write every switch statement.
export const STATUS_TONES = {
  // Generic
  pending: "warn",
  active: "success",
  completed: "lavender",
  cancelled: "neutral",

  // KYC
  unverified: "neutral",
  under_review: "warn",
  verified: "success",
  rejected: "danger",

  // Financing request
  approved: "success",
  expired: "neutral",
  withdrawn: "neutral",

  // Contract
  draft: "warn",
  defaulted: "danger",

  // Repayment / payment
  unpaid: "neutral",
  paid: "success",
  overdue: "danger",
  waived: "neutral",
  successful: "success",
  failed: "danger",

  // Tickets
  open: "lime",
  in_progress: "lavender",
  resolved: "success",
  closed: "neutral",
};

export function StatusBadge({ status, mono = true, className = "" }) {
  if (!status) return null;
  const tone = STATUS_TONES[status] || "neutral";
  const label = String(status).replace(/_/g, " ");
  return (
    <Badge tone={tone} mono={mono} className={className}>
      {label}
    </Badge>
  );
}
