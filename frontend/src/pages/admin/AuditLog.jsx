// ==============================================================
// Admin Audit Log Viewer
// --------------------------------------------------------------
// Append-only history of admin and system actions. Filterable
// by action type and actor role. Append-only means there are
// no destructive controls here.
// ==============================================================

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";

import api from "../../lib/api";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { Spinner, EmptyState } from "../../components/Loading";
import Badge from "../../components/Badge";
import { Select, FormField } from "../../components/Input";
import { formatRelative, formatDate } from "../../lib/format";

const ROLE_TONES = {
  admin: "lavender",
  startup: "neutral",
  system: "lime",
};

export default function AuditLog() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ action: "", actorRole: "" });

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (filter.action) params.set("action", filter.action);
      if (filter.actorRole) params.set("actorRole", filter.actorRole);
      const res = await api.get(`/admin/audit-logs?${params}`);
      setList(res.data?.data?.logs || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [filter.action, filter.actorRole]);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Compliance"
        title="Audit log"
        subtitle="Append-only history of admin and system actions."
      />

      {/* Filters */}
      <Card className="p-4 mb-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <FormField label="Action" htmlFor="f-action">
            <Select
              id="f-action"
              value={filter.action}
              onChange={(e) => setFilter((f) => ({ ...f, action: e.target.value }))}
            >
              <option value="">All actions</option>
              <option value="USER_LOGIN">User login</option>
              <option value="USER_REGISTER">User register</option>
              <option value="KYC_APPROVE">KYC approve</option>
              <option value="KYC_REJECT">KYC reject</option>
              <option value="REQUEST_APPROVE">Request approve</option>
              <option value="REQUEST_REJECT">Request reject</option>
              <option value="REQUEST_WITHDRAW">Request withdraw</option>
              <option value="CONTRACT_SIGN">Contract sign</option>
              <option value="MARK_CONTRACT_DEFAULTED">Contract defaulted</option>
              <option value="PAYMENT_SUCCESS">Payment success</option>
              <option value="PAYMENT_FAILED">Payment failed</option>
              <option value="USER_BLOCK">User block</option>
              <option value="USER_UNBLOCK">User unblock</option>
              <option value="VENDOR_CREATE">Vendor create</option>
              <option value="VENDOR_UPDATE">Vendor update</option>
            </Select>
          </FormField>
          <FormField label="Actor role" htmlFor="f-role">
            <Select
              id="f-role"
              value={filter.actorRole}
              onChange={(e) => setFilter((f) => ({ ...f, actorRole: e.target.value }))}
            >
              <option value="">All roles</option>
              <option value="admin">Admin</option>
              <option value="startup">Startup</option>
              <option value="system">System</option>
            </Select>
          </FormField>
        </div>
      </Card>

      {loading ? (
        <div className="py-12 flex justify-center"><Spinner size={24} /></div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={ScrollText}
            title="No log entries match"
            message="Try clearing or adjusting filters."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {list.map((log) => (
              <li
                key={log._id}
                className="border-b border-divider last:border-0 px-5 py-3.5"
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={ROLE_TONES[log.actorRole] || "neutral"} mono>
                      {log.actorRole || "unknown"}
                    </Badge>
                    <p className="font-mono text-sm text-ink">{log.action}</p>
                    {log.targetType && (
                      <span className="text-xs text-ink-muted">
                        on <span className="font-mono">{log.targetType}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-faint font-mono shrink-0">
                    {formatRelative(log.createdAt)}
                  </p>
                </div>
                {log.actorEmail && (
                  <p className="text-xs text-ink-muted font-mono">{log.actorEmail}</p>
                )}
                {log.details && Object.keys(log.details).length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-ink-muted cursor-pointer hover:text-ink">
                      Details
                    </summary>
                    <pre className="mt-2 p-2 bg-surface-2 border border-divider rounded text-[11px] font-mono overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </details>
                )}
                <p className="text-xs text-ink-faint font-mono mt-1.5">
                  {formatDate(log.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
