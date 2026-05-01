import Link from "next/link";

import { ProfileCompletionGate } from "@/components/profile-completion-gate";
import { TermsAcceptanceGate } from "@/components/terms-acceptance-gate";
import { AdminRequestsPanel } from "./_components/admin-requests-panel";

export default function AdminPage() {
  return (
    <ProfileCompletionGate>
      <main className="dashboard-shell">
        <div className="dashboard-header">
          <div>
            <p className="eyebrow">Live operations</p>
            <h1>Admin control room</h1>
            <p className="lead">
              Review jobs, approve worker access, and keep service requests moving from one protected staff workspace.
            </p>
          </div>
          <p>
            <Link href="/dashboard">Back to customer dashboard</Link>
          </p>
        </div>
        <TermsAcceptanceGate>
          <AdminRequestsPanel />
        </TermsAcceptanceGate>
      </main>
    </ProfileCompletionGate>
  );
}
