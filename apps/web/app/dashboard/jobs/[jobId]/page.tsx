import Link from "next/link";

import { TermsAcceptanceGate } from "@/components/terms-acceptance-gate";
import { JobDetailPanel } from "./job-detail-panel";

type JobDetailPageProps = {
  params: Promise<{
    jobId: string;
  }>;
};

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { jobId } = await params;

  return (
    <main className="dashboard-shell">
      <p>
        <Link href="/dashboard">Back to dashboard</Link>
      </p>
      <TermsAcceptanceGate>
        <JobDetailPanel jobId={jobId} />
      </TermsAcceptanceGate>
    </main>
  );
}
