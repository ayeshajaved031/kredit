// ==============================================================
// Admin Reports
// --------------------------------------------------------------
// All 5 admin reports rendered side-by-side. The dashboard uses
// portfolio-overview + monthly-disbursement; this page surfaces
// the rest (repayment performance, top vendors, audit summary)
// in addition.
// ==============================================================

import { useEffect, useState } from "react";

import api from "../../lib/api";
import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import Button from "../../components/Button";
import { Spinner } from "../../components/Loading";
import { formatPKR, formatPKRCompact, formatPercent } from "../../lib/format";

export default function AdminReports() {
  const [data, setData] = useState({
    perf: null, topVendors: null, audit: null,
  });
  const [loading, setLoading] = useState(true);
  const [auditDays, setAuditDays] = useState(30);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [pRes, tvRes, asRes] = await Promise.all([
        api.get("/admin/reports/repayment-performance"),
        api.get("/admin/reports/top-vendors?limit=10"),
        api.get(`/admin/reports/audit-summary?days=${auditDays}`),
      ]);
      setData({
        perf: pRes.data?.data,
        topVendors: tvRes.data?.data,
        audit: asRes.data?.data,
      });
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAll(); }, [auditDays]);

  if (loading) return <div className="py-20 flex justify-center"><Spinner size={28} /></div>;

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Compliance"
        title="Reports"
        subtitle="Portfolio analytics, repayment performance, and audit activity."
      />

      <RepaymentPerformance data={data.perf} />
      <TopVendors data={data.topVendors} />
      <AuditSummary data={data.audit} days={auditDays} setDays={setAuditDays} />
    </div>
  );
}

// ---------- Repayment performance ----------
function RepaymentPerformance({ data }) {
  if (!data) return null;
  const i = data.installments || {};
  const t = data.paymentTimeliness || {};
  const o = data.currentOverdue || {};
  const c = data.contracts || {};

  return (
    <Card className="p-5 mb-6">
      <h2 className="text-base font-medium mb-1">Repayment performance</h2>
      <p className="text-xs text-ink-muted mb-5">
        Across all installments due to date.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="On-time payment rate" value={formatPercent(t.onTimePct)} accent="lime" hint={`${t.onTime} on-time / ${t.late} late`} />
        <Tile label="Default rate" value={formatPercent(c.defaultRatePct)} hint={`${c.defaulted} of ${c.totalIssued} contracts`} />
        <Tile label="Avg days late (paid)" value={`${(t.avgDaysLate || 0).toFixed(1)}`} hint={`max ${(t.maxDaysLate || 0).toFixed(0)} days`} />
        <Tile label="Avg days overdue (now)" value={`${(o.avgDaysOverdue || 0).toFixed(1)}`} accent={o.avgDaysOverdue > 7 ? "default" : "default"} hint={`${i.overdue} currently overdue`} />
      </div>

      <div className="mt-5 grid sm:grid-cols-2 gap-3 text-sm">
        <div className="p-3 bg-surface-2/40 border border-divider rounded-md">
          <p className="text-xs text-ink-muted mb-2">Installments due</p>
          <Row label="Paid" value={i.paid || 0} />
          <Row label="Overdue" value={i.overdue || 0} accent="danger" />
          <Row label="Unpaid" value={i.unpaid || 0} />
          <Row label="Waived" value={i.waived || 0} />
        </div>
        <div className="p-3 bg-surface-2/40 border border-divider rounded-md">
          <p className="text-xs text-ink-muted mb-2">Contracts</p>
          <Row label="Active" value={c.active || 0} />
          <Row label="Completed" value={c.completed || 0} accent="success" />
          <Row label="Defaulted" value={c.defaulted || 0} accent="danger" />
          <Row label="Completion rate" value={formatPercent(c.completionRatePct)} />
        </div>
      </div>
    </Card>
  );
}

// ---------- Top vendors ----------
function TopVendors({ data }) {
  if (!data) return null;
  const rows = data.topVendors || [];

  return (
    <Card className="p-5 mb-6">
      <h2 className="text-base font-medium mb-1">Top vendors</h2>
      <p className="text-xs text-ink-muted mb-5">By total financed volume.</p>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted py-4 text-center">No vendor activity yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-divider">
              <tr className="text-left text-xs text-ink-muted uppercase tracking-wider">
                <th className="py-2.5 px-3 font-medium">#</th>
                <th className="py-2.5 px-3 font-medium">Vendor</th>
                <th className="py-2.5 px-3 font-medium text-right">Total financed</th>
                <th className="py-2.5 px-3 font-medium text-center">Requests</th>
                <th className="py-2.5 px-3 font-medium text-center">Active</th>
                <th className="py-2.5 px-3 font-medium text-center">Completed</th>
                <th className="py-2.5 px-3 font-medium text-center">Defaulted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v, i) => (
                <tr key={v._id} className="border-b border-divider last:border-0 hover:bg-surface-2/30">
                  <td className="py-2.5 px-3 font-mono text-xs text-ink-muted">{i + 1}</td>
                  <td className="py-2.5 px-3">
                    <p className="font-medium">{v.vendorName}</p>
                    <p className="text-xs text-ink-muted capitalize">{v.category?.replace(/_/g, " ")}</p>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right text-lime">{formatPKR(v.totalFinanced)}</td>
                  <td className="py-2.5 px-3 font-mono text-center">{v.requestCount}</td>
                  <td className="py-2.5 px-3 font-mono text-center">{v.activeContracts || 0}</td>
                  <td className="py-2.5 px-3 font-mono text-center text-emerald-400">{v.completedContracts || 0}</td>
                  <td className="py-2.5 px-3 font-mono text-center text-danger">{v.defaultedContracts || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ---------- Audit summary ----------
function AuditSummary({ data, days, setDays }) {
  if (!data) return null;

  return (
    <Card className="p-5 mb-10">
      <div className="flex items-start justify-between mb-1 flex-wrap gap-3">
        <div>
          <h2 className="text-base font-medium">Audit activity</h2>
          <p className="text-xs text-ink-muted mt-1">
            <span className="font-mono">{data.totalActions}</span> actions in the last {days} days
          </p>
        </div>
        <div className="flex gap-1.5">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors
                ${days === d
                  ? "bg-surface border-lavender text-lavender"
                  : "bg-transparent border-divider text-ink-muted hover:bg-surface hover:text-ink"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-5">
        {/* By action */}
        <div>
          <p className="text-xs text-ink-muted mb-2">By action</p>
          <div className="bg-surface-2/40 border border-divider rounded-md divide-y divide-divider">
            {(data.byAction || []).slice(0, 10).map((a) => (
              <div key={a.action} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-mono text-xs">{a.action}</span>
                <span className="font-mono">{a.count}</span>
              </div>
            ))}
            {(data.byAction || []).length === 0 && (
              <p className="text-sm text-ink-muted px-3 py-4 text-center">No actions recorded.</p>
            )}
          </div>
        </div>

        {/* Top actors */}
        <div>
          <p className="text-xs text-ink-muted mb-2">Top actors</p>
          <div className="bg-surface-2/40 border border-divider rounded-md divide-y divide-divider">
            {(data.topActors || []).slice(0, 10).map((act) => (
              <div key={act.actorId || act.actorName} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="text-sm truncate">{act.actorName || "—"}</p>
                  <p className="text-xs text-ink-muted truncate font-mono">{act.actorEmail || act.actorRole}</p>
                </div>
                <span className="font-mono shrink-0">{act.count}</span>
              </div>
            ))}
            {(data.topActors || []).length === 0 && (
              <p className="text-sm text-ink-muted px-3 py-4 text-center">No actors recorded.</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---------- helpers ----------
function Tile({ label, value, accent = "default", hint }) {
  const color = { lime: "text-lime", lavender: "text-lavender", default: "text-ink" }[accent];
  return (
    <div className="bg-surface-2/40 border border-divider rounded-md p-3">
      <p className="text-[11px] text-ink-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-mono text-h2 font-medium ${color}`}>{value}</p>
      {hint && <p className="text-xs text-ink-muted mt-1">{hint}</p>}
    </div>
  );
}
function Row({ label, value, accent = "default" }) {
  const color = {
    danger: "text-danger", success: "text-emerald-400", default: "text-ink",
  }[accent];
  return (
    <div className="flex items-baseline justify-between mb-1.5 last:mb-0">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className={`font-mono ${color}`}>{value}</span>
    </div>
  );
}
