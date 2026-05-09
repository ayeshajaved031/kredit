// ==============================================================
// Admin Users
// --------------------------------------------------------------
// List of all users with role + status. Block/unblock with a
// confirm modal that captures the reason for blocking.
// ==============================================================

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Search, Users, ShieldAlert } from "lucide-react";

import api, { errorMessage } from "../../lib/api";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import Input, { FormField, Textarea } from "../../components/Input";
import Button from "../../components/Button";
import Badge from "../../components/Badge";
import Modal from "../../components/Modal";
import { Spinner, EmptyState } from "../../components/Loading";
import { formatDate } from "../../lib/format";

export default function AdminUsers() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ role: "all", status: "all" });
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState(null);
  const [action, setAction] = useState(null); // 'block' | 'unblock'

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.role !== "all") params.set("role", filter.role);
      if (filter.status !== "all") params.set("status", filter.status);
      if (query.trim()) params.set("search", query.trim());
      params.set("limit", 50);
      const res = await api.get(`/admin/users?${params}`);
      setList(res.data?.data?.users || []);
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [filter.role, filter.status]);

  const onSearch = (e) => {
    e.preventDefault();
    load();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Catalog"
        title="Users"
        subtitle="All accounts on the platform — startups and admins."
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <form onSubmit={onSearch} className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
          />
        </form>
        <div className="flex gap-2">
          {[["all", "All"], ["startup", "Startups"], ["admin", "Admins"]].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter((f) => ({ ...f, role: v }))}
              className={`px-3 py-1.5 text-xs rounded-md border whitespace-nowrap transition-colors
                ${filter.role === v
                  ? "bg-surface border-lime text-lime"
                  : "bg-transparent border-divider text-ink-muted hover:bg-surface hover:text-ink"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        {[["all", "All statuses"], ["active", "Active"], ["pending", "Pending"], ["blocked", "Blocked"]].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter((f) => ({ ...f, status: v }))}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors
              ${filter.status === v
                ? "bg-surface border-lavender text-lavender"
                : "bg-transparent border-divider text-ink-muted hover:bg-surface hover:text-ink"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Spinner size={24} /></div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No users match"
            message="Try adjusting filters or search."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {list.map((u) => (
              <li
                key={u._id}
                className="flex items-center gap-4 px-5 py-4 border-b border-divider last:border-0"
              >
                <Avatar name={u.fullName} role={u.role} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{u.fullName}</p>
                    {u.role === "admin" && <Badge tone="lavender" mono>ADMIN</Badge>}
                    {u.status === "blocked" && <Badge tone="danger" mono>BLOCKED</Badge>}
                    {u.status === "pending" && <Badge tone="warn" mono>PENDING</Badge>}
                    {!u.emailVerified && <Badge tone="neutral" mono>UNVERIFIED EMAIL</Badge>}
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5 font-mono truncate">
                    {u.email}
                  </p>
                  <p className="text-xs text-ink-faint mt-0.5">
                    Joined {formatDate(u.createdAt)}
                  </p>
                </div>
                <div className="shrink-0">
                  {u.status === "blocked" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => { setTarget(u); setAction("unblock"); }}
                    >
                      Unblock
                    </Button>
                  ) : u.role === "startup" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setTarget(u); setAction("block"); }}
                    >
                      <ShieldAlert size={14} />
                      Block
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <BlockModal
        open={action === "block" && !!target}
        onClose={() => { setAction(null); setTarget(null); }}
        user={target}
        onDone={() => { setAction(null); setTarget(null); load(); }}
      />
      <UnblockModal
        open={action === "unblock" && !!target}
        onClose={() => { setAction(null); setTarget(null); }}
        user={target}
        onDone={() => { setAction(null); setTarget(null); load(); }}
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

function BlockModal({ open, onClose, user, onDone }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (open) setReason(""); }, [open]);

  if (!user) return null;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/admin/users/${user._id}/block`, { reason: reason.trim() });
      toast.success(`${user.fullName} has been blocked`);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally { setSubmitting(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Block ${user.fullName}?`}
      subtitle="They'll lose immediate access to the platform and receive an email."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="danger" onClick={onSubmit} loading={submitting} disabled={!reason.trim()}>
            Block account
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FormField label="Reason" htmlFor="block-reason">
          <Textarea
            id="block-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Suspected fraud / repeated payment failures / contract violation"
          />
        </FormField>
      </form>
    </Modal>
  );
}

function UnblockModal({ open, onClose, user, onDone }) {
  const [submitting, setSubmitting] = useState(false);
  if (!user) return null;
  const onSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post(`/admin/users/${user._id}/unblock`);
      toast.success(`${user.fullName} unblocked`);
      onDone();
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setSubmitting(false); }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Unblock ${user.fullName}?`}
      subtitle="They'll regain access to the platform."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={onSubmit} loading={submitting}>Unblock</Button>
        </>
      }
    >
      <p className="text-sm text-ink-muted">Are you sure you want to lift this block?</p>
    </Modal>
  );
}
