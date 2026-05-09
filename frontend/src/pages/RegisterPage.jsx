// ==============================================================
// Register Page
// --------------------------------------------------------------
// Two-step form to keep registration approachable:
//   Step 1: account (name, email, password, phone)
//   Step 2: company (name, NTN/SECP, address, industry, team size)
//
// Validates client-side before each step. The backend validates
// again — see backend's auth.validation.js for the source of truth.
//
// On success, AuthContext stores token + redirects to /dashboard
// (where KYC upload prompt awaits).
// ==============================================================

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowRight, ArrowLeft } from "lucide-react";

import Button from "../components/Button";
import Input, { FormField, Select } from "../components/Input";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import { errorMessage, fieldErrors } from "../lib/api";

const PROVINCES = ["Punjab", "Sindh", "KPK", "Balochistan", "ICT", "AJK", "GB"];
const INDUSTRIES = [
  ["software_house", "Software house"],
  ["saas_startup", "SaaS startup"],
  ["blockchain", "Blockchain / Web3"],
  ["ai_ml", "AI / ML"],
  ["fintech", "Fintech"],
  ["ecommerce", "E-commerce"],
  ["mobile_apps", "Mobile apps"],
  ["other", "Other"],
];

const PASSWORD_RE = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
const PHONE_RE = /^(\+92|0)?3\d{9}$/;
const NTN_RE = /^\d{7}$/;
const SECP_RE = /^[A-Z0-9-]{4,30}$/i;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    companyName: "",
    registrationType: "NTN",
    registrationNumber: "",
    address: { street: "", city: "", province: "Punjab" },
    industry: "saas_startup",
    teamSize: 1,
    annualRevenuePKR: 0,
  });

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const setAddr = (key, val) => {
    setForm((f) => ({ ...f, address: { ...f.address, [key]: val } }));
    setErrors((e) => ({ ...e, [`address.${key}`]: undefined }));
  };

  const validateStep1 = () => {
    const e = {};
    if (!form.fullName || form.fullName.trim().length < 2) e.fullName = "Full name is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Valid email is required";
    if (!PASSWORD_RE.test(form.password)) {
      e.password = "Min 8 characters with letters, numbers, and a special character";
    }
    if (form.phone && !PHONE_RE.test(form.phone)) e.phone = "Use a Pakistani number";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    if (!form.companyName || form.companyName.trim().length < 2) {
      e.companyName = "Company name is required";
    }
    const reg = form.registrationNumber.trim();
    if (!reg) e.registrationNumber = "Required";
    else if (form.registrationType === "NTN" && !NTN_RE.test(reg)) e.registrationNumber = "NTN must be 7 digits";
    else if (form.registrationType === "SECP" && !SECP_RE.test(reg)) e.registrationNumber = "Invalid SECP number";

    if (!form.address.street.trim()) e["address.street"] = "Street is required";
    if (!form.address.city.trim()) e["address.city"] = "City is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onNext = (event) => {
    event.preventDefault();
    if (validateStep1()) setStep(2);
  };

  const onBack = () => setStep(1);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!validateStep2()) return;
    setSubmitting(true);
    try {
      await register({
        ...form,
        registrationNumber: form.registrationNumber.trim().toUpperCase(),
        teamSize: Number(form.teamSize) || 1,
        annualRevenuePKR: Number(form.annualRevenuePKR) || 0,
      });
      toast.success("Account created — check your email to verify");
      navigate("/dashboard");
    } catch (err) {
      const fe = fieldErrors(err);
      if (fe) {
        setErrors(fe);
        // If backend returned an error specific to step 1, jump back
        if (fe.fullName || fe.email || fe.password || fe.phone) setStep(1);
      }
      toast.error(errorMessage(err, "Could not create account"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        <h1 className="text-h2 font-medium text-center mb-1">Create your account</h1>
        <p className="text-sm text-ink-muted text-center mb-7">
          Start financing SaaS subscriptions with monthly cash flow.
        </p>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`h-1 w-12 rounded-full ${step >= 1 ? "bg-lime" : "bg-divider"}`} />
          <div className={`h-1 w-12 rounded-full ${step >= 2 ? "bg-lime" : "bg-divider"}`} />
          <span className="ml-2 text-xs font-mono uppercase tracking-wider text-ink-muted">
            Step {step} of 2
          </span>
        </div>

        {step === 1 && (
          <form onSubmit={onNext} noValidate className="bg-surface border border-divider rounded-lg p-6">
            <h2 className="text-base font-medium mb-4">Account details</h2>

            <FormField label="Full name" htmlFor="fullName" error={errors.fullName}>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="Saad Ahmed"
                autoComplete="name"
                error={!!errors.fullName}
                autoFocus
              />
            </FormField>

            <FormField label="Corporate email" htmlFor="email" error={errors.email}>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="you@company.pk"
                autoComplete="email"
                error={!!errors.email}
              />
            </FormField>

            <FormField
              label="Password"
              htmlFor="password"
              error={errors.password}
              hint="At least 8 characters with letters, numbers, and a special character"
            >
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Choose a strong password"
                autoComplete="new-password"
                error={!!errors.password}
              />
            </FormField>

            <FormField label="Phone" htmlFor="phone" optional error={errors.phone} hint="For SMS reminders. Pakistani format only.">
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+923001234567"
                autoComplete="tel"
                error={!!errors.phone}
              />
            </FormField>

            <Button type="submit" className="w-full mt-2" size="lg">
              Continue
              <ArrowRight size={16} />
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={onSubmit} noValidate className="bg-surface border border-divider rounded-lg p-6">
            <h2 className="text-base font-medium mb-4">Company details</h2>

            <FormField label="Company name" htmlFor="companyName" error={errors.companyName}>
              <Input
                id="companyName"
                value={form.companyName}
                onChange={(e) => set("companyName", e.target.value)}
                placeholder="Blockchain Labs Pvt Ltd"
                error={!!errors.companyName}
              />
            </FormField>

            <div className="grid grid-cols-3 gap-3">
              <FormField label="Registration type" htmlFor="registrationType">
                <Select
                  id="registrationType"
                  value={form.registrationType}
                  onChange={(e) => set("registrationType", e.target.value)}
                >
                  <option value="NTN">NTN</option>
                  <option value="SECP">SECP</option>
                </Select>
              </FormField>
              <div className="col-span-2">
                <FormField
                  label={form.registrationType === "NTN" ? "NTN number" : "SECP registration number"}
                  htmlFor="registrationNumber"
                  error={errors.registrationNumber}
                  hint={form.registrationType === "NTN" ? "7 digits" : "Alphanumeric"}
                >
                  <Input
                    id="registrationNumber"
                    value={form.registrationNumber}
                    onChange={(e) => set("registrationNumber", e.target.value)}
                    placeholder={form.registrationType === "NTN" ? "1234567" : "0123456-A"}
                    error={!!errors.registrationNumber}
                    mono
                  />
                </FormField>
              </div>
            </div>

            <FormField label="Street address" htmlFor="street" error={errors["address.street"]}>
              <Input
                id="street"
                value={form.address.street}
                onChange={(e) => setAddr("street", e.target.value)}
                placeholder="I-9 Markaz"
                error={!!errors["address.street"]}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="City" htmlFor="city" error={errors["address.city"]}>
                <Input
                  id="city"
                  value={form.address.city}
                  onChange={(e) => setAddr("city", e.target.value)}
                  placeholder="Islamabad"
                  error={!!errors["address.city"]}
                />
              </FormField>
              <FormField label="Province" htmlFor="province">
                <Select
                  id="province"
                  value={form.address.province}
                  onChange={(e) => setAddr("province", e.target.value)}
                >
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Industry" htmlFor="industry">
                <Select
                  id="industry"
                  value={form.industry}
                  onChange={(e) => set("industry", e.target.value)}
                >
                  {INDUSTRIES.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Team size" htmlFor="teamSize">
                <Input
                  id="teamSize"
                  type="number"
                  min={1}
                  value={form.teamSize}
                  onChange={(e) => set("teamSize", e.target.value)}
                  mono
                />
              </FormField>
            </div>

            <FormField
              label="Annual revenue"
              htmlFor="revenue"
              optional
              hint="In PKR — used during KYC review"
            >
              <Input
                id="revenue"
                type="number"
                min={0}
                value={form.annualRevenuePKR}
                onChange={(e) => set("annualRevenuePKR", e.target.value)}
                placeholder="8000000"
                mono
              />
            </FormField>

            <div className="flex gap-3 mt-2">
              <Button type="button" variant="secondary" onClick={onBack}>
                <ArrowLeft size={16} />
                Back
              </Button>
              <Button type="submit" loading={submitting} className="flex-1" size="lg">
                Create account
                <ArrowRight size={16} />
              </Button>
            </div>
          </form>
        )}

        <p className="mt-6 text-sm text-ink-muted text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-lime hover:text-lime-dark">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
