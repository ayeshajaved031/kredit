// ==============================================================
// Ticket Detail
// --------------------------------------------------------------
// Original ticket + reply thread + reply composer.
// Resolved tickets show a "this is resolved" banner; replying as
// the requester re-opens the ticket (handled server-side).
// ==============================================================

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Paperclip, Send } from "lucide-react";

import api, { errorMessage } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { useAuth } from "../../context/AuthContext";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/Badge";
import Button from "../../components/Button";
import { Textarea } from "../../components/Input";
import { LoadingScreen } from "../../components/Loading";
import { formatDate, formatRelative } from "../../lib/format";

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loading, error, refetch } = useApi(
    () => api.get(`/tickets/${id}`),
    [id]
  );

  const [reply, setReply] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <LoadingScreen message="Loading ticket…" />;
  if (error || !data?.data?.ticket) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center">
        <p className="text-ink-muted mb-4">{error || "Ticket not found."}</p>
        <Link to="/tickets"><Button variant="secondary">Back to tickets</Button></Link>
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
      toast.error(errorMessage(err, "Could not send reply"));
    } finally {
      setSubmitting(false);
    }
  };

  const isClosed = t.status === "closed";

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to="/tickets"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-4"
      >
        <ArrowLeft size={14} />
        Back to tickets
      </Link>

      <PageHeader
        eyebrow={t.ticketNumber}
        title={t.subject}
        subtitle={`${t.category?.replace(/_/g, " ")} · priority ${t.priority}`}
        actions={<StatusBadge status={t.status} />}
      />

      {t.status === "resolved" && (
        <Card className="p-4 mb-6 bg-emerald-500/5 border-emerald-500/30">
          <p className="text-sm">
            This ticket is marked as resolved. Replying will re-open it.
          </p>
        </Card>
      )}

      {/* Original message */}
      <Card className="p-5 mb-4">
        <div className="flex items-start gap-3 mb-2">
          <Avatar name={t.openedBy?.fullName || "?"} role="startup" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-sm font-medium">{t.openedBy?.fullName}</p>
              <p className="text-xs text-ink-muted font-mono">{formatDate(t.createdAt)}</p>
            </div>
            <p className="text-xs text-ink-muted">opened the ticket</p>
          </div>
        </div>
        <p className="text-sm whitespace-pre-wrap leading-relaxed mt-3">{t.description}</p>
        {t.initialAttachmentUrl && (
          <a
            href={t.initialAttachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-lavender hover:text-lavender-dark mt-3"
          >
            <Paperclip size={12} />
            View attachment
          </a>
        )}
      </Card>

      {/* Replies */}
      <ul className="space-y-3 mb-6">
        {(t.replies || []).map((r, i) => {
          const isMe = r.authorId?._id === user?._id;
          const isAdmin = r.authorRole === "admin";
          return (
            <li key={i}>
              <Card className={`p-5 ${isAdmin ? "bg-lavender-glow/30" : ""}`}>
                <div className="flex items-start gap-3 mb-2">
                  <Avatar name={r.authorId?.fullName || "?"} role={r.authorRole} />
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
                  <a
                    href={r.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-lavender hover:text-lavender-dark mt-3"
                  >
                    <Paperclip size={12} />
                    Attachment
                  </a>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      {/* Composer */}
      {!isClosed && (
        <Card className="p-5">
          <form onSubmit={onReply} noValidate>
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Type your reply…"
            />
            <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
              <label
                className="inline-flex items-center gap-2 text-xs text-ink-muted hover:text-ink cursor-pointer"
              >
                <Paperclip size={14} />
                {file ? file.name : "Attach a file"}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              <Button type="submit" loading={submitting} disabled={!reply.trim()}>
                <Send size={14} />
                Send reply
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isClosed && (
        <Card className="p-4 text-center">
          <p className="text-sm text-ink-muted">
            This ticket is closed. Open a new ticket if you need further help.
          </p>
        </Card>
      )}
    </div>
  );
}

function Avatar({ name, role }) {
  const initials = (name || "?").split(" ").slice(0, 2).map((p) => p[0] || "").join("").toUpperCase();
  const isAdmin = role === "admin";
  return (
    <div
      className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium ${
        isAdmin ? "bg-lavender text-lavender-ink" : "bg-surface-2 text-ink"
      }`}
    >
      {initials || "?"}
    </div>
  );
}
