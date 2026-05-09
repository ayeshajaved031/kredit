// ==============================================================
// Admin Contracts list
// --------------------------------------------------------------
// Read-only list of every contract on the platform. Filterable by
// status. Each row links to a (read-only-for-admin) detail view —
// reuses the startup ContractDetail page since admin can call
// the same /contracts/:id endpoint.
// ==============================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileSignature } from "lucide-react";

import api from "../../lib/api";
import { useApi } from "../../lib/useApi";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/Badge";
import { Spinner, EmptyState } from "../../components/Loading";
import { formatPKR, formatDate } from "../../lib/format";

const FILTERS = [
  ["all", "All"],
  ["draft", "Awaiting signature"],
  ["active", "Active"],
  ["completed", "Completed"],
  ["defaulted", "Defaulted"],
];

export default function AdminContracts() {
  const [filter, setFilter] = useState("all");
  const { data, loading } = useApi(() => api.get("/contracts"), []);
  const all = data?.data?.contracts || [];

  const visible = useMemo(() => {
    if (filter === "all") return all;
    return all.filter((c) => c.status === filter);
  }, [all, filter]);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Operations"
        title="Contracts"
        subtitle="Every Murabaha contract on the platform."
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map(([v, l]) => {
          const count = v === "all" ? all.length : all.filter((c) => c.status === v).length;
          return (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors
                ${filter === v
                  ? "bg-surface border-lime text-lime"
                  : "bg-transparent border-divider text-ink-muted hover:bg-surface hover:text-ink"}`}
            >
              {l}
              {count > 0 && <span className="ml-1.5 font-mono text-ink-faint">{count}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Spinner size={24} /></div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileSignature}
            title="No contracts in this view"
            message="Try another filter."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2/40 border-b border-divider">
                <tr className="text-left text-xs text-ink-muted uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Startup</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-center">Progress</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c._id} className="border-b border-divider last:border-0 hover:bg-surface-2/30">
                    <td className="px-4 py-3">
                      <Link
                        to={`/contracts/${c._id}`}
                        className="font-mono text-xs text-lavender hover:text-lavender-dark"
                      >
                        {c.contractId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 truncate max-w-[200px]">
                      {c.startupId?.companyName || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-right">{formatPKR(c.totalPayable)}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      {c.paidInstallments}/{c.installmentCount}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile fallback */}
          <ul className="sm:hidden">
            {visible.map((c) => (
              <li key={c._id} className="border-b border-divider last:border-0">
                <Link to={`/contracts/${c._id}`} className="block px-4 py-3 hover:bg-surface-2/50">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-mono text-xs text-ink-muted">{c.contractId}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-sm font-medium truncate">{c.startupId?.companyName}</p>
                  <p className="text-xs text-ink-muted mt-1">
                    <span className="font-mono">{formatPKR(c.totalPayable)}</span> · {c.paidInstallments}/{c.installmentCount} paid
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
