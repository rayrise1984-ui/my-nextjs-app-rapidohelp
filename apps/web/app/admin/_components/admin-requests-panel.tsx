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
import { groupCommentsByRequest, type SupportRequest, type SupportRequestComment } from "@/lib/support";
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
  updated_at: string | null;
};

type AdminSupportRequest = SupportRequest & {
  updated_at: string;
};

type AdminSupportComment = SupportRequestComment;

type ActivityEvent = {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  title: string;
  summary: string;
  created_at: string;
};

type AdminActivityItem = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  tone: "info" | "success" | "warn" | "danger";
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

const sortSupportRequests = (requests: AdminSupportRequest[]) =>
  [...requests].sort(
    (left, right) =>
      new Date(right.updated_at ?? right.created_at).getTime() -
      new Date(left.updated_at ?? left.created_at).getTime(),
  );

const truncateText = (value: string, maxLength = 112) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;

const activityToneColor = (tone: AdminActivityItem["tone"]) => {
  switch (tone) {
    case "success":
      return "#2E7D32";
    case "warn":
      return "#8C4B00";
    case "danger":
      return "#8A1C0F";
    default:
      return "#005de8";
  }
};

export function AdminRequestsPanel() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<AdminWorkerProfile[]>([]);
  const [backgroundChecksByWorkerId, setBackgroundChecksByWorkerId] = useState<Record<string, WorkerBackgroundCheck>>({});
  const [supportRequests, setSupportRequests] = useState<AdminSupportRequest[]>([]);
  const [supportComments, setSupportComments] = useState<AdminSupportComment[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
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
    let supportRequestChannel: ReturnType<typeof client.channel> | null = null;
    let supportCommentChannel: ReturnType<typeof client.channel> | null = null;
    let activityChannel: ReturnType<typeof client.channel> | null = null;

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

      const [
        jobsResult,
        workersResult,
        backgroundChecksResult,
        supportRequestsResult,
        supportCommentsResult,
        activityEventsResult,
      ] = await Promise.all([
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
            "worker_id, legal_full_name, ssn_last4, driver_license_number, driver_license_state, legal_address_line1, legal_address_line2, legal_city, legal_state, legal_postal_code, status, submitted_at, updated_at",
          )
          .order("updated_at", { ascending: false }),
        client
          .from("support_requests")
          .select("id, user_id, title, description, priority, status, created_at, updated_at")
          .order("updated_at", { ascending: false }),
        client
          .from("support_request_comments")
          .select("id, request_id, author_id, body, is_internal, created_at")
          .order("created_at", { ascending: false }),
        client
          .from("activity_events")
          .select("id, actor_id, entity_type, entity_id, action, title, summary, created_at")
          .order("created_at", { ascending: false }),
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

      if (supportRequestsResult.error) {
        setError(supportRequestsResult.error.message);
      } else {
        const nextSupportRequests = sortSupportRequests((supportRequestsResult.data ?? []) as AdminSupportRequest[]);
        setSupportRequests(nextSupportRequests);
      }

      if (supportCommentsResult.error) {
        setError(supportCommentsResult.error.message);
      } else {
        setSupportComments((supportCommentsResult.data ?? []) as AdminSupportComment[]);
      }

      if (activityEventsResult.error) {
        setError(activityEventsResult.error.message);
      } else {
        setActivityEvents((activityEventsResult.data ?? []) as ActivityEvent[]);
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

      supportRequestChannel = client.channel(`admin-support-requests-${nextSession.user.id}`);
      (supportRequestChannel as any)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "support_requests",
          },
          (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: AdminSupportRequest; old: { id?: string } }) => {
            if (payload.eventType === "DELETE") {
              const deletedId = payload.old.id;
              if (!deletedId) return;
              setSupportRequests((current) => current.filter((request) => request.id !== deletedId));
              return;
            }

            setSupportRequests((current) =>
              sortSupportRequests([payload.new, ...current.filter((request) => request.id !== payload.new.id)]),
            );
          },
        )
        .subscribe();

      supportCommentChannel = client.channel(`admin-support-comments-${nextSession.user.id}`);
      (supportCommentChannel as any)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "support_request_comments",
          },
          (payload: {
            eventType: "INSERT" | "UPDATE" | "DELETE";
            new: AdminSupportComment;
            old: { id?: string };
          }) => {
            setSupportComments((current) => {
              if (payload.eventType === "DELETE") {
                const deletedId = payload.old.id;
                if (!deletedId) return current;
                return current.filter((comment) => comment.id !== deletedId);
              }

              return [payload.new, ...current.filter((comment) => comment.id !== payload.new.id)];
            });
          },
        )
        .subscribe();

      activityChannel = client.channel(`admin-activity-${nextSession.user.id}`);
      (activityChannel as any)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "activity_events",
          },
          (payload: { new: ActivityEvent }) => {
            setActivityEvents((current) => [payload.new, ...current.filter((event) => event.id !== payload.new.id)]);
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
      if (supportRequestChannel) void client.removeChannel(supportRequestChannel as never);
      if (supportCommentChannel) void client.removeChannel(supportCommentChannel as never);
      if (activityChannel) void client.removeChannel(activityChannel as never);
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
    const openSupportRequests = supportRequests.filter((request) => request.status === "open").length;
    const activeSupportRequests = supportRequests.filter((request) => request.status === "in_progress").length;
    const resolvedSupportRequests = supportRequests.filter(
      (request) => request.status === "resolved" || request.status === "closed",
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
      openSupportRequests,
      activeSupportRequests,
      resolvedSupportRequests,
    };
  }, [jobs, supportRequests, workers]);

  const activityItems = useMemo(() => {
    const supportCommentsByRequestId = groupCommentsByRequest(supportComments);

    const jobItems: AdminActivityItem[] = jobs.flatMap((job) => {
      const location = job.location_name?.trim() || job.service_address?.trim() || "Location pending";
      const value = Number(job.final_price ?? job.estimated_price ?? 0).toFixed(2);
      const items: Array<AdminActivityItem | null> = [
        {
          id: `job:${job.id}:created`,
          title: `Job posted for ${serviceTypeLabels[job.service_type]}`,
          detail: `${location} · ${paymentStatusLabels[job.payment_status]}`,
          timestamp: job.created_at,
          tone: "info",
        },
      ];

      if (job.accepted_at) {
        items.push({
          id: `job:${job.id}:accepted`,
          title: "Job accepted",
          detail: job.worker_id ? `Service partner ${job.worker_id}` : "Partner assignment confirmed",
          timestamp: job.accepted_at,
          tone: "info",
        });
      }

      if (job.completed_at) {
        items.push({
          id: `job:${job.id}:completed`,
          title: "Job completed",
          detail: `Final value $${value} · ${job.payment_status === "paid" ? "Paid" : paymentStatusLabels[job.payment_status]}`,
          timestamp: job.completed_at,
          tone: "success",
        });
      } else if (job.status === "cancelled" || job.status === "cancelled_by_worker") {
        items.push({
          id: `job:${job.id}:cancelled`,
          title: `Job ${jobStatusLabels[job.status]}`,
          detail: `${location} · ${paymentStatusLabels[job.payment_status]}`,
          timestamp: job.updated_at,
          tone: "danger",
        });
      } else {
        items.push({
          id: `job:${job.id}:status`,
          title: `Job ${jobStatusLabels[job.status]}`,
          detail: `${location} · ${paymentStatusLabels[job.payment_status]}`,
          timestamp: job.updated_at,
          tone: "info",
        });
      }

      if (job.paid_at) {
        items.push({
          id: `job:${job.id}:paid`,
          title: "Payment recorded",
          detail: `${paymentStatusLabels[job.payment_status]} · ${job.payment_method ?? job.booking_payment_method ?? "payment method not set"}`,
          timestamp: job.paid_at,
          tone: job.payment_status === "paid" ? "success" : "warn",
        });
      }

      return items.filter(Boolean) as AdminActivityItem[];
    });

    const workerItems: AdminActivityItem[] = workers.map((worker) => ({
      id: `worker:${worker.id}:${worker.updated_at ?? worker.id}`,
      title: worker.worker_verified
        ? "Service partner profile approved"
        : worker.worker_disabled
          ? "Service partner profile paused"
          : worker.worker_profile_completed
            ? "Service partner profile ready for review"
            : "Service partner profile incomplete",
      detail: `${worker.full_name?.trim() || worker.id} · ${
        worker.worker_disabled
          ? "Paused"
          : worker.worker_verified
            ? "Approved"
            : workerHasCurrentConsent(worker)
              ? "Consent on file"
              : "Consent required"
      }`,
      timestamp: worker.updated_at ?? "1970-01-01T00:00:00.000Z",
      tone: worker.worker_disabled ? "warn" : worker.worker_verified ? "success" : "info",
    }));

    const supportRequestItems: AdminActivityItem[] = supportRequests.map((request) => {
      const comments = supportCommentsByRequestId[request.id] ?? [];
      const latestComment = comments[comments.length - 1];
      return {
        id: `support:${request.id}:${request.updated_at}`,
        title: `Support request ${request.status.replaceAll("_", " ")}`,
        detail: latestComment
          ? `${request.title} · ${truncateText(latestComment.body)}`
          : `${request.title} · ${request.priority} priority`,
        timestamp: request.updated_at ?? request.created_at,
        tone:
          request.status === "resolved" || request.status === "closed"
            ? "success"
            : request.status === "in_progress"
              ? "warn"
              : "info",
      };
    });

    const supportCommentItems: AdminActivityItem[] = supportComments.map((comment) => ({
      id: `support-comment:${comment.id}`,
      title: comment.is_internal ? "Internal support note" : "Customer support reply",
      detail: truncateText(comment.body),
      timestamp: comment.created_at,
      tone: comment.is_internal ? "warn" : "info",
    }));

    const backgroundItems: AdminActivityItem[] = Object.values(backgroundChecksByWorkerId).map((check) => ({
      id: `background:${check.worker_id}:${check.updated_at ?? check.submitted_at ?? check.worker_id}`,
      title: `Background check ${check.status ?? "submitted"}`,
      detail: [
        check.legal_full_name,
        check.driver_license_state && check.driver_license_number
          ? `${check.driver_license_state} ${check.driver_license_number}`
          : null,
        check.legal_city,
        check.legal_state,
      ]
        .filter(Boolean)
        .join(" · "),
      timestamp: check.updated_at ?? check.submitted_at ?? "1970-01-01T00:00:00.000Z",
      tone: check.status === "cleared" ? "success" : check.status === "rejected" ? "danger" : "warn",
    }));

    return [...jobItems, ...workerItems, ...supportRequestItems, ...supportCommentItems, ...backgroundItems]
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
      .slice(0, 15);
  }, [backgroundChecksByWorkerId, jobs, supportComments, supportRequests, workers]);

  const supportCommentsByRequestId = useMemo(() => groupCommentsByRequest(supportComments), [supportComments]);

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
    setMessage("Service partner access updated.");
  };

  if (loading) return <div className="dashboard-loading">Loading admin workspace...</div>;
  if (!session) return <div className="dashboard-loading">Redirecting to sign-in...</div>;
  if (role === "customer") return <div className="dashboard-loading">Redirecting to dashboard...</div>;

  return (
    <section className="dashboard-grid">
      <div className="dashboard-stack">
        <article className="dashboard-card">
          <h2>Service partner review queue</h2>
          <p className="dashboard-note">Approve completed worker profiles, pause service access, and track who is live.</p>

          {workers.length === 0 ? (
            <div className="empty-state">No service partner profiles found yet.</div>
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
                        <h3>{worker.full_name?.trim() ? worker.full_name.trim() : "Service partner account"}</h3>
                        <p className="request-caption">Service partner ID: {worker.id}</p>
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
                        {savingWorkerId === worker.id ? "Saving..." : "Save partner access"}
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
                      {job.worker_id ? <p className="request-caption">Service partner: {job.worker_id}</p> : null}
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

        <article className="dashboard-card">
          <h2>Support inbox</h2>
          <p className="dashboard-note">See customer support requests, staff replies, and the latest note on each request.</p>

          {supportRequests.length === 0 ? (
            <div className="empty-state">No support requests have been created yet.</div>
          ) : (
            <div className="request-list">
              {supportRequests.map((request) => {
                const requestComments = supportCommentsByRequestId[request.id] ?? [];
                const latestComment = requestComments[requestComments.length - 1];

                return (
                  <div className="request-item" key={request.id}>
                    <header>
                      <div>
                        <h3>{request.title}</h3>
                        <p className="request-caption">Request ID: {request.id}</p>
                        <p className="request-caption">Customer: {request.user_id}</p>
                      </div>
                      <span
                        className="pill"
                        style={{
                          backgroundColor:
                            request.status === "resolved" || request.status === "closed"
                              ? "#2E7D32"
                              : request.status === "in_progress"
                                ? "#8C4B00"
                                : "#005de8",
                          color: "white",
                        }}
                      >
                        {request.status.replaceAll("_", " ")}
                      </span>
                    </header>

                    <p>{request.description}</p>

                    <div className="request-meta">
                      <span className="pill muted">Priority: {request.priority}</span>
                      <span className="pill muted">{requestComments.length} comments</span>
                      <span className="pill muted">
                        {new Date(request.updated_at ?? request.created_at).toLocaleString()}
                      </span>
                    </div>

                    {latestComment ? (
                      <p className="dashboard-note">Latest note: {truncateText(latestComment.body, 160)}</p>
                    ) : (
                      <p className="dashboard-note">No replies yet.</p>
                    )}
                  </div>
                );
              })}
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
            <span className="pill muted">{metrics.onlineWorkers} service partners online</span>
          </div>
          <div className="request-meta">
            <span className="pill muted">{metrics.pendingWorkerConsent} waiting on consent</span>
            <span className="pill muted">{metrics.pendingWorkerReviews} pending reviews</span>
            <span className="pill muted">{metrics.approvedWorkers} approved service partners</span>
            <span className="pill muted">{metrics.pausedWorkers} paused service partners</span>
          </div>
          <div className="request-meta">
            <span className="pill muted">{metrics.openSupportRequests} open support requests</span>
            <span className="pill muted">{metrics.activeSupportRequests} active support requests</span>
            <span className="pill muted">{metrics.resolvedSupportRequests} resolved support requests</span>
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

        <article className="dashboard-card">
          <h2>Activity feed</h2>
          <p className="dashboard-note">
            Every booking, support request, profile update, verification change, and payment event the staff role can see
            rolls into this timeline.
          </p>

          {activityItems.length === 0 ? (
            <div className="empty-state">No recent activity yet.</div>
          ) : (
            <div className="request-list">
              {activityItems.map((item) => (
                <div className="request-item" key={item.id}>
                  <header>
                    <div>
                      <h3>{item.title}</h3>
                      <p className="request-caption">{new Date(item.timestamp).toLocaleString()}</p>
                    </div>
                    <span className="pill" style={{ backgroundColor: activityToneColor(item.tone), color: "white" }}>
                      {item.tone}
                    </span>
                  </header>
                  <p>{item.detail || "No additional details available."}</p>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="dashboard-card">
          <h2>Audit trail</h2>
          <p className="dashboard-note">
            Database-backed events for jobs, profiles, support requests, comments, background checks, ratings, and
            assignments.
          </p>

          {activityEvents.length === 0 ? (
            <div className="empty-state">No audit events have been recorded yet.</div>
          ) : (
            <div className="request-list">
              {activityEvents.map((event) => (
                <div className="request-item" key={event.id}>
                  <header>
                    <div>
                      <h3>{event.title}</h3>
                      <p className="request-caption">{new Date(event.created_at).toLocaleString()}</p>
                    </div>
                    <span className="pill" style={{ backgroundColor: "#005de8", color: "white" }}>
                      {event.entity_type}
                    </span>
                  </header>

                  <p>{event.summary}</p>

                  <div className="request-meta">
                    <span className="pill muted">Action: {event.action}</span>
                    <span className="pill muted">Actor: {event.actor_id ?? "system"}</span>
                    {event.entity_id ? <span className="pill muted">Entity: {event.entity_id}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        {message ? <p className="auth-success">{message}</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}
      </div>
    </section>
  );
}
