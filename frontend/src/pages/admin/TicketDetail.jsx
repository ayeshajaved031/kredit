// ==============================================================
// Admin Ticket Detail
// --------------------------------------------------------------
// Full reply thread + admin-only actions:
//   - Change status (open / in_progress / resolved / closed)
//   - Assign / unassign to an admin user
// Reply composer works the same as startup-side; the backend
// handles role-aware behavior automatically.
// ==============================================================

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Paperclip, Send, UserCog, CheckSquare } from "lucide-react";

import api, { errorMessage } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { useAuth } from "../../context/AuthContext";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/Badge";
import Button from "../../components/Button";
import { Textarea, Select, FormField } from "../../components/Input";
import Modal from "../../components/Modal";
import { LoadingScreen } from "../../components/Loading";
import { formatDate, formatRelative } from "../../lib/format";

export default function AdminTicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loading, error, refetch } = useApi(
    () => api.get(`/tickets/${id}`),
    [id]
  );

  const [reply, setReply] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  if (loading) return <LoadingScreen message="Loading ticket…" />;
  if (error || !data?.data?.ticket) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center">
        <p className="text-ink-muted mb-4">{error || "Ticket not found."}</p>
        <Link to="/admin/tickets"><Button variant="secondary">Back to queue</Button></Link>
      </div>
    );
  }

  const t = data.data.ticket;

  const onReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("message", reply.trim());
      if (file) fd.append("attachment", file);
      await api.post(`/tickets/${id}/replies`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setReply("");
      setFile(null);
      refetch();
      toast.success("Reply sent");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to="/admin/tickets"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-4"
      >
        <ArrowLeft size={14} />
        Back to queue
      </Link>

      <PageHeader
        eyebrow={t.ticketNumber}
        title={t.subject}
        subtitle={`From ${t.startupId?.companyName || "—"} · priority ${t.priority}`}
        actions={<StatusBadge status={t.status} />}
      />

      {/* Admin action row */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button size="sm" variant="secondary" onClick={() => setShowStatus(true)}>
          <CheckSquare size={14} />
          Change status
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowAssign(true)}>
          <UserCog size={14} />
          {t.assignedTo ? `Assigned: ${t.assignedTo.fullName}` : "Assign"}
        </Button>
      </div>

      {/* Original message */}
      <Card className="p-5 mb-4">
        <div className="flex items-start gap-3 mb-2">
          <Avatar name={t.openedBy?.fullName} role="startup" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-sm font-medium">{t.openedBy?.fullName}</p>
              <p className="text-xs text-ink-muted font-mono">{formatDate(t.createdAt)}</p>
            </div>
            <p className="text-xs text-ink-muted">{t.openedBy?.email}</p>
          </div>
        </div>
        <p className="text-sm whitespace-pre-wrap leading-relaxed mt-3">{t.description}</p>
        {t.initialAttachmentUrl && (
          <a href={t.initialAttachmentUrl} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1.5 text-xs text-lavender hover:text-lavender-dark mt-3">
            <Paperclip size={12} /> Attachment
          </a>
        )}
      </Card>

      {/* Replies */}
      <ul className="space-y-3 mb-6">
        {(t.replies || []).map((r, i) => {
          const isAdmin = r.authorRole === "admin";
          const isMe = r.authorId?._id === user?._id;
          return (
            <li key={i}>
              <Card className={`p-5 ${isAdmin ? "bg-lavender-glow/30" : ""}`}>
                <div className="flex items-start gap-3 mb-2">
                  <Avatar name={r.authorId?.fullName} role={r.authorRole} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-sm font-medium">
                        {isAdmin ? "Kredit Support" : r.authorId?.fullName}
                        {isMe && <span className="text-ink-muted text-xs ml-1.5">(you)</span>}
                      </p>
                      <p className="text-xs text-ink-muted font-mono">
                        {formatRelative(r.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed mt-3">{r.message}</p>
                {r.attachmentUrl && (
                  <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-1.5 text-xs text-lavender hover:text-lavender-dark mt-3">
                    <Paperclip size={12} /> Attachment
                  </a>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      {/* Composer */}
      {t.status !== "closed" && (
        <Card className="p-5">
          <form onSubmit={onReply} noValidate>
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Reply as Kredit Support…"
            />
            <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 text-xs text-ink-muted hover:text-ink cursor-pointer">
                <Paperclip size={14} />
                {file ? file.name : "Attach a file"}
                <input type="file" accept="image/*,application/pdf" className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              <Button type="submit" loading={submitting} disabled={!reply.trim()}>
                <Send size={14} />
                Send reply
              </Button>
            </div>
          </form>
        </Card>
      )}

      <StatusModal
        open={showStatus}
        onClose={() => setShowStatus(false)}
        ticket={t}
        onDone={() => { setShowStatus(false); refetch(); }}
      />
      <AssignModal
        open={showAssign}
        onClose={() => setShowAssign(false)}
        ticket={t}
        onDone={() => { setShowAssign(false); refetch(); }}
      />
    </div>
  );
}

function Avatar({ name, role }) {
  const initials = (name || "?").split(" ").slice(0, 2).map((p) => p[0] || "").join("").toUpperCase();
  return (
    <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium
      ${role === "admin" ? "bg-lavender text-lavender-ink" : "bg-surface-2 text-ink"}`}>
      {initials || "?"}
    </div>
  );
}

function StatusModal({ open, onClose, ticket, onDone }) {
  const [status, setStatus] = useState(ticket?.status || "open");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (open) setStatus(ticket?.status); }, [open, ticket]);

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      await api.patch(`/tickets/${ticket._id}/status`, { status });
      toast.success(`Status set to ${status.replace("_", " ")}`);
      onDone();
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change ticket status"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={onSubmit} loading={submitting}>Update status</Button>
        </>
      }
    >
      <FormField label="New status" htmlFor="ts">
        <Select id="ts" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </Select>
      </FormField>
      {status === "resolved" && (
        <p className="text-xs text-ink-muted mt-2">
          The startup will receive an email letting them know the ticket was resolved.
        </p>
      )}
    </Modal>
  );
}

function AssignModal({ open, onClose, ticket, onDone }) {
  const [admins, setAdmins] = useState([]);
  const [assignTo, setAssignTo] = useState(ticket?.assignedTo?._id || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAssignTo(ticket?.assignedTo?._id || "");
    (async () => {
      try {
        const res = await api.get("/admin/users?role=admin&limit=50");
        setAdmins(res.data?.data?.users || []);
      } catch { /* ignore */ }
    })();
  }, [open, ticket]);

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      await api.patch(`/tickets/${ticket._id}/assign`, {
        assignedTo: assignTo || null,
      });
      toast.success(assignTo ? "Ticket assigned" : "Ticket unassigned");
      onDone();
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign ticket"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={onSubmit} loading={submitting}>Save</Button>
        </>
      }
    >
      <FormField label="Assignee" htmlFor="asn">
        <Select id="asn" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
          <option value="">— Unassigned —</option>
          {admins.map((a) => (
            <option key={a._id} value={a._id}>{a.fullName}</option>
          ))}
        </Select>
      </FormField>
    </Modal>
  );
}
