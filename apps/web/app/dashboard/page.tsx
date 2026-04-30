import Link from "next/link";
import { Suspense } from "react";

import { TermsAcceptanceGate } from "@/components/terms-acceptance-gate";
import { DashboardPanel } from "./_components/dashboard-panel";

export default function DashboardPage() {
  return (
    <main className="dashboard-shell">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Roadside Assistance</p>
          <h1>Book help now</h1>
          <p className="lead">
            Describe your situation and we'll match you with a verified helper nearby.
            Real-time tracking, transparent pricing, and ratings-based trust.
          </p>
        </div>
        <p>
          <Link href="/auth">Manage session</Link>
        </p>
      </div>
      <Suspense fallback={<div className="dashboard-loading">Loading booking form...</div>}>
        <TermsAcceptanceGate>
          <DashboardPanel />
        </TermsAcceptanceGate>
      </Suspense>
    </main>
  );
}
