import Link from "next/link";

import { AdminRequestsPanel } from "./_components/admin-requests-panel";

export default function AdminPage() {
  return (
    <main className="dashboard-shell">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Live operations</p>
          <h1>Admin control room</h1>
          <p className="lead">
            Review jobs, support requests, worker access, and live activity from one protected staff workspace.
          </p>
        </div>
        <p>
          <Link href="/">Back to marketplace</Link>
        </p>
      </div>
      <AdminRequestsPanel />
    </main>
  );
}
