// ==============================================================
// Payment History
// --------------------------------------------------------------
// All payments by this startup, newest first. Filter by status.
// ==============================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Wallet } from "lucide-react";

import api from "../../lib/api";
import { useApi } from "../../lib/useApi";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/Badge";
import { Spinner, EmptyState } from "../../components/Loading";
import { formatPKR, formatDate } from "../../lib/format";

const FILTERS = [
  ["all", "All"],
  ["successful", "Successful"],
  ["failed", "Failed"],
];

export default function Payments() {
  const [filter, setFilter] = useState("all");
  const { data, loading } = useApi(() => api.get("/payments?limit=100"), []);
  const all = data?.data?.payments || [];

  const visible = useMemo(() => {
    if (filter === "all") return all;
    return all.filter((p) => p.status === filter);
  }, [all, filter]);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Payments"
        subtitle="Receipt history for all your installments."
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map(([v, l]) => {
          const count = v === "all" ? all.length : all.filter((p) => p.status === v).length;
          return (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`
                px-3 py-1.5 text-xs rounded-md border transition-colors
                ${filter === v
                  ? "bg-surface border-lime text-lime"
                  : "bg-transparent border-divider text-ink-muted hover:bg-surface hover:text-ink"}
              `}
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
            icon={Wallet}
            title="No payments yet"
            message="Once you start making payments, they'll appear here."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {visible.map((p) => (
              <li key={p._id} className="border-b border-divider last:border-0">
                <Link
                  to={`/payments/${p._id}`}
                  className="block px-5 py-4 hover:bg-surface-2/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-mono text-xs text-ink-muted">{p.paymentId}</p>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="text-base font-medium font-mono">{formatPKR(p.amount)}</p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        <span className="font-mono">{formatDate(p.createdAt)}</span>
                        {" · "}{p.method}
                        {p.contractId?.contractId && (
                          <>{" · "}<span className="font-mono">{p.contractId.contractId}</span></>
                        )}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
