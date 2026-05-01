import Link from "next/link";

import { ProfileCompletionGate } from "@/components/profile-completion-gate";

export default function ProfilePage() {
  return (
    <ProfileCompletionGate>
      <main className="dashboard-shell">
        <div className="dashboard-header">
          <div>
            <p className="eyebrow">Required Profile</p>
            <h1>Your profile is ready</h1>
            <p className="lead">
              If you were not redirected automatically, continue into RapidoHelp from here.
            </p>
          </div>
        </div>
        <section className="dashboard-grid">
          <article className="dashboard-card terms-card">
            <p className="dashboard-note">
              Your account profile has been saved successfully.
            </p>
            <div className="dashboard-actions">
              <Link href="/dashboard">Continue</Link>
            </div>
          </article>
        </section>
      </main>
    </ProfileCompletionGate>
  );
}
