// ==============================================================
// Support Tickets — list
// ==============================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Plus } from "lucide-react";

import api from "../../lib/api";
import { useApi } from "../../lib/useApi";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import Button from "../../components/Button";
import { StatusBadge } from "../../components/Badge";
import { Spinner, EmptyState } from "../../components/Loading";
import { formatRelative } from "../../lib/format";

const FILTERS = [
  ["all", "All"],
  ["open", "Open"],
  ["in_progress", "In progress"],
  ["resolved", "Resolved"],
  ["closed", "Closed"],
];

export default function Tickets() {
  const [filter, setFilter] = useState("all");
  const { data, loading } = useApi(() => api.get("/tickets"), []);
  const all = data?.data?.tickets || [];

  const visible = useMemo(() => {
    if (filter === "all") return all;
    return all.filter((t) => t.status === filter);
  }, [all, filter]);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Support"
        subtitle="Reach our team with any question or issue."
        actions={
          <Link to="/tickets/new">
            <Button>
              <Plus size={14} />
              New ticket
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map(([v, l]) => {
          const count = v === "all" ? all.length : all.filter((t) => t.status === v).length;
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
            icon={MessageSquare}
            title={filter === "all" ? "No tickets yet" : "Nothing here"}
            message={
              filter === "all"
                ? "Need help? Open a ticket and our team will get back to you."
                : "Try switching to another filter."
            }
            action={
              filter === "all" && (
                <Link to="/tickets/new"><Button size="sm">New ticket</Button></Link>
              )
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {visible.map((t) => (
              <li key={t._id} className="border-b border-divider last:border-0">
                <Link
                  to={`/tickets/${t._id}`}
                  className="block px-5 py-4 hover:bg-surface-2/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-mono text-xs text-ink-muted">{t.ticketNumber}</p>
                        <StatusBadge status={t.status} />
                      </div>
                      <p className="text-base font-medium truncate">{t.subject}</p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        <span className="capitalize">{t.category?.replace(/_/g, " ")}</span>
                        {" · "}
                        Updated {formatRelative(t.updatedAt)}
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
