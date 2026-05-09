// ==============================================================
// Formatting helpers
// --------------------------------------------------------------
// Used across pages to display financial data consistently.
// Always render numeric output in mono font on the page itself.
// ==============================================================

const PKR = new Intl.NumberFormat("en-PK", {
  style: "decimal",
  maximumFractionDigits: 0,
});

export const formatPKR = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return `PKR ${PKR.format(Math.round(Number(n)))}`;
};

// Compact for chart axes: 1.2M, 850K
export const formatPKRCompact = (n) => {
  if (n === null || n === undefined) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 10_000_000) return `${(v / 10_000_000).toFixed(1)}cr`;
  if (Math.abs(v) >= 100_000) return `${(v / 100_000).toFixed(1)}L`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return PKR.format(v);
};

// "5 Aug 2026"
export const formatDate = (d) => {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// "5 Aug" — shorter, used in tight spaces
export const formatDateShort = (d) => {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

// "in 3 days" / "2 days ago" / "today"
export const formatRelative = (d) => {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = date.getTime() - Date.now();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
};

// Days between (rounded). Negative if first is before second.
export const daysBetween = (a, b) => {
  const da = a instanceof Date ? a : new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  return Math.round((da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24));
};

export const formatPercent = (n, decimals = 1) => {
  if (n === null || n === undefined) return "—";
  return `${Number(n).toFixed(decimals)}%`;
};
