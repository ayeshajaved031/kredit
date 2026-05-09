// ==============================================================
// Payment Detail
// --------------------------------------------------------------
// Shows a single payment with all metadata. For successful
// payments, offers a receipt download.
// ==============================================================

import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, CheckCircle2, XCircle } from "lucide-react";
import toast from "react-hot-toast";

import api, { getToken } from "../../lib/api";
import { useApi } from "../../lib/useApi";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import Button from "../../components/Button";
import { StatusBadge } from "../../components/Badge";
import { LoadingScreen } from "../../components/Loading";
import { formatPKR, formatDate } from "../../lib/format";

export default function PaymentDetail() {
  const { id } = useParams();
  const { data, loading, error } = useApi(
    () => api.get(`/payments/${id}`),
    [id]
  );

  if (loading) return <LoadingScreen message="Loading payment…" />;
  if (error || !data?.data?.payment) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center">
        <p className="text-ink-muted mb-4">{error || "Payment not found."}</p>
        <Link to="/payments"><Button variant="secondary">Back to payments</Button></Link>
      </div>
    );
  }

  const p = data.data.payment;
  const isSuccess = p.status === "successful";
  const isFailed = p.status === "failed";

  // For receipt download we need the auth header on the request.
  // Construct a fetch that streams the body to a blob URL.
  const downloadReceipt = async () => {
    try {
      const url = `${import.meta.env.VITE_API_URL || ""}/api/payments/${id}/receipt`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${p.paymentId}-receipt.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Could not download receipt");
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to="/payments"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-4"
      >
        <ArrowLeft size={14} />
        Back to payments
      </Link>

      <PageHeader
        eyebrow={p.paymentId}
        title={isSuccess ? "Payment receipt" : "Payment details"}
        actions={<StatusBadge status={p.status} />}
      />

      {/* Hero card */}
      <Card variant={isSuccess ? "promoted" : "default"} className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          {isSuccess && <CheckCircle2 size={24} className="text-lime" />}
          {isFailed && <XCircle size={24} className="text-danger" />}
          <p className="text-sm text-ink-muted">
            {isSuccess
              ? "Payment was successful"
              : isFailed
              ? "Payment failed at the gateway"
              : "Payment is pending"}
          </p>
        </div>
        <p className="font-mono text-display font-medium tracking-tight mb-1">
          {formatPKR(p.amount)}
        </p>
        <p className="font-mono text-sm text-ink-muted">
          {formatDate(p.createdAt)} · {p.method}
        </p>
      </Card>

      {/* Detail grid */}
      <Card className="p-5 mb-6">
        <h2 className="text-base font-medium mb-4">Details</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <Detail label="Payment ID" value={p.paymentId} mono />
          <Detail label="Method" value={p.method} />
          <Detail label="Initiated by" value={p.initiatedBy} />
          <Detail label="Gateway reference" value={p.gatewayReference} mono />
          {p.contractId && (
            <>
              <Detail
                label="Contract"
                value={
                  <Link
                    to={`/contracts/${p.contractId._id || p.contractId}`}
                    className="text-lavender hover:text-lavender-dark font-mono"
                  >
                    {p.contractId.contractId || p.contractId}
                  </Link>
                }
              />
            </>
          )}
          {p.scheduleId && (
            <Detail
              label="Installment"
              value={`#${p.scheduleId.installmentNumber || "—"}`}
              mono
            />
          )}
          {isFailed && p.failureReason && (
            <div className="sm:col-span-2">
              <Detail label="Failure reason" value={p.failureReason} />
            </div>
          )}
        </dl>
      </Card>

      {isSuccess && (
        <div className="flex justify-end">
          <Button onClick={downloadReceipt}>
            <Download size={16} />
            Download receipt
          </Button>
        </div>
      )}
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
