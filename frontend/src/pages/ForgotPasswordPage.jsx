// ==============================================================
// Forgot Password Page
// ==============================================================

import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Mail } from "lucide-react";

import api, { errorMessage } from "../lib/api";
import Button from "../components/Button";
import Input, { FormField } from "../components/Input";
import Logo from "../components/Logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email });
      // Backend always returns 200 here (no email enumeration), so
      // we always show the same success state.
      setSent(true);
    } catch (err) {
      // Validation error (bad email format) is the only realistic 400 here
      toast.error(errorMessage(err, "Could not send reset link"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        {!sent ? (
          <>
            <h1 className="text-h2 font-medium text-center mb-2">Forgot your password?</h1>
            <p className="text-sm text-ink-muted text-center mb-7">
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={onSubmit} noValidate>
              <FormField label="Corporate email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.pk"
                />
              </FormField>
              <Button type="submit" loading={submitting} className="w-full" size="lg">
                Send reset link
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-full bg-lavender-glow flex items-center justify-center">
                <Mail className="text-lavender" size={28} />
              </div>
            </div>
            <h1 className="text-h2 font-medium mb-2">Check your email</h1>
            <p className="text-sm text-ink-muted mb-1">
              If an account exists for <span className="text-ink">{email}</span>,
            </p>
            <p className="text-sm text-ink-muted mb-7">
              we've sent a reset link. It expires in 1 hour.
            </p>
            <Link to="/login">
              <Button variant="secondary">Back to sign in</Button>
            </Link>
          </div>
        )}

        {!sent && (
          <p className="mt-6 text-sm text-ink-muted text-center">
            Remembered it?{" "}
            <Link to="/login" className="text-lime hover:text-lime-dark">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
