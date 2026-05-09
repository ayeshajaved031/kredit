// ==============================================================
// Admin KYC Review
// --------------------------------------------------------------
// Two-pane layout: left list of startups under review, right
// pane shows the selected startup's documents + decision actions.
//
// Approve modal asks for credit limit + optional note.
// Reject modal asks for a reason (sent to user's email).
// ==============================================================

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ShieldCheck, ExternalLink } from "lucide-react";

import api, { errorMessage } from "../../lib/api";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import Button from "../../components/Button";
import { StatusBadge } from "../../components/Badge";
import Modal from "../../components/Modal";
import Input, { FormField, Textarea } from "../../components/Input";
import { Spinner, EmptyState } from "../../components/Loading";
import { formatDate } from "../../lib/format";

const KYC_DOC_LABELS = {
  incorporation: "Certificate of incorporation",
  ntnCertificate: "NTN certificate",
  bankStatement: "Bank statement",
  ownerCnic: "Owner CNIC",
};

export default function KycReview() {
  const [filter, setFilter] = useState("under_review");
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/startups?kycStatus=${filter}&limit=50`);
      const items = res.data?.data?.startups || [];
      setList(items);
      // Keep current selection if still in list
      if (selected) {
        const stillThere = items.find((s) => s._id === selected._id);
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
        title="KYC review"
        subtitle="Verify documents, approve credit limits, or send back with feedback."
      />

      <div className="flex gap-2 mb-5">
        {[["under_review", "Under review"], ["unverified", "Unverified"], ["verified", "Verified"], ["rejected", "Rejected"]].map(([v, l]) => (
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
            icon={ShieldCheck}
            title="Nothing to review"
            message={
              filter === "under_review"
                ? "All caught up — no startups currently awaiting KYC review."
                : `No startups with status "${filter.replace("_", " ")}".`
            }
          />
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[320px_1fr] gap-4">
          {/* List */}
          <Card className="overflow-hidden h-fit">
            <ul className="max-h-[600px] overflow-y-auto">
              {list.map((s) => (
                <li key={s._id}>
                  <button
                    onClick={() => setSelected(s)}
                    className={`block w-full text-left px-4 py-3 border-b border-divider last:border-0 transition-colors
                      ${selected?._id === s._id ? "bg-surface-2" : "hover:bg-surface-2/50"}`}
                  >
                    <p className="text-sm font-medium truncate">{s.companyName}</p>
                    <p className="text-xs text-ink-muted font-mono mt-0.5">
                      {s.registrationType} {s.registrationNumber}
                    </p>
                    <p className="text-xs text-ink-faint mt-1">
                      Submitted {formatDate(s.kycSubmittedAt || s.createdAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {/* Detail pane */}
          {selected ? (
            <DetailPane
              startup={selected}
              onApprove={() => setShowApprove(true)}
              onReject={() => setShowReject(true)}
            />
          ) : (
            <Card className="p-10 text-center text-ink-muted">
              Pick a startup from the list to review their documents.
            </Card>
          )}
        </div>
      )}

      {selected && (
        <>
          <ApproveModal
            open={showApprove}
            onClose={() => setShowApprove(false)}
            startup={selected}
            onDone={() => { setShowApprove(false); load(); }}
          />
          <RejectModal
            open={showReject}
            onClose={() => setShowReject(false)}
            startup={selected}
            onDone={() => { setShowReject(false); load(); }}
          />
        </>
      )}
    </div>
  );
}

function DetailPane({ startup, onApprove, onReject }) {
  const docs = startup.kycDocuments || {};
  const isReviewable = startup.kycStatus === "under_review" || startup.kycStatus === "unverified";

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-h3 font-medium">{startup.companyName}</h2>
          <p className="text-sm text-ink-muted mt-1">
            {startup.industry?.replace(/_/g, " ")} · {startup.teamSize} people
          </p>
        </div>
        <StatusBadge status={startup.kycStatus} />
      </div>

      <dl className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm mb-6 pb-6 border-b border-divider">
        <Detail label="Registration" value={`${startup.registrationType} ${startup.registrationNumber}`} mono />
        <Detail label="Email" value={startup.userId?.email || "—"} mono />
        <Detail
          label="Address"
          value={[startup.address?.street, startup.address?.city, startup.address?.province].filter(Boolean).join(", ")}
        />
        {startup.annualRevenuePKR > 0 && (
          <Detail label="Annual revenue" value={`PKR ${Number(startup.annualRevenuePKR).toLocaleString("en-PK")}`} mono />
        )}
      </dl>

      <h3 className="text-sm font-medium mb-3">Submitted documents</h3>
      <div className="space-y-2 mb-6">
        {Object.entries(KYC_DOC_LABELS).map(([key, label]) => {
          const cur = docs[key];
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-3 px-3 py-2.5 bg-surface-2/40 rounded-md border border-divider"
            >
              <div className="min-w-0">
                <p className="text-sm">{label}</p>
                {cur?.uploadedAt && (
                  <p className="text-xs text-ink-faint font-mono">
                    Uploaded {formatDate(cur.uploadedAt)}
                  </p>
                )}
              </div>
              {cur?.url ? (
                <a
                  href={cur.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-lavender hover:text-lavender-dark"
                >
                  Open <ExternalLink size={12} />
                </a>
              ) : (
                <span className="text-xs text-ink-faint">Missing</span>
              )}
            </div>
          );
        })}
      </div>

      {isReviewable && (
        <div className="flex gap-2 justify-end">
          <Button variant="danger" onClick={onReject}>Reject</Button>
          <Button onClick={onApprove}>Approve</Button>
        </div>
      )}
      {startup.kycStatus === "rejected" && startup.kycRejectionReason && (
        <div className="mt-3 p-3 rounded-md bg-danger-soft border border-danger/30 text-sm">
          <p className="font-medium text-danger mb-0.5">Previously rejected</p>
          <p className="text-ink-muted">{startup.kycRejectionReason}</p>
        </div>
      )}
    </Card>
  );
}

function ApproveModal({ open, onClose, startup, onDone }) {
  const [credit, setCredit] = useState(2_000_000);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/admin/startups/${startup._id}/kyc/approve`, {
        approvedCreditLimit: Number(credit),
        note: note.trim() || undefined,
      });
      toast.success(`KYC approved for ${startup.companyName}`);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "Could not approve"));
    } finally { setSubmitting(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Approve KYC"
      subtitle={`Set credit limit for ${startup.companyName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={onSubmit} loading={submitting}>Approve</Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FormField label="Approved credit limit (PKR)" htmlFor="credit" hint="Maximum total principal across active contracts">
          <Input
            id="credit"
            type="number"
            min={0}
            value={credit}
            onChange={(e) => setCredit(e.target.value)}
            mono
            autoFocus
          />
        </FormField>
        <FormField label="Internal note" htmlFor="note" optional>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Anything noteworthy about this approval"
          />
        </FormField>
      </form>
    </Modal>
  );
}

function RejectModal({ open, onClose, startup, onDone }) {
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
      await api.post(`/admin/startups/${startup._id}/kyc/reject`, {
        reason: reason.trim(),
      });
      toast.success("KYC rejected. The startup has been notified.");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally { setSubmitting(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reject KYC"
      subtitle={`The reason will be emailed to ${startup.companyName}.`}
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
        <FormField
          label="Reason for rejection"
          htmlFor="reason"
          hint="Be specific so they can fix and resubmit"
        >
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={1000}
            autoFocus
            placeholder="The bank statement is from a personal account. Please re-upload the corporate account statement."
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
