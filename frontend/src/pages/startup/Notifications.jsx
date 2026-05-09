// ==============================================================
// Notifications
// --------------------------------------------------------------
// List with: filter (all / unread), mark-all-read, per-item
// mark-as-read on click, optional delete. Each item links to its
// related entity (contract/payment/ticket) when actionUrl is set.
// ==============================================================

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Bell, CheckCheck, Trash2, FileSignature, Wallet,
  MessageSquare, FileText, AlertCircle, ShieldCheck,
} from "lucide-react";

import api, { errorMessage } from "../../lib/api";
import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import Button from "../../components/Button";
import { Spinner, EmptyState } from "../../components/Loading";
import { formatRelative } from "../../lib/format";

const TYPE_ICON = {
  payment: Wallet,
  contract: FileSignature,
  ticket: MessageSquare,
  financing_request: FileText,
  kyc: ShieldCheck,
  account: AlertCircle,
  system: AlertCircle,
};

const SEVERITY_COLOR = {
  success: "text-emerald-400",
  error: "text-danger",
  warning: "text-amber-400",
  info: "text-lavender",
};

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [unread, setUnread] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/notifications?limit=100");
      setItems(res.data?.data?.notifications || []);
      setUnread(res.data?.data?.unreadCount || 0);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    if (filter === "unread") return items.filter((n) => !n.readStatus);
    return items;
  }, [items, filter]);

  const markRead = async (id) => {
    setItems((cur) => cur.map((n) => (n._id === id ? { ...n, readStatus: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try { await api.patch(`/notifications/${id}/read`); }
    catch { /* optimistic; server is source of truth on next load */ }
  };

  const markAllRead = async () => {
    setItems((cur) => cur.map((n) => ({ ...n, readStatus: true })));
    setUnread(0);
    try {
      await api.patch("/notifications/read-all");
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error(errorMessage(err));
      load();
    }
  };

  const remove = async (id) => {
    setItems((cur) => cur.filter((n) => n._id !== id));
    try { await api.delete(`/notifications/${id}`); }
    catch (err) { toast.error(errorMessage(err)); load(); }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : "All caught up"}
        actions={
          unread > 0 && (
            <Button variant="secondary" size="sm" onClick={markAllRead}>
              <CheckCheck size={14} />
              Mark all read
            </Button>
          )
        }
      />

      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 text-xs rounded-md border transition-colors
            ${filter === "all"
              ? "bg-surface border-lime text-lime"
              : "bg-transparent border-divider text-ink-muted hover:bg-surface hover:text-ink"}`}
        >
          All <span className="ml-1.5 font-mono text-ink-faint">{items.length}</span>
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-3 py-1.5 text-xs rounded-md border transition-colors
            ${filter === "unread"
              ? "bg-surface border-lime text-lime"
              : "bg-transparent border-divider text-ink-muted hover:bg-surface hover:text-ink"}`}
        >
          Unread <span className="ml-1.5 font-mono text-ink-faint">{unread}</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Spinner size={24} /></div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bell}
            title={filter === "unread" ? "No unread notifications" : "No notifications yet"}
            message={
              filter === "unread"
                ? "You've read everything."
                : "We'll let you know about KYC updates, payments, and contract activity."
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {visible.map((n) => (
              <NotificationRow
                key={n._id}
                notification={n}
                onMarkRead={markRead}
                onDelete={remove}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function NotificationRow({ notification: n, onMarkRead, onDelete }) {
  const Icon = TYPE_ICON[n.type] || Bell;
  const sevColor = SEVERITY_COLOR[n.severity] || "text-ink-muted";

  const inner = (
    <div className="flex items-start gap-3 px-5 py-4">
      <div className={`shrink-0 w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center ${sevColor}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug">{n.title}</p>
          {!n.readStatus && (
            <span className="shrink-0 w-2 h-2 rounded-full bg-lime mt-1.5" aria-label="Unread" />
          )}
        </div>
        {n.message && (
          <p className="text-sm text-ink-muted mt-1 leading-relaxed">{n.message}</p>
        )}
        <p className="text-xs text-ink-faint font-mono mt-1.5">
          {formatRelative(n.createdAt)}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete(n._id);
        }}
        className="shrink-0 p-1 -m-1 text-ink-faint hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Delete"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );

  const baseRow = (
    <li className={`group border-b border-divider last:border-0 transition-colors ${
      n.readStatus ? "" : "bg-surface-2/30"
    } hover:bg-surface-2/50`}>
      {inner}
    </li>
  );

  if (n.actionUrl) {
    return (
      <li className={`group border-b border-divider last:border-0 transition-colors ${
        n.readStatus ? "" : "bg-surface-2/30"
      } hover:bg-surface-2/50`}>
        <Link
          to={n.actionUrl}
          onClick={() => { if (!n.readStatus) onMarkRead(n._id); }}
          className="block"
        >
          {inner}
        </Link>
      </li>
    );
  }
  return baseRow;
}
