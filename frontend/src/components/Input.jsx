// ==============================================================
// Input + Label + FormField
// --------------------------------------------------------------
// Form primitives matching the mockup's dark inputs with lime
// focus ring. Form pages compose <FormField label=... error=...>
// for the standard label/input/error stack.
// ==============================================================

import { forwardRef } from "react";

export const Label = ({ children, htmlFor, optional = false, className = "" }) => (
  <label
    htmlFor={htmlFor}
    className={`block text-sm text-ink-muted mb-1.5 ${className}`}
  >
    {children}
    {optional && <span className="ml-1.5 text-xs text-ink-faint">(optional)</span>}
  </label>
);

const Input = forwardRef(function Input(
  { className = "", error = false, mono = false, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={`
        w-full h-10 px-3
        bg-surface border rounded-md
        text-ink placeholder:text-ink-faint
        ${mono ? "font-mono" : "font-sans"}
        text-sm
        transition-colors duration-150
        focus:outline-none
        ${error
          ? "border-danger focus:ring-2 focus:ring-danger/40 focus:border-danger"
          : "border-divider focus:ring-2 focus:ring-lime/40 focus:border-lime"}
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    />
  );
});

export default Input;

// Convenience composition — most form rows use this.
export const FormField = ({
  label,
  htmlFor,
  optional = false,
  error,
  hint,
  children,
}) => (
  <div className="mb-4">
    {label && (
      <Label htmlFor={htmlFor} optional={optional}>
        {label}
      </Label>
    )}
    {children}
    {error ? (
      <p className="mt-1.5 text-xs text-danger">{error}</p>
    ) : hint ? (
      <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>
    ) : null}
  </div>
);

export const Textarea = forwardRef(function Textarea(
  { className = "", error = false, rows = 4, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={`
        w-full px-3 py-2.5
        bg-surface border rounded-md
        text-ink placeholder:text-ink-faint
        font-sans text-sm leading-relaxed
        transition-colors duration-150
        focus:outline-none
        ${error
          ? "border-danger focus:ring-2 focus:ring-danger/40 focus:border-danger"
          : "border-divider focus:ring-2 focus:ring-lime/40 focus:border-lime"}
        disabled:opacity-50 disabled:cursor-not-allowed
        resize-y
        ${className}
      `}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select(
  { className = "", error = false, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={`
        w-full h-10 px-3 pr-9
        bg-surface border rounded-md
        text-ink
        font-sans text-sm
        transition-colors duration-150
        appearance-none
        focus:outline-none
        ${error
          ? "border-danger focus:ring-2 focus:ring-danger/40 focus:border-danger"
          : "border-divider focus:ring-2 focus:ring-lime/40 focus:border-lime"}
        disabled:opacity-50 disabled:cursor-not-allowed
        bg-no-repeat bg-right-3
        ${className}
      `}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='none' stroke='%239BA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' d='M1 1.5l5 5 5-5'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 0.75rem center",
      }}
      {...props}
    >
      {children}
    </select>
  );
});
