// ==============================================================
// Loading + EmptyState helpers
// ==============================================================

import { Loader2 } from "lucide-react";

export function Spinner({ size = 18, className = "" }) {
  return (
    <Loader2
      size={size}
      className={`animate-spin text-ink-muted ${className}`}
      aria-label="Loading"
    />
  );
}

// Full-page loader, used when AuthContext is hydrating
export function LoadingScreen({ message = "Loading…" }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-ink-muted">
      <Spinner size={28} />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, message, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className}`}>
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-surface border border-divider flex items-center justify-center mb-4">
          <Icon size={20} className="text-ink-muted" />
        </div>
      )}
      {title && <p className="text-base font-medium text-ink mb-1">{title}</p>}
      {message && <p className="text-sm text-ink-muted max-w-sm mb-4">{message}</p>}
      {action}
    </div>
  );
}

// Skeleton — shimmer-free placeholder rectangles
export function Skeleton({ width = "100%", height = 16, className = "", radius = 6 }) {
  return (
    <div
      className={`bg-surface-2 animate-pulse ${className}`}
      style={{ width, height, borderRadius: radius }}
    />
  );
}
