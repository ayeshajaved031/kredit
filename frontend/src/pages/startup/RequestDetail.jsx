// ==============================================================
// Financing Request Detail
// --------------------------------------------------------------
// Single request view with all fields, status timeline, and the
// "withdraw" action (only available while status is pending or
// under_review). Approved requests link to the contract.
// ==============================================================

import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, FileSignature } from "lucide-react";

import api, { errorMessage } from "../../lib/api";
import { useApi } from "../../lib/useApi";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import Button from "../../components/Button";
import { StatusBadge } from "../../components/Badge";
import Modal from "../../components/Modal";
import { LoadingScreen } from "../../components/Loading";
import { formatPKR, formatDate } from "../../lib/format";

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const { data, loading, error, refetch } = useApi(
    () => api.get(`/financing-requests/${id}`),
    [id]
  );

  if (loading) return <LoadingScreen message="Loading request…" />;
  if (error || !data?.data?.request) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center">
        <p className="text-ink-muted mb-4">{error || "Request not found."}</p>
        <Link to="/requests"><Button variant="secondary">Back to requests</Button></Link>
      </div>
    );
  }

  const r = data.data.request;
  const canWithdraw = ["pending", "under_review"].includes(r.status);

  const onWithdraw = async () => {
    setWithdrawing(true);
    try {
      await api.post(`/financing-requests/${id}/withdraw`);
      toast.success("Request withdrawn");
      navigate("/requests");
    } catch (err) {
      toast.error(errorMessage(err, "Could not withdraw request"));
      setWithdrawing(false);
      setShowWithdraw(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to="/requests"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-4"
      >
        <ArrowLeft size={14} />
        Back to requests
      </Link>

      <PageHeader
        eyebrow={r.requestId}
        title={`${r.vendorNameSnapshot} — ${r.planName}`}
        actions={<StatusBadge status={r.status} />}
      />

      {/* Status-specific banner */}
      {r.status === "approved" && r.contractId && (
        <Card variant="promoted" className="p-5 mb-6">
          <div className="flex items-start gap-3">
            <FileSignature className="text-lime shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Approved — contract ready to sign</p>
              <p className="text-sm text-ink-muted mb-3">
                Review the Murabaha terms and sign to activate your contract.
              </p>
              <Link to={`/contracts/${r.contractId}`}>
                <Button size="sm">View contract</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {r.status === "rejected" && (
        <Card className="p-5 mb-6 border-danger/30">
          <p className="text-sm font-medium text-danger mb-1">Request was not approved</p>
          {r.rejectionReason && (
            <p className="text-sm text-ink-muted">Reason: {r.rejectionReason}</p>
          )}
        </Card>
      )}

      <Card className="p-5 mb-6">
        <h2 className="text-base font-medium mb-4">Request details</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <Detail label="Vendor" value={r.vendorNameSnapshot} />
          <Detail label="Plan tier" value={r.planTier} />
          <Detail label="Annual amount" value={formatPKR(r.annualAmountPKR)} mono />
          <Detail label="Submitted" value={formatDate(r.createdAt)} mono />
          {r.reviewedAt && <Detail label="Reviewed" value={formatDate(r.reviewedAt)} mono />}
          {r.invoiceFileUrl && (
            <Detail
              label="Invoice"
              value={
                <a
                  href={r.invoiceFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lavender hover:text-lavender-dark underline-offset-2 hover:underline"
                >
                  View PDF
                </a>
              }
            />
          )}
        </dl>
        {r.notes && (
          <div className="mt-4 pt-4 border-t border-divider">
            <p className="text-xs text-ink-muted mb-1">Your note</p>
            <p className="text-sm leading-relaxed">{r.notes}</p>
          </div>
        )}
      </Card>

      {canWithdraw && (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => setShowWithdraw(true)}>
            Withdraw request
          </Button>
        </div>
      )}

      <Modal
        open={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        title="Withdraw this request?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowWithdraw(false)}>
              Keep request
            </Button>
            <Button variant="danger" onClick={onWithdraw} loading={withdrawing}>
              Yes, withdraw
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted leading-relaxed">
          The request will be marked as withdrawn and removed from the review queue.
          You can submit a new request anytime.
        </p>
      </Modal>
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
