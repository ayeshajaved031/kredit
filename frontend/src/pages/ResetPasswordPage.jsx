// ==============================================================
// Reset Password Page
// --------------------------------------------------------------
// Validates new password client-side, posts to /reset-password/:token.
// On success, redirects to /login with a success toast.
// ==============================================================

import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { CheckCircle2 } from "lucide-react";

import api, { errorMessage } from "../lib/api";
import Button from "../components/Button";
import Input, { FormField } from "../components/Input";
import Logo from "../components/Logo";

const PASSWORD_RE = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState({});

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!PASSWORD_RE.test(pwd)) {
      next.pwd = "Min 8 characters with letters, numbers, and a special character";
    }
    if (pwd !== confirm) next.confirm = "Passwords don't match";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { newPassword: pwd });
      setDone(true);
      setTimeout(() => navigate("/login"), 1800);
    } catch (err) {
      toast.error(errorMessage(err, "Reset link is invalid or expired"));
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

        {!done ? (
          <>
            <h1 className="text-h2 font-medium text-center mb-2">Set a new password</h1>
            <p className="text-sm text-ink-muted text-center mb-7">
              Pick something different from your old password.
            </p>
            <form onSubmit={onSubmit} noValidate>
              <FormField
                label="New password"
                htmlFor="pwd"
                error={errors.pwd}
                hint="Min 8 characters with letters, numbers, and a special character"
              >
                <Input
                  id="pwd"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  required
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  error={!!errors.pwd}
                />
              </FormField>
              <FormField label="Confirm password" htmlFor="confirm" error={errors.confirm}>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  error={!!errors.confirm}
                />
              </FormField>
              <Button type="submit" loading={submitting} className="w-full" size="lg">
                Reset password
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-full bg-lime-glow flex items-center justify-center">
                <CheckCircle2 className="text-lime" size={28} />
              </div>
            </div>
            <h1 className="text-h2 font-medium mb-2">Password updated</h1>
            <p className="text-sm text-ink-muted mb-6">
              Redirecting you to sign in…
            </p>
            <Link to="/login">
              <Button variant="secondary">Sign in now</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
