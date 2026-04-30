import Link from "next/link";

import { TermsAcceptanceGate } from "@/components/terms-acceptance-gate";
import { WorkerPanel } from "./_components/worker-panel";

export default function WorkerPage() {
  return (
    <main className="dashboard-shell">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Earn Money, Help People</p>
          <h1>Available jobs nearby</h1>
          <p className="lead">
            Browse roadside assistance requests from nearby users. Accept jobs to earn money.
            Toggle your availability and build your rating.
          </p>
        </div>
        <p>
          <Link href="/auth">Manage session</Link>
        </p>
      </div>
      <TermsAcceptanceGate>
        <WorkerPanel />
      </TermsAcceptanceGate>
    </main>
  );
}
