// ==============================================================
// Admin Dashboard
// --------------------------------------------------------------
// Top-of-funnel admin view. Pulls /admin/reports/portfolio-overview
// (the heavy aggregation), /admin/reports/monthly-disbursement
// (chart data), plus the pending KYC + request counts. Renders:
//
//   - Welcome strip with portfolio money totals
//   - 4 KPI metric cards
//   - Monthly disbursement vs collection chart (lime + lavender)
//   - "Needs your attention" panel: KYC + request queues
// ==============================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";

import api from "../../lib/api";
import PageHeader from "../../components/PageHeader";
import { Card, MetricCard } from "../../components/Card";
import Button from "../../components/Button";
import { Spinner } from "../../components/Loading";
import { formatPKR, formatPKRCompact } from "../../lib/format";

export default function AdminDashboard() {
  const [data, setData] = useState({
    overview: null, monthly: null, kycQueue: 0, requestQueue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [oRes, mRes, kRes, rRes] = await Promise.all([
          api.get("/admin/reports/portfolio-overview"),
          api.get("/admin/reports/monthly-disbursement?months=6"),
          api.get("/admin/startups?kycStatus=under_review&limit=1"),
          api.get("/admin/queue?limit=1"),
        ]);
        if (!alive) return;
        setData({
          overview: oRes.data?.data,
          monthly: mRes.data?.data,
          kycQueue: kRes.data?.data?.total || 0,
          requestQueue: rRes.data?.data?.total || 0,
        });
      } catch { /* ignored — empty states cover */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  const o = data.overview || {};
  const portfolio = o.portfolio || {};
  const contracts = o.contracts || {};
  const startups = o.startups || {};

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Operations"
        title="Admin dashboard"
        subtitle="Portfolio health and items needing your attention."
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard
          label="Deployed"
          value={formatPKRCompact(portfolio.totalPrincipalDeployed || 0)}
          accent="lime"
          hint={`${contracts.active || 0} active contracts`}
        />
        <MetricCard
          label="Collected"
          value={formatPKRCompact(portfolio.totalCollected || 0)}
          accent="lavender"
          hint={`of ${formatPKRCompact(portfolio.totalPayable || 0)}`}
        />
        <MetricCard
          label="Outstanding"
          value={formatPKRCompact(portfolio.outstanding || 0)}
          hint={`${portfolio.overdueInstallments || 0} overdue installments`}
        />
        <MetricCard
          label="Default rate"
          value={`${(contracts.defaultRatePct || 0).toFixed(1)}%`}
          accent={contracts.defaultRatePct > 5 ? "default" : "default"}
          hint={`${contracts.defaulted || 0} defaulted`}
        />
      </div>

      {/* Monthly chart */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div>
            <h2 className="text-base font-medium">Last 6 months</h2>
            <p className="text-xs text-ink-muted mt-0.5">Vendor disbursements vs startup collections</p>
          </div>
          <div className="flex gap-4 text-xs">
            <LegendDot color="#C6FF3B" label="Disbursed" />
            <LegendDot color="#B197FC" label="Collected" />
          </div>
        </div>
        <DisbursementChart series={data.monthly?.series || []} />
      </Card>

      {/* Action queues */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <QueueCard
          icon={ShieldCheck}
          title="KYC review queue"
          count={data.kycQueue}
          link="/admin/kyc"
          ctaLabel="Review submissions"
          emptyMessage="No KYC submissions pending."
        />
        <QueueCard
          icon={FileText}
          title="Financing requests"
          count={data.requestQueue}
          link="/admin/requests"
          ctaLabel="Open queue"
          emptyMessage="No requests awaiting review."
        />
      </div>

      {/* Detail tiles */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-4">Contracts by status</h3>
          <StatusGrid
            items={[
              ["Active", contracts.active || 0, "text-emerald-400"],
              ["Completed", contracts.completed || 0, "text-lavender"],
              ["Draft (unsigned)", contracts.draft || 0, "text-amber-400"],
              ["Defaulted", contracts.defaulted || 0, "text-danger"],
            ]}
          />
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-4">Startups by KYC</h3>
          <StatusGrid
            items={[
              ["Verified", startups.verified || 0, "text-emerald-400"],
              ["Under review", startups.under_review || 0, "text-amber-400"],
              ["Unverified", startups.unverified || 0, "text-ink-muted"],
              ["Rejected", startups.rejected || 0, "text-danger"],
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-muted">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function DisbursementChart({ series }) {
  if (!series.length) return <p className="text-sm text-ink-muted py-8 text-center">No data yet.</p>;
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <BarChart data={series} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2F3A" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="#9BA3AF"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            fontFamily="JetBrains Mono"
          />
          <YAxis
            stroke="#9BA3AF"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatPKRCompact(v)}
            fontSize={11}
            fontFamily="JetBrains Mono"
          />
          <Tooltip
            contentStyle={{
              background: "#171A21",
              border: "1px solid #2A2F3A",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#F5F7FA", fontFamily: "JetBrains Mono" }}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            formatter={(v) => formatPKR(v)}
          />
          <Bar dataKey="totalDisbursed" name="Disbursed" fill="#C6FF3B" radius={[4, 4, 0, 0]} />
          <Bar dataKey="totalCollected" name="Collected" fill="#B197FC" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function QueueCard({ icon: Icon, title, count, link, ctaLabel, emptyMessage }) {
  return (
    <Card variant={count > 0 ? "promoted" : "default"} className="p-5">
      <div className="flex items-start gap-3">
        <Icon size={20} className={count > 0 ? "text-lime mt-0.5" : "text-ink-muted mt-0.5"} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium mb-1">{title}</p>
          {count > 0 ? (
            <>
              <p className="font-mono text-h2 font-medium mb-3">{count}</p>
              <Link to={link}>
                <Button size="sm">
                  {ctaLabel}
                  <ArrowRight size={14} />
                </Button>
              </Link>
            </>
          ) : (
            <p className="text-sm text-ink-muted">{emptyMessage}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function StatusGrid({ items }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(([label, value, color]) => (
        <div key={label} className="bg-surface-2/40 border border-divider rounded-md px-3 py-2.5">
          <p className="text-xs text-ink-muted mb-1">{label}</p>
          <p className={`font-mono text-lg font-medium ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}
