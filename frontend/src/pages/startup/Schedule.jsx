// ==============================================================
// Repayment Schedule
// --------------------------------------------------------------
// 12-row schedule for an active contract. Shows installment number,
// due date, amount due (+ late fee if any), status, and a "Pay"
// button on upcoming/overdue installments.
// ==============================================================

import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import api from "../../lib/api";
import { useApi } from "../../lib/useApi";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/Badge";
import Button from "../../components/Button";
import { LoadingScreen } from "../../components/Loading";
import { formatPKR, formatDate } from "../../lib/format";

export default function Schedule() {
  const { id } = useParams();
  const { data, loading, error } = useApi(
    () => api.get(`/contracts/${id}/schedule`),
    [id]
  );

  if (loading) return <LoadingScreen message="Loading schedule…" />;
  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center">
        <p className="text-ink-muted mb-4">{error}</p>
        <Link to="/contracts"><Button variant="secondary">Back to contracts</Button></Link>
      </div>
    );
  }

  const schedule = data?.data?.schedule || [];
  const summary = data?.data?.summary || {};
  const contract = data?.data?.contract;

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to={`/contracts/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-4"
      >
        <ArrowLeft size={14} />
        Back to contract
      </Link>

      <PageHeader
        eyebrow={contract?.contractId}
        title="Repayment schedule"
        subtitle={`${summary.paidCount || 0} of ${schedule.length} installments paid`}
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Paid" value={summary.paidCount || 0} accent="success" />
        <Stat label="Upcoming" value={summary.unpaidCount || 0} accent="default" />
        <Stat label="Overdue" value={summary.overdueCount || 0} accent="danger" />
        <Stat label="Late fees" value={formatPKR(summary.totalLateFees || 0)} accent="default" />
      </div>

      <Card className="overflow-hidden">
        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2/40 border-b border-divider">
              <tr className="text-left text-xs text-ink-muted uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row) => (
                <tr key={row._id} className="border-b border-divider last:border-0 hover:bg-surface-2/30">
                  <td className="px-4 py-3 font-mono text-ink-muted">
                    {String(row.installmentNumber).padStart(2, "0")}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {formatDate(row.dueDate)}
                  </td>
                  <td className="px-4 py-3 font-mono text-right">
                    {formatPKR(row.amountDue + (row.lateFeeAmount || 0))}
                    {row.lateFeeAmount > 0 && (
                      <p className="text-xs text-danger font-mono">
                        +{formatPKR(row.lateFeeAmount)} fee
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(row.status === "unpaid" || row.status === "overdue") ? (
                      <Link to={`/payments/pay/${row._id}`}>
                        <Button size="sm">Pay now</Button>
                      </Link>
                    ) : row.status === "paid" && row.paymentId ? (
                      <Link
                        to={`/payments/${row.paymentId}`}
                        className="text-xs text-lavender hover:text-lavender-dark"
                      >
                        Receipt →
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile list */}
        <ul className="sm:hidden">
          {schedule.map((row) => (
            <li key={row._id} className="px-4 py-4 border-b border-divider last:border-0">
              <div className="flex items-center justify-between mb-1">
                <p className="font-mono text-xs text-ink-muted">
                  Installment {String(row.installmentNumber).padStart(2, "0")}
                </p>
                <StatusBadge status={row.status} />
              </div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-xs">{formatDate(row.dueDate)}</p>
                <p className="font-mono font-medium">
                  {formatPKR(row.amountDue + (row.lateFeeAmount || 0))}
                </p>
              </div>
              {row.lateFeeAmount > 0 && (
                <p className="text-xs text-danger font-mono mb-2">
                  +{formatPKR(row.lateFeeAmount)} late fee
                </p>
              )}
              {(row.status === "unpaid" || row.status === "overdue") && (
                <Link to={`/payments/pay/${row._id}`}>
                  <Button size="sm" className="w-full mt-1">Pay now</Button>
                </Link>
              )}
              {row.status === "paid" && row.paymentId && (
                <Link
                  to={`/payments/${row.paymentId}`}
                  className="text-xs text-lavender hover:text-lavender-dark"
                >
                  View receipt →
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent = "default" }) {
  const color = {
    success: "text-emerald-400",
    danger: "text-danger",
    default: "text-ink",
  }[accent];
  return (
    <div className="bg-surface border border-divider rounded-md px-4 py-3">
      <p className="text-[11px] text-ink-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-mono text-xl font-medium ${color}`}>{value}</p>
    </div>
  );
}
