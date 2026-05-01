import { ProfileCompletionGate } from "@/components/profile-completion-gate";
import { TermsAcceptanceGate } from "@/components/terms-acceptance-gate";
import { WorkerPanel } from "./_components/worker-panel";

export default function WorkerPage() {
  return (
    <ProfileCompletionGate>
      <main className="dashboard-shell">
        <div className="dashboard-header">
          <div>
            <p className="eyebrow">Earn Money, Help People</p>
            <h1>Worker profile and jobs</h1>
            <p className="lead">
              Review your work history, earnings, and active jobs in one place. Accept nearby requests,
              toggle your availability, and keep your profile ready for payouts.
            </p>
          </div>
        </div>
        <TermsAcceptanceGate>
          <WorkerPanel />
        </TermsAcceptanceGate>
      </main>
    </ProfileCompletionGate>
  );
}
