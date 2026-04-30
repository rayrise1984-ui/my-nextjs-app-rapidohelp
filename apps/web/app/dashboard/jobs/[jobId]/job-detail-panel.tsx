"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

import { JobRatingPanel } from "@/components/job-rating-panel";
import {
  jobStatusLabels,
  paymentStatusLabels,
  serviceTypeLabels,
  statusColor,
  type Job,
} from "@/lib/marketplace";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type JobDetailPanelProps = {
  jobId: string;
};

type PublicWorkerProfile = {
  id: string;
  full_name: string | null;
  worker_status: "offline" | "online" | "on_job" | null;
  worker_work_details: string | null;
  worker_experience_years: number | null;
  worker_rating_avg: number | null;
  worker_rating_count: number | null;
};

type WorkerSummary = {
  id: string;
  name: string;
  workerStatus: "offline" | "online" | "on_job";
  workDetails: string;
  experienceYears: number;
  ratingAverage: number;
  ratingCount: number;
};

const asWorkerSummary = (profile: PublicWorkerProfile): WorkerSummary => ({
  id: profile.id,
  name: profile.full_name?.trim() ? profile.full_name.trim() : "Worker",
  workerStatus: profile.worker_status ?? "offline",
  workDetails: profile.worker_work_details?.trim() ?? "",
  experienceYears: profile.worker_experience_years ?? 0,
  ratingAverage: profile.worker_rating_avg ?? 0,
  ratingCount: profile.worker_rating_count ?? 0,
});

const workerStatusLabel = (status: WorkerSummary["workerStatus"]): string => {
  if (status === "online") return "online";
  if (status === "on_job") return "on job";
  return "offline";
};

export function JobDetailPanel({ jobId }: JobDetailPanelProps) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [worker, setWorker] = useState<WorkerSummary | null>(null);
  const [loadingWorker, setLoadingWorker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = createSupabaseBrowserClient();

    if (!client) {
      setLoading(false);
      setError("Configure Supabase to view job details.");
      return;
    }

    let disposed = false;
    let authSubscription: { unsubscribe: () => void } | null = null;
    let jobChannel: ReturnType<typeof client.channel> | null = null;

    const initialize = async () => {
      const { data } = await client.auth.getSession();
      const nextSession = data.session ?? null;

      if (disposed) return;
      setSession(nextSession);

      if (!nextSession) {
        setLoading(false);
        router.replace("/auth");
        return;
      }

      const { data: jobRow, error: jobError } = await client.from("jobs").select("*").eq("id", jobId).maybeSingle();

      if (disposed) return;

      if (jobError) {
        setError(jobError.message);
      } else {
        setJob((jobRow as Job | null) ?? null);
      }

      jobChannel = client.channel(`job-detail-${jobId}`);
      (jobChannel as any)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "jobs",
            filter: `id=eq.${jobId}`,
          },
          (payload: { new: Job }) => setJob(payload.new),
        )
        .subscribe();

      authSubscription = client.auth
        .onAuthStateChange((_event, nextSessionState) => {
          setSession(nextSessionState);
          if (!nextSessionState) router.replace("/auth");
        })
        .data.subscription;

      setLoading(false);
    };

    void initialize();

    return () => {
      disposed = true;
      authSubscription?.unsubscribe();
      if (jobChannel) void client.removeChannel(jobChannel as never);
    };
  }, [jobId, router]);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    const workerId = job?.worker_id;

    if (!client || !session || !workerId) {
      setWorker(null);
      setLoadingWorker(false);
      return;
    }

    let cancelled = false;
    const loadWorker = async () => {
      setLoadingWorker(true);

      const { data, error: workerError } = await client
        .from("profiles")
        .select("id, full_name, worker_status, worker_work_details, worker_experience_years, worker_rating_avg, worker_rating_count")
        .eq("id", workerId)
        .maybeSingle();

      if (cancelled) return;

      if (workerError || !data) {
        setWorker(null);
      } else {
        setWorker(asWorkerSummary(data as PublicWorkerProfile));
      }

      setLoadingWorker(false);
    };

    void loadWorker();
    return () => {
      cancelled = true;
    };
  }, [job?.worker_id, session]);

  const markPaid = async (method: "card" | "upi") => {
    const client = createSupabaseBrowserClient();
    if (!client || !job) return;

    const dueAmount = job.final_price ?? job.estimated_price;
    if (!dueAmount || dueAmount <= 0) {
      setError("No payable amount found for this job.");
      return;
    }

    setPaying(true);
    setError(null);
    setMessage(null);

    const { data, error: updateError } = await client.rpc("mark_job_paid", {
      p_job_id: job.id,
      p_method: method,
    });

    setPaying(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setJob(data as Job);
    setMessage("Payment recorded.");
  };

  const cancelJob = async () => {
    const client = createSupabaseBrowserClient();
    if (!client || !job) return;

    setCancelling(true);
    setError(null);
    setMessage(null);

    const { data, error: cancelError } = await client.rpc("cancel_job", {
      p_job_id: job.id,
    });

    setCancelling(false);

    if (cancelError) {
      setError(cancelError.message);
      return;
    }

    setJob(data as Job);
    setMessage("Job cancelled.");
  };

  if (loading) return <div className="dashboard-loading">Loading job...</div>;
  if (!session) return <div className="dashboard-loading">Redirecting to sign-in...</div>;
  if (!job) return <div className="empty-state">Job not found or you do not have access.</div>;

  const amount = job.final_price ?? job.estimated_price;

  return (
    <section className="dashboard-grid">
      <article className="dashboard-card">
        <header className="dashboard-header">
          <div>
            <h1>{serviceTypeLabels[job.service_type]}</h1>
            <p className="dashboard-note">{job.description}</p>
          </div>
          <span className="pill" style={{ backgroundColor: statusColor(job.status), color: "white" }}>
            {jobStatusLabels[job.status]}
          </span>
        </header>

        <div className="request-meta">
          <span className="pill muted">{job.location_name ?? "Location pending"}</span>
          <span className="pill muted">{paymentStatusLabels[job.payment_status]}</span>
          <span className="pill muted">{new Date(job.created_at).toLocaleString()}</span>
        </div>

        <div className="request-item" style={{ marginTop: "16px" }}>
          <p>Customer: {job.user_id}</p>
          {amount ? <p>Amount: ${amount.toFixed(2)}</p> : null}
          {job.payment_reference ? <p>Payment reference: {job.payment_reference}</p> : null}
        </div>

        <div className="request-item" style={{ marginTop: "16px" }}>
          <h3>Assigned helper</h3>
          {!job.worker_id ? (
            <p className="dashboard-note">No helper assigned yet.</p>
          ) : loadingWorker ? (
            <p className="dashboard-note">Loading helper profile...</p>
          ) : worker ? (
            <>
              <p style={{ marginBottom: 0, fontWeight: 600 }}>{worker.name}</p>
              <p className="dashboard-note">
                Status: {workerStatusLabel(worker.workerStatus)} · Experience: {worker.experienceYears} yrs
              </p>
              <p className="dashboard-note">
                Rating: {worker.ratingCount > 0 ? `${worker.ratingAverage.toFixed(1)} (${worker.ratingCount})` : "new worker"}
              </p>
              {worker.workDetails ? <p>{worker.workDetails}</p> : null}
            </>
          ) : (
            <p className="dashboard-note">Helper profile unavailable right now.</p>
          )}
        </div>

        {job.status === "pending" ? (
          <div className="dashboard-actions" style={{ marginTop: "16px" }}>
            <button disabled={cancelling} onClick={() => void cancelJob()} type="button">
              {cancelling ? "Cancelling..." : "Cancel job"}
            </button>
          </div>
        ) : null}

        {job.status === "cancelled" ? (
          <p className="dashboard-note" style={{ marginTop: "16px" }}>
            No payment is due for this cancelled job.
          </p>
        ) : null}

        {job.status === "completed" && job.payment_status !== "paid" && amount ? (
          <div className="dashboard-actions" style={{ marginTop: "16px" }}>
            <button disabled={paying} onClick={() => void markPaid("card")} type="button">
              {paying ? "Processing..." : "Pay by card"}
            </button>
            <button disabled={paying} onClick={() => void markPaid("upi")} type="button">
              Mark paid by UPI
            </button>
          </div>
        ) : null}

        {job.status === "completed" ? (
          <div style={{ marginTop: "16px" }}>
            <JobRatingPanel
              job={job}
              onRatingSubmitted={() => setMessage("Thank you for rating.")}
            />
          </div>
        ) : null}

        {message ? <p className="auth-success">{message}</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}
      </article>
    </section>
  );
}
