// ==============================================================
// Contract Detail
// --------------------------------------------------------------
// View contract terms + status. For draft contracts, shows a
// SIGN button that opens the signing modal.
//
// Signing modal flow (matches backend exactly):
//   1. Show full terms snapshot
//   2. Require: password re-entry, typed full-name (must match
//      account fullName exactly), terms-accepted checkbox
//   3. POST /contracts/:id/sign with all three
//   4. Backend verifies password, checks name, computes signature
//      hash, generates schedule, pays vendor (simulated), activates
// ==============================================================

import { useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Download, FileSignature, Calendar } from "lucide-react";

import api, { errorMessage } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { useAuth } from "../../context/AuthContext";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import Button from "../../components/Button";
import { StatusBadge } from "../../components/Badge";
import Modal from "../../components/Modal";
import Input, { FormField } from "../../components/Input";
import { LoadingScreen } from "../../components/Loading";
import { formatPKR, formatDate } from "../../lib/format";

export default function ContractDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [showSign, setShowSign] = useState(false);

  const { data, loading, error, refetch } = useApi(
    () => api.get(`/contracts/${id}`),
    [id]
  );

  if (loading) return <LoadingScreen message="Loading contract…" />;
  if (error || !data?.data?.contract) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center">
        <p className="text-ink-muted mb-4">{error || "Contract not found."}</p>
        <Link to="/contracts"><Button variant="secondary">Back to contracts</Button></Link>
      </div>
    );
  }

  const c = data.data.contract;
  const isDraft = c.status === "draft";
  const isActive = c.status === "active";
  const isCompleted = c.status === "completed";
  const isDefaulted = c.status === "defaulted";

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to="/contracts"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-4"
      >
        <ArrowLeft size={14} />
        Back to contracts
      </Link>

      <PageHeader
        eyebrow={c.contractId}
        title="Murabaha contract"
        subtitle={c.terms?.vendorName ? `For ${c.terms.vendorName}` : undefined}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={c.status} />
          </div>
        }
      />

      {/* Status-specific banners */}
      {isDraft && (
        <Card variant="promoted" className="p-5 mb-6">
          <div className="flex items-start gap-3">
            <FileSignature className="text-lime shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Ready to activate</p>
              <p className="text-sm text-ink-muted mb-4">
                Review the terms below and sign. Once signed, we'll pay your vendor
                immediately and your 12-month schedule begins.
              </p>
              <Button onClick={() => setShowSign(true)}>Sign contract</Button>
            </div>
          </div>
        </Card>
      )}

      {isCompleted && (
        <Card className="p-5 mb-6 bg-emerald-500/5 border-emerald-500/30">
          <p className="text-sm font-medium mb-1">Fully repaid 🎉</p>
          <p className="text-sm text-ink-muted">
            Completed {formatDate(c.completedAt)} · Total paid {formatPKR(c.totalPaidAmount)}
          </p>
        </Card>
      )}

      {isDefaulted && (
        <Card className="p-5 mb-6 bg-danger-soft border-danger/30">
          <p className="text-sm font-medium text-danger mb-1">Contract defaulted</p>
          <p className="text-sm text-ink-muted">
            Please contact support@kredit.pk to resolve.
          </p>
        </Card>
      )}

      {/* Money summary */}
      <Card className="p-5 mb-6">
        <h2 className="text-base font-medium mb-4">Contract summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Principal" value={formatPKR(c.principalAmount)} />
          <Stat label={`Markup · ${c.markupPercent}%`} value={formatPKR(c.markupAmount)} />
          <Stat label="Total payable" value={formatPKR(c.totalPayable)} accent="lime" />
          <Stat label="Per installment" value={formatPKR(c.installmentAmount)} accent="lavender" />
        </div>

        {isActive && (
          <div className="mt-5 pt-5 border-t border-divider">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Repayment progress</p>
              <span className="font-mono text-xs text-ink-muted">
                {c.paidInstallments} / {c.installmentCount} paid
              </span>
            </div>
            <ProgressBar paid={c.paidInstallments} total={c.installmentCount} />
            <div className="flex justify-between mt-2 font-mono text-xs text-ink-muted">
              <span>{formatPKR(c.totalPaidAmount || 0)} paid</span>
              <span>
                {formatPKR(Math.max(0, c.totalPayable - (c.totalPaidAmount || 0)))} remaining
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Terms snapshot */}
      {c.terms && (
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-base font-medium">Terms</h2>
            <a href={`${import.meta.env.VITE_API_URL || ""}/api/contracts/${c._id}/document`}
              className="inline-flex items-center gap-1.5 text-xs text-lavender hover:text-lavender-dark"
            >
              <Download size={14} /> Download .txt
            </a>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <Detail label="Contract ID" value={c.contractId} mono />
            <Detail label="Vendor" value={c.terms.vendorName} />
            <Detail label="Plan" value={c.terms.planName} />
            <Detail label="Installments" value={`${c.installmentCount} months`} />
            <Detail label="First due" value={formatDate(c.firstDueDate)} mono />
            <Detail label="Late payment fee" value={`${c.latePaymentFeePercent}%`} mono />
            {c.terms.governingLaw && (
              <div className="sm:col-span-2">
                <Detail label="Governing law" value={c.terms.governingLaw} />
              </div>
            )}
          </dl>

          {c.terms.ribaCompliance && (
            <div className="mt-4 pt-4 border-t border-divider">
              <p className="text-xs text-ink-muted mb-1.5">Shariah compliance</p>
              <p className="text-sm leading-relaxed">{c.terms.ribaCompliance}</p>
            </div>
          )}

          {c.terms.lateFeesToCharity && (
            <div className="mt-3">
              <p className="text-xs text-ink-muted mb-1.5">Late fees</p>
              <p className="text-sm leading-relaxed">{c.terms.lateFeesToCharity}</p>
            </div>
          )}
        </Card>
      )}

      {/* Action row */}
      <div className="flex flex-wrap gap-3">
        {isActive && (
          <Link to={`/contracts/${c._id}/schedule`}>
            <Button>
              <Calendar size={16} />
              View schedule & pay
            </Button>
          </Link>
        )}
        {isDraft && (
          <Button onClick={() => setShowSign(true)}>
            <FileSignature size={16} />
            Sign contract
          </Button>
        )}
      </div>

      {/* Signing modal */}
      <SignModal
        open={showSign}
        onClose={() => setShowSign(false)}
        contract={c}
        userFullName={user?.fullName || ""}
        onSigned={() => { setShowSign(false); refetch(); }}
      />
    </div>
  );
}

function Stat({ label, value, accent = "default" }) {
  const color = {
    lime: "text-lime",
    lavender: "text-lavender",
    default: "text-ink",
  }[accent];
  return (
    <div>
      <p className="text-xs text-ink-muted mb-1">{label}</p>
      <p className={`font-mono text-base font-medium ${color}`}>{value}</p>
    </div>
  );
}

function Detail({ label, value, mono = false }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted mb-0.5">{label}</dt>
      <dd className={`text-sm ${mono ? "font-mono" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

function ProgressBar({ paid, total }) {
  const cells = Array.from({ length: total }, (_, i) => i < paid);
  return (
    <div className="flex gap-1">
      {cells.map((filled, i) => (
        <div
          key={i}
          className={`flex-1 h-1.5 rounded-sm ${filled ? "bg-lavender" : "bg-divider"}`}
        />
      ))}
    </div>
  );
}

// ==============================================================
// Sign Modal
// --------------------------------------------------------------
// Three-input authorization (matches backend exactly):
//   - password
//   - typed-name (must equal user.fullName)
//   - accept-terms checkbox
// ==============================================================
function SignModal({ open, onClose, contract, userFullName, onSigned }) {
  const [password, setPassword] = useState("");
  const [typedName, setTypedName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const nameMatches = useMemo(
    () => typedName.trim().toLowerCase() === userFullName.trim().toLowerCase() && userFullName.trim().length > 0,
    [typedName, userFullName]
  );

  const canSubmit = password.length > 0 && nameMatches && accepted && !submitting;

  const reset = () => {
    setPassword("");
    setTypedName("");
    setAccepted(false);
    setError("");
  };

  const onCloseSafe = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post(`/contracts/${contract._id}/sign`, {
        password,
        typedFullName: typedName.trim(),
        acceptedTerms: accepted,
      });
      toast.success("Contract signed — vendor payment in progress");
      reset();
      onSigned();
    } catch (err) {
      const msg = errorMessage(err, "Could not sign contract");
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onCloseSafe}
      title="Sign your Murabaha contract"
      subtitle="This action is final. Once signed, your vendor will be paid immediately."
      persistent={submitting}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onCloseSafe} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={submitting} disabled={!canSubmit}>
            Sign and activate
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <div className="bg-surface-2/60 border border-divider rounded-md p-4 mb-5 text-sm">
          <p className="text-xs text-ink-muted mb-2">You are committing to:</p>
          <ul className="space-y-1.5">
            <li className="flex justify-between">
              <span className="text-ink-muted">Total payable</span>
              <span className="font-mono">{formatPKR(contract.totalPayable)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-ink-muted">Monthly installment</span>
              <span className="font-mono">{formatPKR(contract.installmentAmount)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-ink-muted">First payment</span>
              <span className="font-mono">{formatDate(contract.firstDueDate)}</span>
            </li>
          </ul>
        </div>

        <FormField
          label="Confirm your password"
          htmlFor="sign-password"
          hint="The same password you use to sign in"
        >
          <Input
            id="sign-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={submitting}
          />
        </FormField>

        <FormField
          label="Type your full name to sign"
          htmlFor="sign-name"
          hint={
            typedName && !nameMatches
              ? `Must match exactly: ${userFullName}`
              : `As shown on your account`
          }
          error={typedName && !nameMatches ? "Name doesn't match" : undefined}
        >
          <Input
            id="sign-name"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={userFullName}
            disabled={submitting}
            error={typedName && !nameMatches}
          />
        </FormField>

        <label className="flex items-start gap-3 mt-2 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            disabled={submitting}
            className="mt-0.5 w-4 h-4 accent-lime"
          />
          <span className="text-sm text-ink-muted leading-relaxed">
            I have read and agree to the Murabaha contract terms, including the
            fixed markup, the 12-month repayment schedule, and the late-fee-to-charity policy.
          </span>
        </label>

        {error && (
          <p className="text-sm text-danger mt-2" role="alert">{error}</p>
        )}
      </form>
    </Modal>
  );
}
