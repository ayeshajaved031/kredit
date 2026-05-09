// ==============================================================
// Landing Page
// --------------------------------------------------------------
// Three sections:
//   1. Hero — radial glows, headline, CTA, KPI strip
//   2. How it works — 4-step explainer
//   3. Trust strip — vendors we serve
//
// The radial glows come from the .glow-lime + .glow-lavender
// utilities in index.css. They sit absolutely behind the hero
// content (z-index: 1 on the inner wrapper).
// ==============================================================

import { Link } from "react-router-dom";
import {
  ArrowRight,
  CircleCheck,
  FileText,
  PenLine,
  Wallet,
} from "lucide-react";
import Button from "../components/Button";
import Badge from "../components/Badge";

const VENDORS = [
  "AWS", "Azure", "GCP", "Salesforce", "HubSpot",
  "Slack", "Notion", "Figma", "Zoom", "GitHub",
  "Vercel", "MongoDB Atlas", "Linear", "Mixpanel", "Twilio",
];

const STEPS = [
  {
    icon: FileText,
    title: "Apply with your vendor invoice",
    body: "Upload the annual quote from AWS, Salesforce, or any tool your team needs. We verify and decision in 2 business days.",
  },
  {
    icon: PenLine,
    title: "Sign your Murabaha contract",
    body: "Fixed markup, 12 monthly installments, fully Shariah-compliant. No interest, no compounding, no surprises.",
  },
  {
    icon: Wallet,
    title: "We pay your vendor — instantly",
    body: "Kredit settles the annual amount with your vendor on the spot. Your subscription is good for the year.",
  },
  {
    icon: CircleCheck,
    title: "Repay over 12 months",
    body: "Equal monthly installments via JazzCash, EasyPaisa, PayFast, or bank transfer. Reminders 3 days before each due date.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* HERO */}
      <section className="relative overflow-hidden glow-lime glow-lavender">
        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 pt-12 pb-24 sm:pt-20 sm:pb-32">
          <Badge tone="lavender" mono className="mb-5">
            Shariah-compliant · Murabaha
          </Badge>

          <h1 className="text-display sm:text-5xl font-medium tracking-tight max-w-3xl">
            Annual SaaS pricing.
            <br />
            <span className="text-lime">Monthly cash flow.</span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-ink-muted leading-relaxed max-w-xl">
            Kredit pays your AWS, Salesforce, and tooling bills upfront — you
            repay over 12 fixed monthly installments. Built for Pakistani
            startups, fully Murabaha-compliant.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register">
              <Button size="lg">
                Apply for financing
                <ArrowRight size={16} />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button size="lg" variant="secondary">
                See how it works
              </Button>
            </a>
          </div>

          {/* KPI strip */}
          <div className="mt-14 pt-8 border-t border-divider grid grid-cols-3 gap-6 max-w-2xl">
            <div>
              <p className="font-mono text-h2 font-medium text-lime">15-30%</p>
              <p className="mt-1 text-xs text-ink-muted">
                Savings vs monthly billing
              </p>
            </div>
            <div>
              <p className="font-mono text-h2 font-medium text-lavender">12 mo</p>
              <p className="mt-1 text-xs text-ink-muted">
                Fixed, transparent terms
              </p>
            </div>
            <div>
              <p className="font-mono text-h2 font-medium text-ink">0%</p>
              <p className="mt-1 text-xs text-ink-muted">Interest. Riba-free.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="border-t border-divider">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-mono uppercase tracking-wider text-lavender mb-3">
              How it works
            </p>
            <h2 className="text-h1 font-medium">
              Get your tools today, pay over the year.
            </h2>
            <p className="mt-3 text-ink-muted leading-relaxed">
              Four steps. No hidden charges, no compounding interest, no
              surprises in month nine.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className="bg-surface border border-divider rounded-lg p-5"
              >
                <div className="w-9 h-9 rounded-md bg-lime-glow flex items-center justify-center mb-4 text-lime">
                  <step.icon size={18} strokeWidth={1.75} />
                </div>
                <p className="font-mono text-xs text-ink-muted mb-2">
                  STEP {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="text-base font-medium mb-2 leading-snug">
                  {step.title}
                </h3>
                <p className="text-sm text-ink-muted leading-relaxed">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VENDOR STRIP */}
      <section className="border-t border-divider">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
          <p className="text-center text-xs font-mono uppercase tracking-wider text-ink-muted mb-8">
            Finance subscriptions to
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {VENDORS.map((v) => (
              <span
                key={v}
                className="text-sm text-ink-muted/70 hover:text-ink transition-colors"
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-divider">
        <div className="max-w-3xl mx-auto px-6 sm:px-10 py-20 text-center">
          <h2 className="text-h1 font-medium mb-3">
            Ready to keep your runway?
          </h2>
          <p className="text-ink-muted mb-7">
            Sign up takes 2 minutes. KYC review takes 2 business days.
          </p>
          <Link to="/register">
            <Button size="lg">
              Create your Kredit account
              <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
