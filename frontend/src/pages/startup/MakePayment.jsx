// ==============================================================
// Make a Payment
// --------------------------------------------------------------
// Reached via /payments/pay/:scheduleId. Shows installment details,
// method picker (jazzcash | easypaisa | payfast | bank_transfer),
// and a "Confirm and pay" button.
//
// On success, navigates to the receipt page.
// On gateway failure (HTTP 402 from backend), shows the failure
// message inline and offers a retry.
// ==============================================================

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import api, { errorMessage } from "../../lib/api";
import { useApi } from "../../lib/useApi";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import Button from "../../components/Button";
import { LoadingScreen } from "../../components/Loading";
import { StatusBadge } from "../../components/Badge";
import { formatPKR, formatDate } from "../../lib/format";

const METHODS = [
  ["jazzcash", "JazzCash", "Mobile wallet"],
  ["easypaisa", "EasyPaisa", "Mobile wallet"],
  ["payfast", "PayFast", "Card / Account"],
  ["bank_transfer", "Bank Transfer", "Direct debit"],
];

export default function MakePayment() {
  const { scheduleId } = useParams();
  const navigate = useNavigate();

  // Fetch all active contracts. We don't have a direct
  // schedule-by-id endpoint (intentional — schedules are always
  // accessed through their parent contract). Production would expose
  // GET /schedules/:id; for the MVP we walk the small list.
  const { data: contractsData, loading: cLoading } = useApi(
    () => api.get("/contracts?status=active"),
    []
  );

  const [installment, setInstallment] = useState(null);
  const [contract, setContract] = useState(null);
  const [resolving, setResolving] = useState(true);
  const [resolveError, setResolveError] = useState("");
  const [method, setMethod] = useState("jazzcash");
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState(null);

  useEffect(() => {
    if (cLoading || !contractsData) return;
    let alive = true;
    (async () => {
      try {
        const all = contractsData?.data?.contracts || [];
        for (const c of all) {
          try {
            const sRes = await api.get(`/contracts/${c._id}/schedule`);
            const rows = sRes.data?.data?.schedule || [];
            const match = rows.find((r) => r._id === scheduleId);
            if (match) {
              if (alive) {
                setInstallment(match);
                setContract(c);
                setResolving(false);
              }
              return;
            }
          } catch { /* ignore one contract miss */ }
        }
        if (alive) {
          setResolveError("Installment not found.");
          setResolving(false);
        }
      } catch (err) {
        if (alive) {
          setResolveError(errorMessage(err));
          setResolving(false);
        }
      }
    })();
    return () => { alive = false; };
  }, [cLoading, contractsData, scheduleId]);

  if (cLoading || resolving) {
    return <LoadingScreen message="Loading installment…" />;
  }

  if (resolveError || !installment) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center">
        <p className="text-ink-muted mb-4">
          {resolveError || "Installment not available."}
        </p>
        <Link to="/contracts"><Button variant="secondary">Back to contracts</Button></Link>
      </div>
    );
  }

  if (installment.status === "paid" || installment.status === "waived") {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center">
        <CheckCircle2 size={32} className="mx-auto text-lime mb-4" />
        <p className="text-base font-medium mb-2">Already paid</p>
        <p className="text-sm text-ink-muted mb-4">
          This installment has been {installment.status}.
        </p>
        <Link to={`/contracts/${contract._id}/schedule`}>
          <Button variant="secondary">View schedule</Button>
        </Link>
      </div>
    );
  }

  const total = installment.amountDue + (installment.lateFeeAmount || 0);

  const onSubmit = async () => {
    setFailure(null);
    setSubmitting(true);
    try {
      const res = await api.post(`/payments/pay/${scheduleId}`, { method });
      const paymentId = res.data?.data?.payment?._id;
      const completed = res.data?.data?.contractCompleted;
      toast.success(completed ? "Contract fully repaid 🎉" : "Payment successful");
      navigate(paymentId ? `/payments/${paymentId}` : "/payments");
    } catch (err) {
      // 402 = gateway failure (backend returned a structured response)
      if (err?.response?.status === 402) {
        setFailure({
          message: err.response.data?.data?.gatewayMessage || "Payment failed at gateway",
          schedule: err.response.data?.data?.schedule,
        });
      } else {
        toast.error(errorMessage(err, "Payment failed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        to={`/contracts/${contract._id}/schedule`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-4"
      >
        <ArrowLeft size={14} />
        Back to schedule
      </Link>

      <PageHeader
        title="Make a payment"
        subtitle={`Contract ${contract.contractId}`}
      />

      {/* Installment summary */}
      <Card variant="promoted" className="p-5 mb-6">
        <div className="flex items-start justify-between mb-3 gap-3">
          <div>
            <p className="text-xs text-ink-muted">
              Installment <span className="font-mono">{installment.installmentNumber} of {contract.installmentCount}</span>
            </p>
            <p className="text-sm font-medium mt-0.5">
              Due {formatDate(installment.dueDate)}
            </p>
          </div>
          <StatusBadge status={installment.status} />
        </div>

        <p className="font-mono text-display font-medium tracking-tight">
          {formatPKR(total)}
        </p>
        {installment.lateFeeAmount > 0 && (
          <p className="font-mono text-xs text-ink-muted mt-1">
            {formatPKR(installment.amountDue)} + {formatPKR(installment.lateFeeAmount)} late fee
          </p>
        )}
      </Card>

      {/* Method picker */}
      <Card className="p-5 mb-6">
        <h2 className="text-base font-medium mb-3">Payment method</h2>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map(([v, label, hint]) => (
            <button
              key={v}
              type="button"
              onClick={() => setMethod(v)}
              disabled={submitting}
              className={`
                p-4 rounded-md border text-left transition-colors
                ${method === v
                  ? "border-lime bg-lime-glow"
                  : "border-divider bg-transparent hover:bg-surface-2"}
              `}
            >
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-ink-muted mt-0.5">{hint}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Failure banner */}
      {failure && (
        <Card className="p-4 mb-6 border-danger/30 bg-danger-soft">
          <p className="text-sm font-medium text-danger mb-1">Payment failed</p>
          <p className="text-sm text-ink-muted">{failure.message}</p>
          {failure.schedule?.lateFeeAmount > 0 && (
            <p className="text-xs text-ink-muted font-mono mt-1.5">
              A late fee of {formatPKR(failure.schedule.lateFeeAmount)} has been added.
            </p>
          )}
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Link to={`/contracts/${contract._id}/schedule`}>
          <Button variant="secondary" disabled={submitting}>Cancel</Button>
        </Link>
        <Button onClick={onSubmit} loading={submitting} size="lg">
          {failure ? "Retry payment" : `Pay ${formatPKR(total)}`}
        </Button>
      </div>

      <p className="text-xs text-ink-muted text-center mt-4 max-w-md mx-auto">
        Simulated gateway in this environment. Real PayFast / JazzCash integration
        in production.
      </p>
    </div>
  );
}
