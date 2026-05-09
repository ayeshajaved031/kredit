// ==============================================================
// Vendors browser
// --------------------------------------------------------------
// Grid of vendor cards. Search + category filter (client-side
// since the seed has only ~15 vendors; would paginate in prod).
// "Apply" button on each card pre-fills the application form.
// ==============================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ShoppingBag, ArrowRight } from "lucide-react";

import api from "../../lib/api";
import { useApi } from "../../lib/useApi";

import PageHeader from "../../components/PageHeader";
import Input from "../../components/Input";
import { Card } from "../../components/Card";
import Button from "../../components/Button";
import Badge from "../../components/Badge";
import { Spinner, EmptyState } from "../../components/Loading";

const CATEGORIES = [
  ["all", "All vendors"],
  ["cloud_infrastructure", "Cloud"],
  ["crm_sales", "CRM & sales"],
  ["productivity", "Productivity"],
  ["design", "Design"],
  ["communication", "Communication"],
  ["developer_tools", "Dev tools"],
  ["analytics", "Analytics"],
  ["database", "Database"],
];

export default function Vendors() {
  const { data, loading } = useApi(() => api.get("/vendors"), []);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const vendors = data?.data?.vendors || [];

  const filtered = useMemo(() => {
    let list = vendors;
    if (category !== "all") list = list.filter((v) => v.category === category);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [vendors, query, category]);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Vendors"
        subtitle="Pick a vendor and apply for financing on their annual plan."
      />

      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto sm:overflow-visible">
          {CATEGORIES.map(([v, l]) => (
            <button
              key={v}
              onClick={() => setCategory(v)}
              className={`
                shrink-0 px-3 py-2 text-xs rounded-md border whitespace-nowrap transition-colors
                ${category === v
                  ? "bg-surface border-lime text-lime"
                  : "bg-transparent border-divider text-ink-muted hover:bg-surface hover:text-ink"}
              `}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Spinner size={24} /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShoppingBag}
            title="No vendors match"
            message="Try a different search or category."
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => (
            <VendorCard key={v._id} vendor={v} />
          ))}
        </div>
      )}
    </div>
  );
}

function VendorCard({ vendor }) {
  return (
    <Card className="p-5 flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-md bg-lime-glow text-lime flex items-center justify-center font-mono text-sm font-semibold shrink-0">
          {vendor.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium truncate">{vendor.name}</p>
          <p className="text-xs text-ink-muted capitalize">
            {vendor.category?.replace(/_/g, " ")}
          </p>
        </div>
      </div>

      {vendor.description && (
        <p className="text-sm text-ink-muted mb-4 line-clamp-2 flex-1">
          {vendor.description}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {vendor.minAnnualAmountPKR > 0 && (
          <Badge tone="neutral" mono>
            MIN {formatCompactPKR(vendor.minAnnualAmountPKR)}
          </Badge>
        )}
        {vendor.maxAnnualAmountPKR > 0 && (
          <Badge tone="neutral" mono>
            MAX {formatCompactPKR(vendor.maxAnnualAmountPKR)}
          </Badge>
        )}
      </div>

      <Link to={`/apply?vendor=${vendor._id}`} className="block mt-auto">
        <Button size="sm" className="w-full">
          Apply for financing
          <ArrowRight size={14} />
        </Button>
      </Link>
    </Card>
  );
}

function formatCompactPKR(n) {
  const v = Number(n);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}
