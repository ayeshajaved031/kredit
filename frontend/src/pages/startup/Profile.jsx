// ==============================================================
// Profile + KYC Upload
// --------------------------------------------------------------
// Three sections:
//   1. KYC documents (upload 4 docs: incorporation, NTN, bank, ID)
//   2. Company details (read-only display from registration)
//   3. Change password
//
// File uploads are individual — one POST per file. The backend
// PATCHes the startup's kycDocuments object and changes status
// to under_review automatically when complete.
// ==============================================================

import { useState } from "react";
import toast from "react-hot-toast";
import {
  CheckCircle2, Circle, FileText, KeyRound, Upload,
} from "lucide-react";

import api, { errorMessage } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import Button from "../../components/Button";
import Input, { FormField } from "../../components/Input";
import { StatusBadge } from "../../components/Badge";
import { formatDate } from "../../lib/format";

const KYC_DOCS = [
  { key: "incorporation", label: "Certificate of incorporation", hint: "SECP or registration body" },
  { key: "ntnCertificate", label: "NTN certificate", hint: "FBR-issued tax registration" },
  { key: "bankStatement", label: "Bank statement", hint: "Last 3 months" },
  { key: "ownerCnic", label: "Owner CNIC", hint: "Both sides combined into one PDF/image" },
];

export default function Profile() {
  const { user, startup, setStartup, refresh } = useAuth();

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Company profile"
        subtitle="Manage your KYC documents and account."
      />

      <KycSection startup={startup} setStartup={setStartup} refresh={refresh} />
      <CompanySection startup={startup} />
      <PasswordSection />
    </div>
  );
}

// ---------- KYC ----------
function KycSection({ startup, setStartup, refresh }) {
  const [uploading, setUploading] = useState({});

  if (!startup) return null;

  const submitFile = async (key, file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }
    setUploading((s) => ({ ...s, [key]: true }));
    try {
      const fd = new FormData();
      fd.append("documentType", key);
      fd.append("file", file);
      const res = await api.post("/startup/me/kyc-documents", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const updated = res.data?.data?.startup;
      if (updated) setStartup(updated);
      toast.success(`${KYC_DOCS.find((d) => d.key === key)?.label} uploaded`);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err, "Upload failed"));
    } finally {
      setUploading((s) => ({ ...s, [key]: false }));
    }
  };

  const docs = startup.kycDocuments || {};
  const submittedCount = KYC_DOCS.filter((d) => docs[d.key]?.url).length;
  const isVerified = startup.kycStatus === "verified";

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <h2 className="text-base font-medium">KYC documents</h2>
        <StatusBadge status={startup.kycStatus} />
      </div>
      <p className="text-sm text-ink-muted mb-5">
        {isVerified
          ? "Your account is verified. Re-upload below if any document needs updating."
          : `${submittedCount} of ${KYC_DOCS.length} uploaded · Review takes 2 business days once complete.`}
      </p>

      <div className="space-y-3">
        {KYC_DOCS.map((doc) => {
          const cur = docs[doc.key];
          const hasFile = !!cur?.url;
          return (
            <div
              key={doc.key}
              className="flex items-center justify-between gap-4 p-4 border border-divider rounded-md"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {hasFile ? (
                  <CheckCircle2 size={18} className="text-lime shrink-0 mt-0.5" />
                ) : (
                  <Circle size={18} className="text-ink-faint shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{doc.label}</p>
                  <p className="text-xs text-ink-muted">{doc.hint}</p>
                  {hasFile && cur.uploadedAt && (
                    <p className="text-xs text-ink-faint font-mono mt-1">
                      Uploaded {formatDate(cur.uploadedAt)}
                    </p>
                  )}
                </div>
              </div>
              <label className="shrink-0">
                <Button
                  size="sm"
                  variant={hasFile ? "secondary" : "primary"}
                  loading={uploading[doc.key]}
                  onClick={(e) => {
                    e.preventDefault();
                    e.currentTarget.parentElement.querySelector("input").click();
                  }}
                  className="cursor-pointer"
                >
                  <Upload size={14} />
                  {hasFile ? "Replace" : "Upload"}
                </Button>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr-only"
                  onChange={(e) => submitFile(doc.key, e.target.files?.[0])}
                />
              </label>
            </div>
          );
        })}
      </div>

      {startup.kycStatus === "rejected" && startup.kycRejectionReason && (
        <div className="mt-4 p-3 rounded-md bg-danger-soft border border-danger/30 text-sm">
          <p className="font-medium text-danger mb-0.5">Resubmission needed</p>
          <p className="text-ink-muted">{startup.kycRejectionReason}</p>
        </div>
      )}
    </Card>
  );
}

// ---------- Company ----------
function CompanySection({ startup }) {
  if (!startup) return null;
  return (
    <Card className="p-5 mb-6">
      <h2 className="text-base font-medium mb-4">Company details</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
        <Detail label="Company name" value={startup.companyName} />
        <Detail label="Registration" value={`${startup.registrationType} · ${startup.registrationNumber}`} mono />
        <Detail label="Industry" value={startup.industry?.replace(/_/g, " ")} />
        <Detail label="Team size" value={startup.teamSize} mono />
        {startup.address && (
          <div className="sm:col-span-2">
            <Detail
              label="Address"
              value={[startup.address.street, startup.address.city, startup.address.province]
                .filter(Boolean)
                .join(", ")}
            />
          </div>
        )}
        {startup.approvedCreditLimit > 0 && (
          <Detail
            label="Approved credit"
            value={`PKR ${Number(startup.approvedCreditLimit).toLocaleString("en-PK")}`}
            mono
          />
        )}
        {startup.creditRating !== undefined && (
          <Detail label="Credit rating" value={`${startup.creditRating}/100`} mono />
        )}
      </dl>
      <p className="text-xs text-ink-muted mt-5">
        To change company details, please contact support.
      </p>
    </Card>
  );
}

// ---------- Password ----------
function PasswordSection() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.currentPassword) next.currentPassword = "Required";
    if (!/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/.test(form.newPassword)) {
      next.newPassword = "Min 8 chars with letters, numbers, and a special character";
    }
    if (form.newPassword !== form.confirm) next.confirm = "Passwords don't match";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success("Password updated");
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      toast.error(errorMessage(err, "Could not change password"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-5 mb-10">
      <div className="flex items-center gap-2 mb-4">
        <KeyRound size={16} className="text-ink-muted" />
        <h2 className="text-base font-medium">Change password</h2>
      </div>
      <form onSubmit={onSubmit} noValidate className="max-w-md">
        <FormField label="Current password" htmlFor="cur" error={errors.currentPassword}>
          <Input
            id="cur"
            type="password"
            value={form.currentPassword}
            onChange={(e) => set("currentPassword", e.target.value)}
            error={!!errors.currentPassword}
            autoComplete="current-password"
          />
        </FormField>
        <FormField
          label="New password"
          htmlFor="new"
          error={errors.newPassword}
          hint="Min 8 chars with letters, numbers, and a special character"
        >
          <Input
            id="new"
            type="password"
            value={form.newPassword}
            onChange={(e) => set("newPassword", e.target.value)}
            error={!!errors.newPassword}
            autoComplete="new-password"
          />
        </FormField>
        <FormField label="Confirm new password" htmlFor="confirm" error={errors.confirm}>
          <Input
            id="confirm"
            type="password"
            value={form.confirm}
            onChange={(e) => set("confirm", e.target.value)}
            error={!!errors.confirm}
            autoComplete="new-password"
          />
        </FormField>
        <Button type="submit" loading={submitting}>Update password</Button>
      </form>
    </Card>
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
