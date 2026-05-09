// ==============================================================
// Admin Financing Request Queue
// --------------------------------------------------------------
// Same two-pane layout as KYC. Approve generates a draft contract
// (vendor isn't paid until startup signs). Reject sends an email
// with the reason.
// ==============================================================

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FileText, ExternalLink } from "lucide-react";

import api, { errorMessage } from "../../lib/api";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import Button from "../../components/Button";
import { StatusBadge } from "../../components/Badge";
import Modal from "../../components/Modal";
import { FormField, Textarea } from "../../components/Input";
import { Spinner, EmptyState } from "../../components/Loading";
import { formatPKR, formatDate } from "../../lib/format";

export default function RequestQueue() {
  const [filter, setFilter] = useState("pending");
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const url = filter === "all"
        ? "/admin/queue?limit=50"
        : `/admin/queue?status=${filter}&limit=50`;
      const res = await api.get(url);
      const items = res.data?.data?.requests || [];
      setList(items);
      if (selected) {
        const stillThere = items.find((r) => r._id === selected._id);
        setSelected(stillThere || items[0] || null);
      } else {
        setSelected(items[0] || null);
      }
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [filter]);

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Operations"
        title="Financing requests"
        subtitle="Review applications and approve to generate the Murabaha contract."
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {[
          ["pending", "Pending"],
          ["under_review", "Under review"],
          ["approved", "Approved"],
          ["rejected", "Rejected"],
          ["all", "All"],
        ].map(([v, l]) => (
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
        <div className="py-20 flex justify-center"><Spinner size={28} /></div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="No requests in this view"
            message={filter === "pending" ? "Queue is clear." : "Try another filter."}
          />
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[340px_1fr] gap-4">
          {/* List */}
          <Card className="overflow-hidden h-fit">
            <ul className="max-h-[600px] overflow-y-auto">
              {list.map((r) => (
                <li key={r._id}>
                  <button
                    onClick={() => setSelected(r)}
                    className={`block w-full text-left px-4 py-3 border-b border-divider last:border-0 transition-colors
                      ${selected?._id === r._id ? "bg-surface-2" : "hover:bg-surface-2/50"}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-mono text-xs text-ink-muted truncate">{r.requestId}</p>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="text-sm font-medium truncate">
                      {r.startupId?.companyName || "Unknown"}
                    </p>
                    <p className="text-xs text-ink-muted truncate mt-0.5">
                      {r.vendorNameSnapshot} · {formatPKR(r.annualAmountPKR)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {/* Detail */}
          {selected && (
            <RequestDetailPane
              request={selected}
              onApprove={() => setShowApprove(true)}
              onReject={() => setShowReject(true)}
            />
          )}
        </div>
      )}

      {selected && (
        <>
          <ApproveModal
            open={showApprove}
            onClose={() => setShowApprove(false)}
            request={selected}
            onDone={() => { setShowApprove(false); load(); }}
          />
          <RejectModal
            open={showReject}
            onClose={() => setShowReject(false)}
            request={selected}
            onDone={() => { setShowReject(false); load(); }}
          />
        </>
      )}
    </div>
  );
}

function RequestDetailPane({ request, onApprove, onReject }) {
  const r = request;
  const isReviewable = r.status === "pending" || r.status === "under_review";

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <p className="font-mono text-xs text-ink-muted">{r.requestId}</p>
          <h2 className="text-h3 font-medium mt-0.5">{r.planName}</h2>
        </div>
        <StatusBadge status={r.status} />
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm mb-6 pb-6 border-b border-divider">
        <Detail label="Startup" value={r.startupId?.companyName} />
        <Detail label="Vendor" value={r.vendorNameSnapshot} />
        <Detail label="Annual amount" value={formatPKR(r.annualAmountPKR)} mono />
        <Detail label="Plan tier" value={r.planTier} />
        <Detail label="Submitted" value={formatDate(r.createdAt)} mono />
        {r.invoiceFileUrl && (
          <Detail
            label="Invoice"
            value={
              <a
                href={r.invoiceFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-lavender hover:text-lavender-dark"
              >
                Open PDF <ExternalLink size={12} />
              </a>
            }
          />
        )}
      </dl>

      {r.notes && (
        <div className="mb-6">
          <p className="text-xs text-ink-muted mb-1.5">Note from the requester</p>
          <p className="text-sm leading-relaxed">{r.notes}</p>
        </div>
      )}

      {/* Murabaha preview */}
      <div className="bg-surface-2/40 border border-divider rounded-md p-4 mb-6">
        <p className="text-xs text-ink-muted mb-3">If approved at this amount</p>
        <MurabahaPreview principal={r.annualAmountPKR} />
      </div>

      {isReviewable && (
        <div className="flex gap-2 justify-end">
          <Button variant="danger" onClick={onReject}>Reject</Button>
          <Button onClick={onApprove}>Approve and generate contract</Button>
        </div>
      )}

      {r.status === "rejected" && r.rejectionReason && (
        <div className="mt-3 p-3 rounded-md bg-danger-soft border border-danger/30 text-sm">
          <p className="font-medium text-danger mb-0.5">Rejected</p>
          <p className="text-ink-muted">{r.rejectionReason}</p>
        </div>
      )}
    </Card>
  );
}

function MurabahaPreview({ principal }) {
  const markup = (Number(principal) * 10) / 100;
  const total = Number(principal) + markup;
  const inst = Math.floor(total / 12);
  return (
    <dl className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
      <Row label="Principal" value={formatPKR(principal)} />
      <Row label="Markup (10%)" value={formatPKR(markup)} />
      <Row label="Total payable" value={formatPKR(total)} bold />
      <Row label="Per installment" value={formatPKR(inst)} bold accent="lime" />
    </dl>
  );
}

function Row({ label, value, bold = false, accent }) {
  const color = accent === "lime" ? "text-lime" : "text-ink";
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={`font-mono ${bold ? "font-medium" : ""} ${color}`}>{value}</dd>
    </div>
  );
}

function ApproveModal({ open, onClose, request, onDone }) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/admin/financing-requests/${request._id}/approve`, {
        adminNote: note.trim() || undefined,
      });
      toast.success("Request approved — contract generated");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "Could not approve"));
    } finally { setSubmitting(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Approve and generate contract"
      subtitle="The startup will be notified to sign. No payment is sent until they sign."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={onSubmit} loading={submitting}>Approve</Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <div className="bg-surface-2/40 rounded-md border border-divider p-4 mb-4">
          <p className="text-xs text-ink-muted mb-2">Contract terms (locked at signing)</p>
          <MurabahaPreview principal={request.annualAmountPKR} />
        </div>
        <FormField label="Internal note" htmlFor="note" optional>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Risk profile, follow-up tasks, etc."
          />
        </FormField>
      </form>
    </Modal>
  );
}

function RejectModal({ open, onClose, request, onDone }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/admin/financing-requests/${request._id}/reject`, {
        reason: reason.trim(),
      });
      toast.success("Request rejected. The startup has been notified.");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally { setSubmitting(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reject request"
      subtitle="The startup will receive your reason via email."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="danger" onClick={onSubmit} loading={submitting} disabled={!reason.trim()}>
            Reject and notify
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FormField label="Reason" htmlFor="reason">
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={1000}
            autoFocus
            placeholder="Insufficient revenue history. Suggest reapplying with 6+ months of bank statements."
          />
        </FormField>
      </form>
    </Modal>
  );
}

function Detail({ label, value, mono = false }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted mb-0.5">{label}</dt>
      <dd className={`text-sm capitalize ${mono ? "font-mono" : ""}`}>{value || "—"}</dd>
    </div>
  );
}
