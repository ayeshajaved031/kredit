// ==============================================================
// My Financing Requests — list view
// --------------------------------------------------------------
// Filterable list of own financing requests. Each row shows the
// vendor, amount, status, submitted date, and links to detail.
// ==============================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";

import api from "../../lib/api";
import { useApi } from "../../lib/useApi";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/Badge";
import Button from "../../components/Button";
import { Spinner, EmptyState } from "../../components/Loading";
import { formatPKR, formatDate } from "../../lib/format";

const FILTERS = [
  ["all", "All"],
  ["pending", "Pending"],
  ["under_review", "Under review"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
];

export default function Requests() {
  const [filter, setFilter] = useState("all");
  const { data, loading } = useApi(() => api.get("/financing-requests"), []);
  const all = data?.data?.requests || [];

  const visible = useMemo(() => {
    if (filter === "all") return all;
    return all.filter((r) => r.status === filter);
  }, [all, filter]);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="My financing requests"
        subtitle="Track applications and their review status."
        actions={
          <Link to="/apply">
            <Button>New request</Button>
          </Link>
        }
      />

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map(([v, l]) => {
          const count = v === "all" ? all.length : all.filter((r) => r.status === v).length;
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
            icon={FileText}
            title={filter === "all" ? "No requests yet" : `No ${filter} requests`}
            message={
              filter === "all"
                ? "Browse vendors and submit a financing request."
                : "Try switching to another filter."
            }
            action={
              filter === "all" && (
                <Link to="/vendors"><Button size="sm">Browse vendors</Button></Link>
              )
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {visible.map((r) => (
              <li key={r._id} className="border-b border-divider last:border-0">
                <Link
                  to={`/requests/${r._id}`}
                  className="block px-5 py-4 hover:bg-surface-2/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-mono text-xs text-ink-muted">{r.requestId}</p>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="text-base font-medium truncate">
                        {r.vendorNameSnapshot} · {r.planName}
                      </p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        Submitted <span className="font-mono">{formatDate(r.createdAt)}</span>
                      </p>
                    </div>
                    <p className="font-mono text-base font-medium shrink-0 text-right">
                      {formatPKR(r.annualAmountPKR)}
                    </p>
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
