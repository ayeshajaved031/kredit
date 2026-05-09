// ==============================================================
// New Support Ticket
// --------------------------------------------------------------
// Multipart form with optional attachment (image or PDF).
// ==============================================================

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Paperclip } from "lucide-react";

import api, { errorMessage, fieldErrors } from "../../lib/api";

import PageHeader from "../../components/PageHeader";
import Input, { FormField, Select, Textarea } from "../../components/Input";
import Button from "../../components/Button";
import { Card } from "../../components/Card";

const CATEGORIES = [
  ["billing_issue", "Billing issue"],
  ["contract_question", "Contract question"],
  ["technical_problem", "Technical problem"],
  ["kyc_query", "KYC query"],
  ["payment_failure", "Payment failure"],
  ["other", "Other"],
];
const PRIORITIES = ["low", "medium", "high", "urgent"];

export default function NewTicket() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    subject: "",
    description: "",
    category: "billing_issue",
    priority: "medium",
  });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.subject.trim()) e.subject = "Subject is required";
    else if (form.subject.length > 150) e.subject = "Max 150 characters";
    if (!form.description.trim()) e.description = "Description is required";
    else if (form.description.length < 10) e.description = "Please give more detail (10+ characters)";
    if (file && file.size > 10 * 1024 * 1024) e.attachment = "Attachment must be under 10MB";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("subject", form.subject.trim());
      fd.append("description", form.description.trim());
      fd.append("category", form.category);
      fd.append("priority", form.priority);
      if (file) fd.append("attachment", file);

      const res = await api.post("/tickets", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const id = res.data?.data?.ticket?._id;
      toast.success("Ticket created");
      navigate(id ? `/tickets/${id}` : "/tickets");
    } catch (err) {
      const fe = fieldErrors(err);
      if (fe) setErrors(fe);
      toast.error(errorMessage(err, "Could not create ticket"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        to="/tickets"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-4"
      >
        <ArrowLeft size={14} />
        Back to tickets
      </Link>

      <PageHeader title="New ticket" subtitle="We typically respond within one business day." />

      <Card className="p-6">
        <form onSubmit={onSubmit} noValidate>
          <FormField label="Subject" htmlFor="subject" error={errors.subject}>
            <Input
              id="subject"
              autoFocus
              value={form.subject}
              onChange={(e) => set("subject", e.target.value)}
              placeholder="Brief summary of the issue"
              error={!!errors.subject}
            />
          </FormField>

          <div className="grid sm:grid-cols-2 gap-3">
            <FormField label="Category" htmlFor="category">
              <Select id="category" value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Priority" htmlFor="priority">
              <Select id="priority" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p} className="capitalize">{p}</option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField
            label="Description"
            htmlFor="description"
            error={errors.description}
            hint="What's happening? What did you expect? Steps to reproduce help us a lot."
          >
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={6}
              maxLength={2000}
              error={!!errors.description}
            />
          </FormField>

          <FormField
            label="Attachment"
            htmlFor="attachment"
            optional
            error={errors.attachment}
            hint="Screenshot or PDF, up to 10MB"
          >
            <label
              htmlFor="attachment"
              className="flex items-center gap-2 px-4 py-3 cursor-pointer bg-surface border border-divider rounded-md hover:bg-surface-2 transition-colors"
            >
              <Paperclip size={16} className="text-ink-muted" />
              {file ? (
                <span className="text-sm">
                  {file.name}
                  <span className="text-ink-muted ml-2 font-mono text-xs">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                </span>
              ) : (
                <span className="text-sm text-ink-muted">Click to attach a file</span>
              )}
              <input
                id="attachment"
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </FormField>

          <div className="flex justify-end gap-2 mt-2">
            <Link to="/tickets">
              <Button variant="secondary" type="button">Cancel</Button>
            </Link>
            <Button type="submit" loading={submitting}>Submit ticket</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
