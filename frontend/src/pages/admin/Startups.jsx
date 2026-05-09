// ==============================================================
// Admin Startups directory
// --------------------------------------------------------------
// Read-only browse of every startup on the platform with KYC and
// credit utilization at a glance. Most actions live elsewhere
// (KYC review, user blocking) — this is purely a directory.
// ==============================================================

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Search, Building2 } from "lucide-react";

import api, { errorMessage } from "../../lib/api";
import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import Input from "../../components/Input";
import { StatusBadge } from "../../components/Badge";
import { Spinner, EmptyState } from "../../components/Loading";
import { formatPKR, formatDate } from "../../lib/format";

export default function AdminStartups() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (submitted.trim()) params.set("search", submitted.trim());
      params.set("limit", "50");
      const res = await api.get(`/admin/startups?${params}`);
      setList(res.data?.data?.startups || []);
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [submitted]);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Catalog"
        title="Startups"
        subtitle="All companies registered on Kredit."
      />

      <form
        className="relative mb-5"
        onSubmit={(e) => { e.preventDefault(); setSubmitted(query); }}
      >
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by company name or registration number…"
          className="pl-9"
        />
      </form>

      {loading ? (
        <div className="py-12 flex justify-center"><Spinner size={24} /></div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No startups match"
            message={submitted ? "Try a different search term." : "No startups have signed up yet."}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {list.map((s) => {
              const used = Number(s.usedCredit) || 0;
              const limit = Number(s.approvedCreditLimit) || 0;
              const utilization = limit > 0 ? (used / limit) * 100 : 0;
              return (
                <li key={s._id} className="px-5 py-4 border-b border-divider last:border-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-base font-medium truncate">{s.companyName}</p>
                        <StatusBadge status={s.kycStatus} />
                      </div>
                      <p className="text-xs text-ink-muted font-mono">
                        {s.registrationType} {s.registrationNumber}
                      </p>
                      <p className="text-xs text-ink-faint mt-1">
                        Joined {formatDate(s.createdAt)} · Industry: {s.industry?.replace(/_/g, " ") || "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-ink-muted">Credit utilization</p>
                      <p className="font-mono text-sm font-medium">
                        {formatPKR(used)} / {formatPKR(limit)}
                      </p>
                      {limit > 0 && (
                        <div className="w-32 h-1 bg-divider rounded mt-1 ml-auto overflow-hidden">
                          <div
                            className="h-full bg-lavender"
                            style={{ width: `${Math.min(100, utilization)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
