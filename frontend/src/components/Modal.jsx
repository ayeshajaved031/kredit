// ==============================================================
// Modal
// --------------------------------------------------------------
// Real glassmorphism overlay (backdrop-filter blur) over a
// surface card.
//
// Accessibility:
//   - Closes on Escape
//   - Closes on backdrop click (unless persistent prop is set)
//   - Locks body scroll while open
//   - Returns focus to the previously-focused element on close
//
// Usage:
//   <Modal open={isOpen} onClose={() => setOpen(false)} title="Sign contract">
//     <ContractTerms />
//   </Modal>
// ==============================================================

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  persistent = false,
  size = "md",
}) {
  const previouslyFocused = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;

    const onKey = (e) => {
      if (e.key === "Escape" && !persistent) onClose?.();
    };
    document.addEventListener("keydown", onKey);

    // Lock body scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus to the dialog
    setTimeout(() => dialogRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      try { previouslyFocused.current?.focus?.(); } catch { /* element gone */ }
    };
  }, [open, onClose, persistent]);

  if (!open) return null;

  const SIZE_CLASS = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 modal-backdrop animate-fade-in flex items-center justify-center p-4"
      onMouseDown={(e) => {
        // Close on backdrop click only when the click started on the backdrop itself
        if (e.target === e.currentTarget && !persistent) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        tabIndex={-1}
        className={`
          relative w-full ${SIZE_CLASS[size] || SIZE_CLASS.md}
          bg-surface border border-divider rounded-lg shadow-modal
          animate-slide-up
          max-h-[90vh] overflow-hidden flex flex-col
        `}
      >
        {(title || subtitle) && (
          <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 border-b border-divider">
            <div className="min-w-0">
              {title && (
                <h2 id="modal-title" className="text-h2 font-medium text-ink">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-sm text-ink-muted mt-1">{subtitle}</p>
              )}
            </div>
            {!persistent && (
              <button
                onClick={onClose}
                className="shrink-0 p-1 -m-1 rounded text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-divider bg-bg/30 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
