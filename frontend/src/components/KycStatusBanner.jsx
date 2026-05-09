// ==============================================================
// KycStatusBanner
// --------------------------------------------------------------
// Renders an alert based on the startup's KYC status:
//   - unverified  → "Complete your KYC to apply for financing"
//   - under_review → "We're reviewing your documents"
//   - rejected    → with reason + "Resubmit"
//   - verified    → null (no banner needed once approved)
// ==============================================================

import { Link } from "react-router-dom";
import { AlertCircle, Clock, XCircle } from "lucide-react";
import Button from "./Button";

export default function KycStatusBanner({ startup }) {
  if (!startup || startup.kycStatus === "verified") return null;

  if (startup.kycStatus === "under_review") {
    return (
      <div className="bg-lavender-glow border border-lavender/30 rounded-lg p-5 mb-6 flex items-start gap-4">
        <Clock className="text-lavender shrink-0 mt-0.5" size={20} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink mb-1">
            We're reviewing your documents
          </p>
          <p className="text-sm text-ink-muted">
            Your KYC submission is in review. We typically respond within 2 business days.
            You'll receive an email once it's approved.
          </p>
        </div>
      </div>
    );
  }

  if (startup.kycStatus === "rejected") {
    return (
      <div className="bg-danger-soft border border-danger/30 rounded-lg p-5 mb-6">
        <div className="flex items-start gap-4">
          <XCircle className="text-danger shrink-0 mt-0.5" size={20} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink mb-1">
              KYC submission was not approved
            </p>
            {startup.kycRejectionReason && (
              <p className="text-sm text-ink-muted mb-3">
                Reason: {startup.kycRejectionReason}
              </p>
            )}
            <Link to="/profile">
              <Button size="sm" variant="danger">Resubmit documents</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // unverified
  return (
    <div className="bg-lime-glow border border-lime/30 rounded-lg p-5 mb-6">
      <div className="flex items-start gap-4">
        <AlertCircle className="text-lime shrink-0 mt-0.5" size={20} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink mb-1">
            Complete your KYC to start financing
          </p>
          <p className="text-sm text-ink-muted mb-3">
            Upload your incorporation, NTN, bank statement, and ID documents.
            Review takes 2 business days.
          </p>
          <Link to="/profile">
            <Button size="sm">Upload documents</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
