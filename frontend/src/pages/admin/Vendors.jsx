// ==============================================================
// Admin Vendors CRUD
// --------------------------------------------------------------
// List + Create/Edit modal + Deactivate (soft-delete via PATCH).
// Uses GET /vendors/all so admins see deactivated entries too.
// ==============================================================

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Pencil, ShoppingBag, Power } from "lucide-react";

import api, { errorMessage, fieldErrors } from "../../lib/api";

import PageHeader from "../../components/PageHeader";
import { Card } from "../../components/Card";
import Button from "../../components/Button";
import Badge from "../../components/Badge";
import Modal from "../../components/Modal";
import Input, { FormField, Textarea, Select } from "../../components/Input";
import { Spinner, EmptyState } from "../../components/Loading";

const CATEGORIES = [
  ["cloud_infrastructure", "Cloud infrastructure"],
  ["crm_sales", "CRM & sales"],
  ["productivity", "Productivity"],
  ["design", "Design"],
  ["communication", "Communication"],
  ["developer_tools", "Developer tools"],
  ["analytics", "Analytics"],
  ["database", "Database"],
  ["other", "Other"],
];

export default function AdminVendors() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = create new, object = edit
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/vendors/all");
      setList(res.data?.data?.vendors || []);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const onCreate = () => { setEditing(null); setShowForm(true); };
  const onEdit = (v) => { setEditing(v); setShowForm(true); };

  const onToggleActive = async (vendor) => {
    try {
      await api.patch(`/vendors/${vendor._id}`, { isActive: !vendor.isActive });
      toast.success(`${vendor.name} ${vendor.isActive ? "deactivated" : "activated"}`);
      load();
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Catalog"
        title="Vendors"
        subtitle="Manage which vendors startups can finance subscriptions for."
        actions={
          <Button onClick={onCreate}>
            <Plus size={14} />
            Add vendor
          </Button>
        }
      />

      {loading ? (
        <div className="py-12 flex justify-center"><Spinner size={24} /></div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShoppingBag}
            title="No vendors yet"
            message="Add the first vendor so startups have someone to finance."
            action={<Button onClick={onCreate}>Add vendor</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {list.map((v) => (
              <li
                key={v._id}
                className="flex items-center gap-4 px-5 py-4 border-b border-divider last:border-0"
              >
                <div className="w-10 h-10 rounded-md bg-lime-glow text-lime flex items-center justify-center font-mono text-sm font-semibold shrink-0">
                  {v.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-medium truncate">{v.name}</p>
                    {!v.isActive && <Badge tone="neutral" mono>INACTIVE</Badge>}
                  </div>
                  <p className="text-xs text-ink-muted capitalize mt-0.5">
                    {v.category?.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(v)}>
                    <Pencil size={14} />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant={v.isActive ? "secondary" : "primary"}
                    onClick={() => onToggleActive(v)}
                  >
                    <Power size={14} />
                    {v.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <VendorFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        vendor={editing}
        onDone={() => { setShowForm(false); load(); }}
      />
    </div>
  );
}

function VendorFormModal({ open, onClose, vendor, onDone }) {
  const isEdit = !!vendor;
  const [form, setForm] = useState({
    name: "",
    category: "cloud_infrastructure",
    description: "",
    website: "",
    minAnnualAmountPKR: 0,
    maxAnnualAmountPKR: 0,
    annualDiscountPercent: 0,
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        vendor
          ? {
              name: vendor.name || "",
              category: vendor.category || "cloud_infrastructure",
              description: vendor.description || "",
              website: vendor.website || "",
              minAnnualAmountPKR: vendor.minAnnualAmountPKR || 0,
              maxAnnualAmountPKR: vendor.maxAnnualAmountPKR || 0,
              annualDiscountPercent: vendor.annualDiscountPercent || 0,
            }
          : {
              name: "", category: "cloud_infrastructure", description: "",
              website: "", minAnnualAmountPKR: 0, maxAnnualAmountPKR: 0, annualDiscountPercent: 0,
            }
      );
      setErrors({});
    }
  }, [open, vendor]);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        minAnnualAmountPKR: Number(form.minAnnualAmountPKR) || 0,
        maxAnnualAmountPKR: Number(form.maxAnnualAmountPKR) || 0,
        annualDiscountPercent: Number(form.annualDiscountPercent) || 0,
      };
      if (isEdit) {
        await api.patch(`/vendors/${vendor._id}`, payload);
        toast.success("Vendor updated");
      } else {
        await api.post("/vendors", payload);
        toast.success("Vendor added");
      }
      onDone();
    } catch (err) {
      const fe = fieldErrors(err);
      if (fe) setErrors(fe);
      toast.error(errorMessage(err));
    } finally { setSubmitting(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit vendor" : "Add vendor"}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={onSubmit} loading={submitting}>{isEdit ? "Save changes" : "Add vendor"}</Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FormField label="Name" htmlFor="v-name" error={errors.name}>
          <Input id="v-name" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus error={!!errors.name} />
        </FormField>
        <FormField label="Category" htmlFor="v-cat">
          <Select id="v-cat" value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </FormField>
        <FormField label="Description" htmlFor="v-desc" optional>
          <Textarea id="v-desc" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </FormField>
        <FormField label="Website" htmlFor="v-web" optional>
          <Input id="v-web" type="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://aws.amazon.com" />
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Min PKR" htmlFor="v-min" optional>
            <Input id="v-min" type="number" min={0} value={form.minAnnualAmountPKR} onChange={(e) => set("minAnnualAmountPKR", e.target.value)} mono />
          </FormField>
          <FormField label="Max PKR" htmlFor="v-max" optional>
            <Input id="v-max" type="number" min={0} value={form.maxAnnualAmountPKR} onChange={(e) => set("maxAnnualAmountPKR", e.target.value)} mono />
          </FormField>
          <FormField label="Discount %" htmlFor="v-disc" optional>
            <Input id="v-disc" type="number" min={0} max={100} value={form.annualDiscountPercent} onChange={(e) => set("annualDiscountPercent", e.target.value)} mono />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
