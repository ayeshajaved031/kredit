// ==============================================================
// Dashboard Placeholder
// --------------------------------------------------------------
// Temporary holding page for Phase 9a — full dashboard with KYC
// status, contracts, schedule, etc. is built in Phase 9b.
// ==============================================================

import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";
import Button from "../components/Button";
import { Card } from "../components/Card";

export default function DashboardPlaceholder() {
  const { user, startup, logout } = useAuth();
  return (
    <div className="min-h-screen p-6 sm:p-10">
      <header className="flex items-center justify-between mb-10">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-muted hidden sm:block">{user?.email}</span>
          <Button variant="secondary" size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto">
        <p className="text-sm text-ink-muted mb-1">
          Welcome, {user?.fullName?.split(" ")[0]}
        </p>
        <h1 className="text-h1 font-medium mb-6">
          {startup?.companyName || "Your company"}
        </h1>

        <Card variant="promoted" className="p-6 mb-6">
          <p className="text-xs font-mono uppercase tracking-wider text-lime mb-2">
            Phase 9a · scaffold ready
          </p>
          <h2 className="text-h3 font-medium mb-2">
            Your account is set up
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Email verification, KYC upload, financing requests, contracts, payments,
            notifications, and tickets are all live on the backend. The full startup
            UI ships in the next phase.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-medium mb-3">Account details</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-muted">Account status</dt>
            <dd className="font-mono">{user?.status}</dd>
            <dt className="text-ink-muted">Email verified</dt>
            <dd className="font-mono">{user?.emailVerified ? "yes" : "no"}</dd>
            {startup && (
              <>
                <dt className="text-ink-muted">KYC status</dt>
                <dd className="font-mono">{startup.kycStatus}</dd>
                <dt className="text-ink-muted">Approved credit</dt>
                <dd className="font-mono">PKR {Number(startup.approvedCreditLimit || 0).toLocaleString("en-PK")}</dd>
              </>
            )}
          </dl>
        </Card>
      </div>
    </div>
  );
}
