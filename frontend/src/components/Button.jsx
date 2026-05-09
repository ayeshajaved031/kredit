// ==============================================================
// Button
// --------------------------------------------------------------
// Single component covering all button shapes used in the app.
//
// variant:
//   primary    — solid lime, dark text. The main CTA on a page.
//   secondary  — outlined, transparent bg. Use alongside primary.
//   lavender   — solid lavender. Reserved for "intelligent" actions
//                like "View report" or feature toggles.
//   danger     — red. Destructive (block, delete, withdraw).
//   ghost      — no border, hover bg only. Toolbar buttons.
//
// size: 'sm' | 'md' | 'lg'
// loading shows a spinner and disables the button
// ==============================================================

import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary:
    "bg-lime text-bg hover:bg-lime-dark active:bg-lime-dark disabled:bg-divider disabled:text-ink-faint",
  secondary:
    "bg-transparent text-ink border border-divider hover:bg-surface hover:border-ink-faint disabled:opacity-50",
  lavender:
    "bg-lavender text-lavender-ink hover:bg-lavender-dark disabled:bg-divider disabled:text-ink-faint",
  danger:
    "bg-danger text-white hover:bg-red-700 disabled:opacity-50",
  ghost:
    "bg-transparent text-ink hover:bg-surface disabled:opacity-50",
};

const SIZES = {
  sm: "h-8 px-3 text-sm rounded",
  md: "h-10 px-4 text-sm rounded-md",
  lg: "h-12 px-5 text-base rounded-md",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  type = "button",
  className = "",
  ...props
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2
        font-medium font-sans
        transition-colors duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-bg
        disabled:cursor-not-allowed
        ${SIZES[size]} ${VARIANTS[variant]} ${className}
      `}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
