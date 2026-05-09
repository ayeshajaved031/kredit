// ==============================================================
// Login Page
// --------------------------------------------------------------
// Email + password. Shows session-expired banner if redirected
// from a 401. Redirects back to the originally-requested page
// after success (preserves location.state.from from the route guard).
// ==============================================================

import { useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import Button from "../components/Button";
import Input, { FormField } from "../components/Input";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const sessionExpired = params.get("session") === "expired";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { user } = await login(email, password);
      const target =
        location.state?.from?.pathname ||
        (user?.role === "admin" ? "/admin" : "/dashboard");
      navigate(target, { replace: true });
    } catch (err) {
      const msg = errorMessage(err, "Could not sign in. Please try again.");
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-10">
          <Logo size="lg" />
        </div>

        <h1 className="text-h2 font-medium text-center mb-2">Welcome back</h1>
        <p className="text-sm text-ink-muted text-center mb-8">
          Sign in to your Kredit account.
        </p>

        {sessionExpired && (
          <div className="mb-5 p-3 rounded-md bg-lavender-glow border border-lavender/30 text-sm text-lavender">
            Your session expired. Please sign in again.
          </div>
        )}

        <form onSubmit={onSubmit} noValidate>
          <FormField label="Corporate email" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.pk"
            />
          </FormField>

          <FormField
            label={
              <div className="flex justify-between w-full">
                <span>Password</span>
                <Link
                  to="/forgot-password"
                  className="text-lavender hover:text-lavender-dark text-xs font-normal"
                >
                  Forgot?
                </Link>
              </div>
            }
            htmlFor="password"
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />
          </FormField>

          {error && (
            <p className="mb-3 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" loading={submitting} className="w-full" size="lg">
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-sm text-ink-muted text-center">
          New to Kredit?{" "}
          <Link to="/register" className="text-lime hover:text-lime-dark">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
