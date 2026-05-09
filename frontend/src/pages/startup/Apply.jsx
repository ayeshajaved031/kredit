// ==============================================================
// Apply for Financing
// --------------------------------------------------------------
// Multi-field form with live Murabaha calculation preview.
//
// Sections:
//   1. Vendor picker (pre-fills from ?vendor= query param)
//   2. Plan name + annual amount
//   3. Vendor invoice PDF upload
//   4. Live calculation preview card (next to / below the form)
//
// On submit, multipart POST to /financing-requests, then nav to
// /requests/:id with a success toast.
// ==============================================================

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Calculator, Upload } from "lucide-react";

import api, { errorMessage, fieldErrors } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { useAuth } from "../../context/AuthContext";

import PageHeader from "../../components/PageHeader";
import Input, { FormField, Select } from "../../components/Input";
import Button from "../../components/Button";
import { Card } from "../../components/Card";
import KycStatusBanner from "../../components/KycStatusBanner";
import { formatPKR } from "../../lib/format";

// Mirrors backend constants — env-driven on the server, hardcoded
// here for the preview. Real number is locked at backend approval.
const MARKUP_PERCENT = 10;
const INSTALLMENT_COUNT = 12;

export default function Apply() {
  const { startup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preselectedVendor = params.get("vendor");

  const { data: vendorData, loading: vendorsLoading } = useApi(
    () => api.get("/vendors"),
    []
  );
  const vendors = vendorData?.data?.vendors || [];

  const [form, setForm] = useState({
    vendorId: preselectedVendor || "",
    planName: "",
    planTier: "annual",
    annualAmountPKR: "",
    notes: "",
  });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // When vendors load, if we have ?vendor=, prefill default plan name
  useEffect(() => {
    if (preselectedVendor && vendors.length > 0 && !form.planName) {
      const v = vendors.find((x) => x._id === preselectedVendor);
      if (v) setForm((f) => ({ ...f, planName: `${v.name} annual plan` }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendors.length, preselectedVendor]);

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const selectedVendor = useMemo(
    () => vendors.find((v) => v._id === form.vendorId),
    [vendors, form.vendorId]
  );

  // Live Murabaha calculation
  const calc = useMemo(() => {
    const principal = Number(form.annualAmountPKR) || 0;
    if (principal <= 0) return null;
    const markup = (principal * MARKUP_PERCENT) / 100;
    const total = principal + markup;
    const installment = Math.round((total / INSTALLMENT_COUNT) * 100) / 100;
    // Round-aware schedule: each installment rounded down, last absorbs remainder
    const baseRounded = Math.floor(total / INSTALLMENT_COUNT);
    const lastInstallment = total - baseRounded * (INSTALLMENT_COUNT - 1);
    return {
      principal,
      markup,
      markupPct: MARKUP_PERCENT,
      total,
      installment: baseRounded,
      lastInstallment,
      count: INSTALLMENT_COUNT,
    };
  }, [form.annualAmountPKR]);

  const availableCredit = Math.max(
    0,
    (startup?.approvedCreditLimit || 0) - (startup?.usedCredit || 0)
  );
  const exceedsCredit = calc && calc.principal > availableCredit;

  const validate = () => {
    const e = {};
    if (!form.vendorId) e.vendorId = "Please choose a vendor";
    if (!form.planName.trim()) e.planName = "Plan name is required";
    const amt = Number(form.annualAmountPKR);
    if (!amt || amt <= 0) e.annualAmountPKR = "Enter the annual amount";
    if (selectedVendor) {
      if (selectedVendor.minAnnualAmountPKR && amt < selectedVendor.minAnnualAmountPKR) {
        e.annualAmountPKR = `Below ${selectedVendor.name}'s minimum (${formatPKR(selectedVendor.minAnnualAmountPKR)})`;
      }
      if (selectedVendor.maxAnnualAmountPKR && amt > selectedVendor.maxAnnualAmountPKR) {
        e.annualAmountPKR = `Above ${selectedVendor.name}'s maximum (${formatPKR(selectedVendor.maxAnnualAmountPKR)})`;
      }
    }
    if (!file) e.invoice = "Upload the vendor invoice PDF";
    else if (file.type !== "application/pdf") e.invoice = "Must be a PDF";
    else if (file.size > 10 * 1024 * 1024) e.invoice = "File must be under 10MB";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    if (startup?.kycStatus !== "verified") {
      toast.error("Your KYC must be verified before applying.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("vendorId", form.vendorId);
      fd.append("planName", form.planName.trim());
      fd.append("planTier", form.planTier);
      fd.append("annualAmountPKR", String(Number(form.annualAmountPKR)));
      if (form.notes) fd.append("notes", form.notes);
      fd.append("invoice", file);

      const res = await api.post("/financing-requests", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const requestId = res.data?.data?.request?._id;
      toast.success("Request submitted — we'll review it soon");
      navigate(requestId ? `/requests/${requestId}` : "/requests");
    } catch (err) {
      const fe = fieldErrors(err);
      if (fe) setErrors(fe);
      toast.error(errorMessage(err, "Could not submit request"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Apply for financing"
        subtitle="Pick a vendor, enter the annual amount, and upload the invoice. We'll respond in 2 business days."
      />

      <KycStatusBanner startup={startup} />

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <Card className="p-6">
          <form onSubmit={onSubmit} noValidate>
            <FormField label="Vendor" htmlFor="vendor" error={errors.vendorId}>
              <Select
                id="vendor"
                value={form.vendorId}
                onChange={(e) => set("vendorId", e.target.value)}
                disabled={vendorsLoading}
                error={!!errors.vendorId}
              >
                <option value="">{vendorsLoading ? "Loading…" : "Select a vendor"}</option>
                {vendors.map((v) => (
                  <option key={v._id} value={v._id}>{v.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Plan name" htmlFor="planName" error={errors.planName}>
              <Input
                id="planName"
                value={form.planName}
                onChange={(e) => set("planName", e.target.value)}
                placeholder="e.g., AWS Reserved Instance — Production"
                error={!!errors.planName}
              />
            </FormField>

            <div className="grid sm:grid-cols-2 gap-3">
              <FormField label="Plan tier" htmlFor="planTier">
                <Select
                  id="planTier"
                  value={form.planTier}
                  onChange={(e) => set("planTier", e.target.value)}
                >
                  <option value="annual">Annual</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="custom">Custom</option>
                </Select>
              </FormField>

              <FormField
                label="Annual amount (PKR)"
                htmlFor="amount"
                error={errors.annualAmountPKR}
              >
                <Input
                  id="amount"
                  type="number"
                  min={0}
                  step={1}
                  value={form.annualAmountPKR}
                  onChange={(e) => set("annualAmountPKR", e.target.value)}
                  placeholder="850000"
                  mono
                  error={!!errors.annualAmountPKR}
                />
              </FormField>
            </div>

            <FormField
              label="Vendor invoice PDF"
              htmlFor="invoice"
              error={errors.invoice}
              hint="Max 10MB · Used during review"
            >
              <label
                htmlFor="invoice"
                className={`
                  flex flex-col items-center justify-center gap-2 px-4 py-6 cursor-pointer
                  bg-surface-2/40 border border-dashed rounded-md transition-colors
                  ${errors.invoice ? "border-danger" : "border-divider hover:border-lime/50"}
                `}
              >
                <Upload size={18} className="text-ink-muted" />
                {file ? (
                  <p className="text-sm text-ink">
                    {file.name}
                    <span className="text-ink-muted ml-2 font-mono text-xs">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-ink-muted">
                    Click to upload PDF
                  </p>
                )}
                <input
                  id="invoice"
                  type="file"
                  accept="application/pdf"
                  className="sr-only"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    setErrors((er) => ({ ...er, invoice: undefined }));
                  }}
                />
              </label>
            </FormField>

            <FormField
              label="Notes for the reviewer"
              htmlFor="notes"
              optional
            >
              <textarea
                id="notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Anything our team should know about this purchase…"
                className="w-full px-3 py-2.5 bg-surface border border-divider rounded-md text-ink placeholder:text-ink-faint text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-lime/40 focus:border-lime resize-y"
              />
            </FormField>

            {exceedsCredit && (
              <div className="p-3 rounded-md bg-danger-soft border border-danger/30 text-sm text-danger mb-4">
                This amount exceeds your available credit of{" "}
                {formatPKR(availableCredit)}. We may approve at a lower amount.
              </div>
            )}

            <Button
              type="submit"
              loading={submitting}
              disabled={startup?.kycStatus !== "verified"}
              size="lg"
              className="w-full"
            >
              Submit financing request
            </Button>
            {startup?.kycStatus !== "verified" && (
              <p className="text-xs text-ink-muted text-center mt-2">
                You'll be able to submit once your KYC is verified.
              </p>
            )}
          </form>
        </Card>

        {/* Right rail — live calculation */}
        <div>
          <Card className="p-5 sticky top-20" variant={calc ? "promoted" : "default"}>
            <div className="flex items-center gap-2 mb-3">
              <Calculator size={16} className="text-lime" />
              <h3 className="text-sm font-medium">Murabaha preview</h3>
            </div>

            {!calc ? (
              <p className="text-sm text-ink-muted">
                Enter an annual amount to see your monthly installment.
              </p>
            ) : (
              <div className="space-y-3">
                <Row
                  label="Principal (cost paid to vendor)"
                  value={formatPKR(calc.principal)}
                />
                <Row
                  label={`Markup · ${calc.markupPct}%`}
                  value={formatPKR(calc.markup)}
                />
                <div className="border-t border-divider pt-3">
                  <Row
                    label="Total payable"
                    value={formatPKR(calc.total)}
                    bold
                  />
                </div>
                <div className="border-t border-divider pt-3 mt-2">
                  <p className="text-xs text-ink-muted mb-1">
                    Monthly installment ({calc.count} × equal payments)
                  </p>
                  <p className="font-mono text-h2 font-medium text-lime">
                    {formatPKR(calc.installment)}
                  </p>
                  {calc.lastInstallment !== calc.installment && (
                    <p className="text-xs text-ink-muted mt-1">
                      Last installment {formatPKR(calc.lastInstallment)} (rounding)
                    </p>
                  )}
                </div>
                <p className="text-xs text-ink-muted leading-relaxed pt-2">
                  Riba-free. Markup is fixed at signing per Murabaha rules. Final
                  amount confirmed when the request is approved.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold = false }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className={`font-mono text-sm ${bold ? "font-medium text-ink" : "text-ink"}`}>
        {value}
      </span>
    </div>
  );
}
