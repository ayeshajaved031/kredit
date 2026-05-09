// ==============================================================
// My Contracts
// --------------------------------------------------------------
// List of contracts. Draft = needs signing, active = in progress,
// completed/defaulted = historical.
// ==============================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileSignature, PenLine } from "lucide-react";

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
  ["draft", "Awaiting signature"],
  ["active", "Active"],
  ["completed", "Completed"],
  ["defaulted", "Defaulted"],
];

export default function Contracts() {
  const [filter, setFilter] = useState("all");
  const { data, loading } = useApi(() => api.get("/contracts"), []);
  const contracts = data?.data?.contracts || [];

  const visible = useMemo(() => {
    if (filter === "all") return contracts;
    return contracts.filter((c) => c.status === filter);
  }, [contracts, filter]);

  const draftCount = contracts.filter((c) => c.status === "draft").length;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="My contracts"
        subtitle="Murabaha agreements and their repayment progress."
      />

      {draftCount > 0 && filter === "all" && (
        <Card variant="promoted" className="p-4 mb-5">
          <div className="flex items-center gap-3">
            <PenLine size={20} className="text-lime shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {draftCount} contract{draftCount > 1 ? "s" : ""} awaiting your signature
              </p>
              <p className="text-xs text-ink-muted">
                Sign to activate and have your vendor paid.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map(([v, l]) => {
          const count = v === "all" ? contracts.length : contracts.filter((c) => c.status === v).length;
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
            icon={FileSignature}
            title={filter === "all" ? "No contracts yet" : "Nothing here"}
            message={
              filter === "all"
                ? "Submit a financing request — once approved, your contract appears here."
                : "Switch to another filter to see contracts."
            }
            action={
              filter === "all" && (
                <Link to="/apply">
                  <Button size="sm">Apply for financing</Button>
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {visible.map((c) => (
              <li key={c._id} className="border-b border-divider last:border-0">
                <Link
                  to={`/contracts/${c._id}`}
                  className="block px-5 py-4 hover:bg-surface-2/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-mono text-xs text-ink-muted">{c.contractId}</p>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="text-base font-medium">
                        {formatPKR(c.totalPayable)}{" "}
                        <span className="text-ink-muted font-normal text-sm">
                          · {c.installmentCount} months
                        </span>
                      </p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {c.status === "active" && c.nextDueDate ? (
                          <>Next due <span className="font-mono">{formatDate(c.nextDueDate)}</span></>
                        ) : c.status === "draft" ? (
                          <>Created <span className="font-mono">{formatDate(c.createdAt)}</span> — awaiting signature</>
                        ) : c.status === "completed" && c.completedAt ? (
                          <>Completed <span className="font-mono">{formatDate(c.completedAt)}</span></>
                        ) : (
                          <>Created <span className="font-mono">{formatDate(c.createdAt)}</span></>
                        )}
                      </p>
                    </div>
                    {c.status === "active" && (
                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm">
                          {c.paidInstallments}/{c.installmentCount}
                        </p>
                        <p className="text-xs text-ink-muted">paid</p>
                      </div>
                    )}
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
