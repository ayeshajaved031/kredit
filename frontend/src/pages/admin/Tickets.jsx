// ==============================================================
// Admin Support Tickets queue
// --------------------------------------------------------------
// All tickets across all startups. Filterable, links to detail
// (re-uses the startup TicketDetail page since the API and reply
// thread shape is identical, but with admin permissions).
// ==============================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare } from "lucide-react";

import api from "../../lib/api";
import { useApi } from "../../lib/useApi";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/Badge";
import { Spinner, EmptyState } from "../../components/Loading";
import { formatRelative } from "../../lib/format";

const FILTERS = [
  ["open", "Open"],
  ["in_progress", "In progress"],
  ["resolved", "Resolved"],
  ["closed", "Closed"],
  ["all", "All"],
];

const PRIORITY_TONES = {
  urgent: "danger",
  high: "warn",
  medium: "neutral",
  low: "neutral",
};

export default function AdminTickets() {
  const [filter, setFilter] = useState("open");
  const { data, loading, refetch } = useApi(
    () => api.get(filter === "all" ? "/tickets" : `/tickets?status=${filter}`),
    [filter]
  );

  const tickets = data?.data?.tickets || [];

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Operations"
        title="Support tickets"
        subtitle="Handle requests from startups and resolve issues."
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors
              ${filter === v
                ? "bg-surface border-lime text-lime"
                : "bg-transparent border-divider text-ink-muted hover:bg-surface hover:text-ink"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Spinner size={24} /></div>
      ) : tickets.length === 0 ? (
        <Card>
          <EmptyState
            icon={MessageSquare}
            title="No tickets in this view"
            message="Switch to another filter."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {tickets.map((t) => (
              <li key={t._id} className="border-b border-divider last:border-0">
                <Link
                  to={`/admin/tickets/${t._id}`}
                  className="block px-5 py-4 hover:bg-surface-2/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-mono text-xs text-ink-muted">{t.ticketNumber}</p>
                        <StatusBadge status={t.status} />
                        {t.priority === "urgent" && (
                          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-danger-soft text-danger">
                            URGENT
                          </span>
                        )}
                        {t.priority === "high" && (
                          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                            HIGH
                          </span>
                        )}
                      </div>
                      <p className="text-base font-medium truncate">{t.subject}</p>
                      <p className="text-xs text-ink-muted mt-1">
                        {t.startupId?.companyName || "Unknown"} ·{" "}
                        <span className="capitalize">{t.category?.replace(/_/g, " ")}</span>
                        {" · "}
                        Updated {formatRelative(t.updatedAt)}
                      </p>
                    </div>
                    {t.assignedTo && (
                      <p className="text-xs text-ink-muted shrink-0">
                        Assigned: <span className="text-ink">{t.assignedTo.fullName}</span>
                      </p>
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
