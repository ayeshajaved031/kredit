// ==============================================================
// Startup Dashboard
// --------------------------------------------------------------
// What the startup sees first after login. Components:
//   - KYC banner (only if not verified)
//   - 3 metric cards: available credit, active contracts, next due
//   - "Next payment" promoted card (only if there is one)
//   - Recent activity (recent contracts + recent payments)
//   - Empty states tuned for a brand-new account
//
// Data comes from a parallel fetch of:
//   - /contracts                (own active list)
//   - /payments?limit=5         (recent payments)
//   - /contracts/.../schedule   (only for the most-recent active contract)
// ==============================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileSignature, ShoppingBag, Wallet } from "lucide-react";

import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

import PageHeader from "../../components/PageHeader";
import KycStatusBanner from "../../components/KycStatusBanner";
import { Card, MetricCard } from "../../components/Card";
import Button from "../../components/Button";
import Badge, { StatusBadge } from "../../components/Badge";
import { Spinner, EmptyState } from "../../components/Loading";
import { formatPKR, formatDateShort, formatDate, daysBetween } from "../../lib/format";

export default function Dashboard() {
  const { user, startup } = useAuth();
  const [data, setData] = useState({ contracts: [], payments: [], nextDue: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Parallel fetch
        const [cRes, pRes] = await Promise.all([
          api.get("/contracts?status=active"),
          api.get("/payments?limit=5"),
        ]);
        if (!alive) return;
        const contracts = cRes.data?.data?.contracts || [];
        const payments = pRes.data?.data?.payments || [];

        // For the most recent active contract, fetch the schedule
        // and pick the next unpaid installment.
        let nextDue = null;
        if (contracts.length > 0) {
          // Find the contract with the soonest nextDueDate
          const sorted = [...contracts]
            .filter((c) => c.nextDueDate)
            .sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate));
          if (sorted.length > 0) {
            const target = sorted[0];
            try {
              const sRes = await api.get(`/contracts/${target._id}/schedule`);
              const rows = sRes.data?.data?.schedule || [];
              const upcoming = rows.find((r) => r.status === "unpaid" || r.status === "overdue");
              if (upcoming) {
                nextDue = { ...upcoming, contract: target };
              }
            } catch { /* ignore */ }
          }
        }

        if (alive) setData({ contracts, payments, nextDue });
      } catch {
        // Errors handled by the axios interceptor (401) or shown
        // as empty state — no point in a giant error message here.
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const availableCredit = Math.max(
    0,
    (startup?.approvedCreditLimit || 0) - (startup?.usedCredit || 0)
  );

  const isFresh =
    !loading &&
    data.contracts.length === 0 &&
    data.payments.length === 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-1">
        <p className="text-sm text-ink-muted">Welcome back, {user?.fullName?.split(" ")[0] || "there"}</p>
      </div>
      <PageHeader title={startup?.companyName || "Your dashboard"} />

      <KycStatusBanner startup={startup} />

      {/* Metric strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <MetricCard
          label="Available credit"
          value={
            startup?.kycStatus === "verified"
              ? formatPKR(availableCredit)
              : "—"
          }
          accent="lime"
          hint={
            startup?.kycStatus === "verified"
              ? `of ${formatPKR(startup?.approvedCreditLimit || 0)} approved`
              : "Complete KYC to unlock"
          }
        />
        <MetricCard
          label="Active contracts"
          value={data.contracts.length}
          accent="default"
        />
        <MetricCard
          label="Next payment"
          value={data.nextDue ? formatDateShort(data.nextDue.dueDate) : "—"}
          accent="lavender"
          hint={data.nextDue ? formatPKR(data.nextDue.amountDue) : "No upcoming"}
        />
      </div>

      {/* Promoted card: next payment */}
      {data.nextDue && <NextPaymentCard nextDue={data.nextDue} />}

      {/* Activity grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-divider">
            <h2 className="text-base font-medium">Active contracts</h2>
            <Link to="/contracts" className="text-xs text-lavender hover:text-lavender-dark inline-flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="p-8 flex justify-center"><Spinner /></div>
          ) : data.contracts.length === 0 ? (
            <EmptyState
              icon={FileSignature}
              title="No active contracts yet"
              message={
                isFresh
                  ? "Apply for financing once your KYC is approved."
                  : "Browse vendors and submit a financing request."
              }
              action={
                <Link to="/vendors">
                  <Button size="sm" variant="secondary">Browse vendors</Button>
                </Link>
              }
            />
          ) : (
            <ul>
              {data.contracts.slice(0, 4).map((c) => (
                <li key={c._id} className="px-5 py-3 border-b border-divider last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-ink-muted">{c.contractId}</p>
                      <p className="text-sm font-medium truncate">
                        {formatPKR(c.totalPayable)} · {c.installmentCount} months
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  {c.nextDueDate && (
                    <p className="text-xs text-ink-muted mt-1.5">
                      Next: <span className="font-mono">{formatDate(c.nextDueDate)}</span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-divider">
            <h2 className="text-base font-medium">Recent payments</h2>
            <Link to="/payments" className="text-xs text-lavender hover:text-lavender-dark inline-flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="p-8 flex justify-center"><Spinner /></div>
          ) : data.payments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payments yet"
              message="Once you sign a contract, your installment history will appear here."
            />
          ) : (
            <ul>
              {data.payments.slice(0, 5).map((p) => (
                <li key={p._id} className="px-5 py-3 border-b border-divider last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-ink-muted">{p.paymentId}</p>
                      <p className="text-sm font-medium truncate">{formatPKR(p.amount)}</p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        <span className="font-mono">{formatDate(p.createdAt)}</span> · {p.method}
                      </p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* First-run helper */}
      {isFresh && startup?.kycStatus === "verified" && (
        <Card className="mt-6 p-6 text-center">
          <ShoppingBag className="mx-auto mb-3 text-lime" size={28} strokeWidth={1.5} />
          <h3 className="text-base font-medium mb-1">Ready to apply?</h3>
          <p className="text-sm text-ink-muted mb-4">
            Browse {/**/}supported vendors and submit your first financing request.
          </p>
          <Link to="/vendors"><Button>Browse vendors</Button></Link>
        </Card>
      )}
    </div>
  );
}

function NextPaymentCard({ nextDue }) {
  const days = daysBetween(nextDue.dueDate, new Date());
  const isOverdue = nextDue.status === "overdue" || days < 0;

  let pillTone = "lime";
  let pillText = days === 0 ? "DUE TODAY" : `DUE IN ${days} DAYS`;
  if (isOverdue) {
    pillTone = "danger";
    pillText = `OVERDUE BY ${Math.abs(days)} DAYS`;
  } else if (days <= 3 && days >= 0) {
    pillTone = "lime";
  }

  const total = (nextDue.amountDue || 0) + (nextDue.lateFeeAmount || 0);

  return (
    <Card variant="promoted" className="p-5 mb-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs text-ink-muted">
            Contract <span className="font-mono">{nextDue.contract?.contractId}</span>
          </p>
          <p className="text-base font-medium mt-0.5">
            Installment {nextDue.installmentNumber} of {nextDue.contract?.installmentCount}
          </p>
        </div>
        <Badge tone={pillTone} mono>{pillText}</Badge>
      </div>

      <p className="font-mono text-h1 font-medium mb-1 tracking-tight">
        {formatPKR(total)}
      </p>
      {nextDue.lateFeeAmount > 0 && (
        <p className="font-mono text-xs text-ink-muted mb-4">
          {formatPKR(nextDue.amountDue)} + {formatPKR(nextDue.lateFeeAmount)} late fee
        </p>
      )}
      {!nextDue.lateFeeAmount && (
        <p className="text-xs text-ink-muted mb-4">
          Due {formatDate(nextDue.dueDate)}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Link to={`/payments/pay/${nextDue._id}`} className="flex-1 min-w-[200px]">
          <Button className="w-full">Pay {formatPKR(total)}</Button>
        </Link>
        <Link to={`/contracts/${nextDue.contract?._id}/schedule`}>
          <Button variant="secondary">View schedule</Button>
        </Link>
      </div>
    </Card>
  );
}
