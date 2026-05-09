// ==============================================================
// Verify Email Page
// --------------------------------------------------------------
// Hits /auth/verify-email/:token on mount, shows the result.
// ==============================================================

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";

import api, { errorMessage } from "../lib/api";
import Button from "../components/Button";
import { Spinner } from "../components/Loading";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";

export default function VerifyEmailPage() {
  const { token } = useParams();
  const { refresh } = useAuth();
  const [state, setState] = useState({ status: "verifying", message: "" });

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "Verification token missing." });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.post(`/auth/verify-email/${token}`);
        if (cancelled) return;
        setState({
          status: "ok",
          message: res.data?.message || "Email verified.",
        });
        // If logged in, refresh user state so status flips to active
        try { await refresh(); } catch { /* ignore */ }
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          message: errorMessage(err, "Verification link is invalid or has expired."),
        });
      }
    })();
    return () => { cancelled = true; };
  }, [token, refresh]);

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        {state.status === "verifying" && (
          <>
            <div className="flex justify-center mb-5">
              <Spinner size={28} />
            </div>
            <h1 className="text-h2 font-medium mb-2">Verifying your email</h1>
            <p className="text-sm text-ink-muted">One moment…</p>
          </>
        )}

        {state.status === "ok" && (
          <>
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-full bg-lime-glow flex items-center justify-center">
                <CheckCircle2 className="text-lime" size={28} />
              </div>
            </div>
            <h1 className="text-h2 font-medium mb-2">Email verified</h1>
            <p className="text-sm text-ink-muted mb-6">{state.message}</p>
            <Link to="/dashboard">
              <Button>Continue to dashboard</Button>
            </Link>
          </>
        )}

        {state.status === "error" && (
          <>
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-full bg-danger-soft flex items-center justify-center">
                <XCircle className="text-danger" size={28} />
              </div>
            </div>
            <h1 className="text-h2 font-medium mb-2">Couldn't verify</h1>
            <p className="text-sm text-ink-muted mb-6">{state.message}</p>
            <div className="flex gap-3 justify-center">
              <Link to="/login">
                <Button variant="secondary">Sign in</Button>
              </Link>
              <Link to="/register">
                <Button>Sign up again</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
