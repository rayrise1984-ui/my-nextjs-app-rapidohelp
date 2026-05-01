"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

import {
  jobStatusLabels,
  paymentStatusLabels,
  serviceTypeLabels,
  sortJobs,
  statusColor,
  type AppRole,
  type Job,
  type JobStatus,
  type ServiceType,
} from "@/lib/marketplace";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const HELPER_BACKGROUND_CHECK_CONSENT_VERSION = "helper_background_check_v1";

type AdminWorkerProfile = {
  id: string;
  full_name: string | null;
  role: AppRole | null;
  is_worker: boolean | null;
  worker_status: "offline" | "online" | "on_job" | null;
  worker_work_details: string | null;
  worker_experience_years: number | null;
  worker_rating_avg: number | null;
  worker_rating_count: number | null;
  total_earnings: number | null;
  worker_profile_completed: boolean | null;
  worker_verified: boolean | null;
  worker_disabled: boolean | null;
  worker_background_check_consent_at: string | null;
  worker_background_check_consent_platform: string | null;
  worker_background_check_consent_version: string | null;
  service_types: ServiceType[] | null;
  updated_at: string | null;
};

type WorkerBackgroundCheck = {
  worker_id: string;
  legal_full_name: string | null;
  ssn_last4: string | null;
  driver_license_number: string | null;
  driver_license_state: string | null;
  legal_address_line1: string | null;
  legal_address_line2: string | null;
  legal_city: string | null;
  legal_state: string | null;
  legal_postal_code: string | null;
  status: string | null;
  submitted_at: string | null;
};

type WorkerAccessDraft = {
  worker_verified: boolean;
  worker_disabled: boolean;
};

const adminStatuses: JobStatus[] = [
  "pending",
  "accepted",
  "in_progress",
  "completed",
  "cancelled",
  "cancelled_by_worker",
];

const normalizeWorker = (worker: AdminWorkerProfile): AdminWorkerProfile => ({
  ...worker,
  service_types: worker.service_types ?? [],
  worker_verified: worker.worker_verified ?? false,
  worker_disabled: worker.worker_disabled ?? false,
  worker_profile_completed: worker.worker_profile_completed ?? false,
  total_earnings: worker.total_earnings ?? 0,
  worker_rating_avg: worker.worker_rating_avg ?? 0,
  worker_rating_count: worker.worker_rating_count ?? 0,
});

const workerHasCurrentConsent = (worker: AdminWorkerProfile) =>
  Boolean(
    worker.worker_background_check_consent_at &&
      worker.worker_background_check_consent_platform &&
      worker.worker_background_check_consent_version === HELPER_BACKGROUND_CHECK_CONSENT_VERSION,
  );

const workerQueueRank = (worker: AdminWorkerProfile) => {
  if (worker.worker_disabled) return 3;
  if (!worker.worker_profile_completed) return 1;
  if (worker.worker_profile_completed && !workerHasCurrentConsent(worker)) return 0;
  if (worker.worker_profile_completed && !worker.worker_verified) return 1;
  return 2;
};

const sortWorkers = (workers: AdminWorkerProfile[]) =>
  [...workers]
    .map(normalizeWorker)
    .sort((a, b) => {
      const rankDiff = workerQueueRank(a) - workerQueueRank(b);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime();
    });

const workerReviewLabel = (worker: AdminWorkerProfile) => {
  if (worker.worker_disabled) return "Paused";
  if (!worker.worker_profile_completed) return "Profile incomplete";
  if (!workerHasCurrentConsent(worker)) return "Consent required";
  if (!worker.worker_verified) return "Pending review";
  return "Approved";
};

const workerReviewColor = (worker: AdminWorkerProfile) => {
  if (worker.worker_disabled) return "#8A1C0F";
  if (!worker.worker_profile_completed) return "#999999";
  if (!workerHasCurrentConsent(worker)) return "#8C4B00";
  if (!worker.worker_verified) return "#C77800";
  return "#2E7D32";
};

export function AdminRequestsPanel() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<AdminWorkerProfile[]>([]);
  const [backgroundChecksByWorkerId, setBackgroundChecksByWorkerId] = useState<Record<string, WorkerBackgroundCheck>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, JobStatus>>({});
  const [workerDrafts, setWorkerDrafts] = useState<Record<string, WorkerAccessDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  const [savingWorkerId, setSavingWorkerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = createSupabaseBrowserClient();

    if (!client) {
      setLoading(false);
      setError("Live admin services are not available yet. Please try again shortly.");
      return;
    }

    let disposed = false;
    let authSubscription: { unsubscribe: () => void } | null = null;
    let jobChannel: ReturnType<typeof client.channel> | null = null;
    let profileChannel: ReturnType<typeof client.channel> | null = null;
    let backgroundChannel: ReturnType<typeof client.channel> | null = null;

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

      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("role")
        .eq("id", nextSession.user.id)
        .maybeSingle();

      if (disposed) return;

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      const nextRole = (profile?.role ?? "customer") as AppRole;
      setRole(nextRole);

      if (nextRole === "customer") {
        setLoading(false);
        router.replace("/dashboard");
        return;
      }

      const [jobsResult, workersResult, backgroundChecksResult] = await Promise.all([
        client.from("jobs").select("*").order("created_at", { ascending: false }),
        client
          .from("profiles")
          .select(
            "id, full_name, role, is_worker, worker_status, worker_work_details, worker_experience_years, worker_rating_avg, worker_rating_count, total_earnings, worker_profile_completed, worker_verified, worker_disabled, worker_background_check_consent_at, worker_background_check_consent_platform, worker_background_check_consent_version, service_types, updated_at",
          )
          .eq("is_worker", true)
          .order("updated_at", { ascending: false }),
        client
          .from("worker_background_checks")
          .select(
            "worker_id, legal_full_name, ssn_last4, driver_license_number, driver_license_state, legal_address_line1, legal_address_line2, legal_city, legal_state, legal_postal_code, status, submitted_at",
          )
          .order("updated_at", { ascending: false }),
      ]);

      if (disposed) return;

      if (jobsResult.error) {
        setError(jobsResult.error.message);
      } else {
        const nextJobs = sortJobs((jobsResult.data ?? []) as Job[]);
        setJobs(nextJobs);
        setStatusDrafts(Object.fromEntries(nextJobs.map((job) => [job.id, job.status])));
      }

      if (workersResult.error) {
        setError(workersResult.error.message);
      } else {
        const nextWorkers = sortWorkers((workersResult.data ?? []) as AdminWorkerProfile[]);
        setWorkers(nextWorkers);
        setWorkerDrafts(
          Object.fromEntries(
            nextWorkers.map((worker) => [
              worker.id,
              {
                worker_verified: worker.worker_verified ?? false,
                worker_disabled: worker.worker_disabled ?? false,
              },
            ]),
          ),
        );
      }

      if (backgroundChecksResult.error) {
        setError(backgroundChecksResult.error.message);
      } else {
        const nextBackgroundChecks = (backgroundChecksResult.data ?? []) as WorkerBackgroundCheck[];
        setBackgroundChecksByWorkerId(
          Object.fromEntries(nextBackgroundChecks.map((check) => [check.worker_id, check])),
        );
      }

      jobChannel = client.channel(`admin-jobs-${nextSession.user.id}`);
      (jobChannel as any)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "jobs",
          },
          (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Job; old: { id?: string } }) => {
            if (payload.eventType === "DELETE") {
              const deletedId = payload.old.id;
              if (!deletedId) return;
              setJobs((current) => current.filter((job) => job.id !== deletedId));
              setStatusDrafts((current) => {
                const next = { ...current };
                delete next[deletedId];
                return next;
              });
              return;
            }

            setJobs((current) => sortJobs([payload.new, ...current.filter((job) => job.id !== payload.new.id)]));
            setStatusDrafts((current) => ({ ...current, [payload.new.id]: payload.new.status }));
          },
        )
        .subscribe();

      profileChannel = client.channel(`admin-workers-${nextSession.user.id}`);
      (profileChannel as any)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
          },
          (payload: { new: AdminWorkerProfile }) => {
            const updated = normalizeWorker(payload.new);

            if (updated.id === nextSession.user.id && updated.role) {
              setRole(updated.role);
            }

            setWorkers((current) => {
              if (!updated.is_worker) {
                return current.filter((worker) => worker.id !== updated.id);
              }
              return sortWorkers([updated, ...current.filter((worker) => worker.id !== updated.id)]);
            });
            setWorkerDrafts((current) => ({
              ...current,
              [updated.id]: {
                worker_verified: updated.worker_verified ?? false,
                worker_disabled: updated.worker_disabled ?? false,
              },
            }));
          },
        )
        .subscribe();

      backgroundChannel = client.channel(`admin-background-checks-${nextSession.user.id}`);
      (backgroundChannel as any)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "worker_background_checks",
          },
          (payload: {
            eventType: "INSERT" | "UPDATE" | "DELETE";
            new: WorkerBackgroundCheck;
            old: { worker_id?: string };
          }) => {
            setBackgroundChecksByWorkerId((current) => {
              if (payload.eventType === "DELETE") {
                const next = { ...current };
                if (payload.old.worker_id) delete next[payload.old.worker_id];
                return next;
              }

              return { ...current, [payload.new.worker_id]: payload.new };
            });
          },
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
      if (profileChannel) void client.removeChannel(profileChannel as never);
      if (backgroundChannel) void client.removeChannel(backgroundChannel as never);
    };
  }, [router]);

  const metrics = useMemo(() => {
    const completedJobs = jobs.filter((job) => job.status === "completed");
    const gross = completedJobs.reduce((sum, job) => sum + Number(job.final_price ?? job.estimated_price ?? 0), 0);
    const pendingWorkerConsent = workers.filter(
      (worker) => worker.worker_profile_completed && !workerHasCurrentConsent(worker) && !worker.worker_disabled,
    ).length;
    const pendingWorkerReviews = workers.filter(
      (worker) => worker.worker_profile_completed && workerHasCurrentConsent(worker) && !worker.worker_verified && !worker.worker_disabled,
    ).length;
    const approvedWorkers = workers.filter((worker) => worker.worker_verified && !worker.worker_disabled).length;
    const pausedWorkers = workers.filter((worker) => worker.worker_disabled).length;
    const onlineWorkers = workers.filter(
      (worker) => worker.worker_verified && !worker.worker_disabled && worker.worker_status === "online",
    ).length;

    return {
      open: jobs.filter((job) => job.status === "pending").length,
      active: jobs.filter((job) => job.status === "accepted" || job.status === "in_progress").length,
      completed: completedJobs.length,
      gross,
      pendingWorkerConsent,
      pendingWorkerReviews,
      approvedWorkers,
      pausedWorkers,
      onlineWorkers,
    };
  }, [jobs, workers]);

  const saveStatus = async (jobId: string) => {
    const client = createSupabaseBrowserClient();
    const nextStatus = statusDrafts[jobId];

    if (!client || !session || !role || role === "customer" || !nextStatus) {
      router.replace("/auth");
      return;
    }

    setSavingJobId(jobId);
    setError(null);
    setMessage(null);

    const { data, error: updateError } = await client.rpc("staff_update_job_status", {
      p_job_id: jobId,
      p_status: nextStatus,
    });

    setSavingJobId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const updated = data as Job;
    setJobs((current) => sortJobs([updated, ...current.filter((job) => job.id !== jobId)]));
    setMessage("Job status updated.");
  };

  const saveWorkerAccess = async (workerId: string) => {
    const client = createSupabaseBrowserClient();
    const nextDraft = workerDrafts[workerId];

    if (!client || !session || !role || role === "customer" || !nextDraft) {
      router.replace("/auth");
      return;
    }

    setSavingWorkerId(workerId);
    setError(null);
    setMessage(null);

    const { data, error: updateError } = await client.rpc("staff_update_worker_access", {
      p_worker_id: workerId,
      p_worker_verified: nextDraft.worker_verified,
      p_worker_disabled: nextDraft.worker_disabled,
    });

    setSavingWorkerId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const updated = normalizeWorker(data as AdminWorkerProfile);
    setWorkers((current) => sortWorkers([updated, ...current.filter((worker) => worker.id !== workerId)]));
    setWorkerDrafts((current) => ({
      ...current,
      [workerId]: {
        worker_verified: updated.worker_verified ?? false,
        worker_disabled: updated.worker_disabled ?? false,
      },
    }));
    setMessage("Worker access updated.");
  };

  if (loading) return <div className="dashboard-loading">Loading admin workspace...</div>;
  if (!session) return <div className="dashboard-loading">Redirecting to sign-in...</div>;
  if (role === "customer") return <div className="dashboard-loading">Redirecting to dashboard...</div>;

  return (
    <section className="dashboard-grid">
      <div className="dashboard-stack">
        <article className="dashboard-card">
          <h2>Worker review queue</h2>
          <p className="dashboard-note">Approve completed worker profiles, pause service access, and track who is live.</p>

          {workers.length === 0 ? (
            <div className="empty-state">No worker profiles found yet.</div>
          ) : (
            <div className="request-list">
              {workers.map((worker) => {
                const accessDraft = workerDrafts[worker.id] ?? {
                  worker_verified: worker.worker_verified ?? false,
                  worker_disabled: worker.worker_disabled ?? false,
                };
                const backgroundCheck = backgroundChecksByWorkerId[worker.id];
                const services = (worker.service_types ?? []).map((type) => serviceTypeLabels[type]).join(", ");
                const isDirty =
                  accessDraft.worker_verified !== (worker.worker_verified ?? false) ||
                  accessDraft.worker_disabled !== (worker.worker_disabled ?? false);

                return (
                  <div className="request-item" key={worker.id}>
                    <header>
                      <div>
                        <h3>{worker.full_name?.trim() ? worker.full_name.trim() : "Worker account"}</h3>
                        <p className="request-caption">Worker ID: {worker.id}</p>
                        <p className="request-caption">Role: {worker.role ?? "customer"}</p>
                      </div>
                      <span className="pill" style={{ backgroundColor: workerReviewColor(worker), color: "white" }}>
                        {workerReviewLabel(worker)}
                      </span>
                    </header>

                    {worker.worker_work_details ? <p>{worker.worker_work_details}</p> : <p className="dashboard-note">No work details submitted yet.</p>}

                    <div className="request-meta">
                      <span className="pill muted">
                        Status: {worker.worker_status?.replaceAll("_", " ") ?? "offline"}
                      </span>
                      <span className="pill muted">
                        {worker.worker_experience_years ?? 0} yrs experience
                      </span>
                      <span className="pill muted">
                        Rating {(worker.worker_rating_avg ?? 0).toFixed(1)} ({worker.worker_rating_count ?? 0})
                      </span>
                      <span className="pill muted">
                        Earnings ${(worker.total_earnings ?? 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="request-meta">
                      <span className="pill muted">
                        {worker.worker_profile_completed ? "Profile complete" : "Profile incomplete"}
                      </span>
                      <span className="pill muted">
                        Consent: {workerHasCurrentConsent(worker)
                          ? `on file via ${worker.worker_background_check_consent_platform}`
                          : "required"}
                      </span>
                      <span className="pill muted">
                        Background: {backgroundCheck?.status?.replaceAll("_", " ") ?? "not submitted"}
                      </span>
                      <span className="pill muted">{services || "No services selected"}</span>
                    </div>

                    {backgroundCheck ? (
                      <div className="request-meta">
                        <span className="pill muted">Legal name: {backgroundCheck.legal_full_name}</span>
                        <span className="pill muted">SSN last 4: {backgroundCheck.ssn_last4}</span>
                        <span className="pill muted">
                          DL: {backgroundCheck.driver_license_state} {backgroundCheck.driver_license_number}
                        </span>
                        <span className="pill muted">
                          Address: {[
                            backgroundCheck.legal_address_line1,
                            backgroundCheck.legal_address_line2,
                            backgroundCheck.legal_city,
                            backgroundCheck.legal_state,
                            backgroundCheck.legal_postal_code,
                          ].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    ) : (
                      <p className="dashboard-note">Background check details have not been submitted yet.</p>
                    )}

                    <div className="request-admin-actions">
                      <label className="admin-toggle">
                        <input
                          checked={accessDraft.worker_verified}
                          onChange={(event) =>
                            setWorkerDrafts((current) => ({
                              ...current,
                              [worker.id]: {
                                ...accessDraft,
                                worker_verified: event.target.checked,
                              },
                            }))
                          }
                          type="checkbox"
                        />
                        <span>Verified</span>
                      </label>
                      <label className="admin-toggle">
                        <input
                          checked={accessDraft.worker_disabled}
                          onChange={(event) =>
                            setWorkerDrafts((current) => ({
                              ...current,
                              [worker.id]: {
                                ...accessDraft,
                                worker_disabled: event.target.checked,
                              },
                            }))
                          }
                          type="checkbox"
                        />
                        <span>Paused</span>
                      </label>
                      <button
                        disabled={savingWorkerId === worker.id || !isDirty}
                        onClick={() => void saveWorkerAccess(worker.id)}
                        type="button"
                      >
                        {savingWorkerId === worker.id ? "Saving..." : "Save worker access"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="dashboard-card">
          <h2>Live jobs</h2>
          <p className="dashboard-note">Monitor job flow, resolve stuck work, and correct status when field ops need help.</p>

          {jobs.length === 0 ? (
            <div className="empty-state">No jobs have been posted yet.</div>
          ) : (
            <div className="request-list">
              {jobs.map((job) => (
                <div className="request-item" key={job.id}>
                  <header>
                    <div>
                      <h3>{serviceTypeLabels[job.service_type]}</h3>
                      <p className="request-caption">Customer: {job.user_id}</p>
                      {job.worker_id ? <p className="request-caption">Worker: {job.worker_id}</p> : null}
                    </div>
                    <span className="pill" style={{ backgroundColor: statusColor(job.status), color: "white" }}>
                      {jobStatusLabels[job.status]}
                    </span>
                  </header>

                  <p>{job.description}</p>

                  <div className="request-meta">
                    <span className="pill muted">{job.location_name ?? "Location pending"}</span>
                    <span className="pill muted">{paymentStatusLabels[job.payment_status]}</span>
                    <span className="pill muted">
                      ${(job.final_price ?? job.estimated_price ?? 0).toFixed(2)}
                    </span>
                    <span className="pill muted">{new Date(job.created_at).toLocaleString()}</span>
                  </div>

                  <div className="request-admin-actions">
                    <select
                      onChange={(event) =>
                        setStatusDrafts((current) => ({
                          ...current,
                          [job.id]: event.target.value as JobStatus,
                        }))
                      }
                      value={statusDrafts[job.id] ?? job.status}
                    >
                      {adminStatuses.map((status) => (
                        <option key={status} value={status}>
                          {jobStatusLabels[status]}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={savingJobId === job.id || (statusDrafts[job.id] ?? job.status) === job.status}
                      onClick={() => void saveStatus(job.id)}
                      type="button"
                    >
                      {savingJobId === job.id ? "Saving..." : "Update status"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <div className="dashboard-stack">
        <article className="dashboard-card">
          <h2>Operations snapshot</h2>
          <div className="request-meta">
            <span className="pill muted">{metrics.open} open jobs</span>
            <span className="pill muted">{metrics.active} active jobs</span>
            <span className="pill muted">{metrics.completed} completed jobs</span>
            <span className="pill muted">{metrics.onlineWorkers} workers online</span>
          </div>
          <div className="request-meta">
            <span className="pill muted">{metrics.pendingWorkerConsent} waiting on consent</span>
            <span className="pill muted">{metrics.pendingWorkerReviews} pending reviews</span>
            <span className="pill muted">{metrics.approvedWorkers} approved workers</span>
            <span className="pill muted">{metrics.pausedWorkers} paused workers</span>
          </div>
          <p className="dashboard-note">Gross completed value: ${metrics.gross.toFixed(2)}</p>
        </article>

        <article className="dashboard-card">
          <h2>Staff account</h2>
          <p>
            Signed in as <strong>{session.user.email ?? session.user.id}</strong>
          </p>
          <p className="dashboard-note">Role: {role}</p>
          <p className="dashboard-note">Grant access by setting `profiles.role` to `agent` or `admin`.</p>
        </article>

        {message ? <p className="auth-success">{message}</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}
      </div>
    </section>
  );
}
