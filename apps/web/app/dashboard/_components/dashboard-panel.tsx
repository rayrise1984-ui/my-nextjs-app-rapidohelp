"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

// Old imports removed, will not be used
// import { RequestComments } from "@/components/request-comments";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { JobRatingPanel } from "@/components/job-rating-panel";
import {
  addJob,
  bookableServiceTypes,
  bookingPaymentMethodLabels,
  isBookableServiceType,
  paymentStatusLabels,
  removeJob,
  updateJob,
  serviceTypeLabels,
  jobStatusLabels,
  statusColor,
  type Job,
  type ServiceType,
} from "@/lib/marketplace";

const MOCK_LOCATIONS = [
  { name: "Downtown (Lat 38.294, Lng -122.286)", lat: 38.294, lng: -122.286 },
  { name: "North (Lat 38.310, Lng -122.286)", lat: 38.310, lng: -122.286 },
  { name: "South (Lat 38.270, Lng -122.286)", lat: 38.270, lng: -122.286 },
];

const SERVICE_KEYWORDS: Record<ServiceType, string[]> = {
  flat_tire: ["tire", "puncture", "wheel"],
  jump_start: ["battery", "jump", "electrical"],
  fuel_delivery: ["fuel", "petrol", "diesel", "gas"],
  towing: ["tow", "towing", "recovery"],
  moving_help: ["moving", "packing", "loading"],
  handyman_help: ["repair", "handyman", "fix"],
  plumbing_help: ["plumbing", "pipe", "sink", "leak", "faucet"],
  electrical_help: ["electric", "electrical", "outlet", "switch", "light"],
  cna_support: ["cna", "care", "nursing", "daily living", "health"],
  senior_helper: ["senior", "elder", "errands", "companion", "daily"],
  cleaning_help: ["cleaning", "sanitize", "housekeeping"],
  delivery_help: ["delivery", "courier", "parcel"],
  pet_help: ["pet", "dog", "cat", "animal"],
  tech_help: ["tech", "computer", "phone", "software"],
  others: ["general", "support"],
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

type RecommendedWorker = {
  id: string;
  name: string;
  workerStatus: "offline" | "online" | "on_job";
  workDetails: string;
  experienceYears: number;
  ratingAverage: number;
  ratingCount: number;
  recommendationScore: number;
};

const asRecommendedWorker = (profile: PublicWorkerProfile): RecommendedWorker => {
  const name = profile.full_name?.trim() ? profile.full_name.trim() : "Worker";
  const workerStatus = profile.worker_status ?? "offline";
  return {
    id: profile.id,
    name,
    workerStatus,
    workDetails: profile.worker_work_details?.trim() ?? "",
    experienceYears: profile.worker_experience_years ?? 0,
    ratingAverage: profile.worker_rating_avg ?? 0,
    ratingCount: profile.worker_rating_count ?? 0,
    recommendationScore: 0,
  };
};

const scoreWorkerForService = (worker: RecommendedWorker, serviceType: ServiceType): number => {
  const details = worker.workDetails.toLowerCase();
  const keywordMatches = SERVICE_KEYWORDS[serviceType].filter((keyword) => details.includes(keyword)).length;
  const statusScore = worker.workerStatus === "online" ? 3 : worker.workerStatus === "on_job" ? 1.2 : 0.6;
  const ratingScore = worker.ratingAverage * 0.7;
  const volumeScore = worker.ratingCount > 20 ? 2 : worker.ratingCount * 0.1;
  const experienceScore = Math.min(worker.experienceYears, 12) * 0.2;
  const keywordScore = keywordMatches * 1.4;
  return statusScore + ratingScore + volumeScore + experienceScore + keywordScore;
};

const workerStatusLabel = (status: RecommendedWorker["workerStatus"]): string => {
  if (status === "online") return "online";
  if (status === "on_job") return "on job";
  return "offline";
};

const formatScheduledFor = (value?: string | null): string => {
  if (!value) return "Schedule pending";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export function DashboardPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Form state
  const [serviceType, setServiceType] = useState<ServiceType>("flat_tire");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState(MOCK_LOCATIONS[0]);
  const [estimatePrice, setEstimatePrice] = useState("45");
  const [serviceAddress, setServiceAddress] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [bookingPaymentMethod, setBookingPaymentMethod] = useState<"card" | "upi" | "cash">("card");
  const [preferredWorkerId, setPreferredWorkerId] = useState("");
  const [payingJobId, setPayingJobId] = useState<string | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [recommendedWorkers, setRecommendedWorkers] = useState<RecommendedWorker[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [workerProfilesById, setWorkerProfilesById] = useState<Record<string, RecommendedWorker>>({});

  useEffect(() => {
    const requestedService = searchParams.get("service");
      if (requestedService && requestedService in serviceTypeLabels) {
        if (isBookableServiceType(requestedService)) {
          setServiceType(requestedService);
          setPreferredWorkerId("");
          return;
        }

      setServiceType("handyman_help");
      setPreferredWorkerId("");
      setMessage(
        `${serviceTypeLabels[requestedService as ServiceType]} needs the latest live service update before booking. Showing Handyman Help for now.`,
      );
    }
  }, [searchParams]);

  useEffect(() => {
    const client = createSupabaseBrowserClient();

    if (!client) {
      setLoading(false);
      setError("Live booking services are not available yet. Please try again shortly.");
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

      // Load user's jobs
      const { data: jobRows, error: queryError } = await client
        .from("jobs")
        .select("*")
        .eq("user_id", nextSession.user.id)
        .order("created_at", { ascending: false });

      if (disposed) return;

      if (queryError) {
        setError(queryError.message);
      } else {
        const nextJobs = (jobRows ?? []) as Job[];
        setJobs(nextJobs);
      }

      setLoading(false);

      // Subscribe to auth changes
      authSubscription = client.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          router.replace("/auth");
        }
      }).data.subscription;

      // Subscribe to realtime job updates
      jobChannel = client.channel(`user-jobs-${nextSession.user.id}`);
      jobChannel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "jobs",
            filter: `user_id=eq.${nextSession.user.id}`,
          },
          (payload: { new: Job }) => {
            const newJob = payload.new as Job;
            setJobs((current) => addJob(current, newJob));
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "jobs",
            filter: `user_id=eq.${nextSession.user.id}`,
          },
          (payload: { new: Job }) => {
            const updated = payload.new as Job;
            setJobs((current) => updateJob(current, updated));
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "jobs",
            filter: `user_id=eq.${nextSession.user.id}`,
          },
          (payload: { old: { id?: string } }) => {
            const deletedId = (payload.old as { id?: string }).id;
            if (deletedId) {
              setJobs((current) => removeJob(current, deletedId));
            }
          },
        )
        .subscribe();
    };

    void initialize();

    return () => {
      disposed = true;
      authSubscription?.unsubscribe();
      jobChannel && client.removeChannel(jobChannel as never);
    };
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) return;

    if (!description.trim()) {
      setError("Please describe your situation.");
      return;
    }

    const parsedEstimate = Number.parseFloat(estimatePrice);
    if (!Number.isFinite(parsedEstimate) || parsedEstimate <= 0) {
      setError("Please enter a valid estimate price.");
      return;
    }

    if (!isBookableServiceType(serviceType)) {
      setError(`${serviceTypeLabels[serviceType]} is not enabled for live booking yet. Please choose another service.`);
      return;
    }

    if (!serviceAddress.trim()) {
      setError("Please enter the service address.");
      return;
    }

    if (!scheduledFor.trim()) {
      setError("Please choose a service time.");
      return;
    }

    const scheduledDate = new Date(scheduledFor);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      setError("Please choose a future service time.");
      return;
    }

    if (preferredWorkerId && !recommendedWorkers.some((worker) => worker.id === preferredWorkerId)) {
      setError("Please choose a recommended service partner or leave auto-match selected.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    const client = createSupabaseBrowserClient();
    if (!client) return;

    try {
      const { error: insertError } = await client.from("jobs").insert({
        user_id: session.user.id,
        service_type: serviceType,
        description,
        location_lat: location.lat,
        location_lng: location.lng,
        location_name: location.name,
        estimated_price: parsedEstimate,
        service_address: serviceAddress.trim(),
        scheduled_for: scheduledDate.toISOString(),
        booking_payment_method: bookingPaymentMethod,
        preferred_worker_id: preferredWorkerId || null,
      });

      if (insertError) {
        setError(insertError.message);
      } else {
        setMessage("Job posted! We're finding nearby helpers...");
        setDescription("");
        setServiceType("flat_tire");
        setEstimatePrice("45");
        setServiceAddress("");
        setScheduledFor("");
        setBookingPaymentMethod("card");
        setPreferredWorkerId("");
      }
    } catch (err) {
      setError(`Failed to post job: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    if (!client || !session) {
      setRecommendedWorkers([]);
      return;
    }

    let cancelled = false;
    const fetchRecommendations = async () => {
      setLoadingRecommendations(true);
      setRecommendationError(null);

      try {
        let { data, error: queryError } = await client
          .from("profiles")
          .select("id, full_name, worker_status, worker_work_details, worker_experience_years, worker_rating_avg, worker_rating_count")
          .eq("is_worker", true)
          .eq("worker_verified", true)
          .eq("worker_disabled", false)
          .limit(50);

        if (
          queryError &&
          (queryError.message.includes("worker_verified") ||
            queryError.message.includes("worker_disabled"))
        ) {
          const fallback = await client
            .from("profiles")
            .select("id, full_name, worker_status, worker_work_details, worker_experience_years, worker_rating_avg, worker_rating_count")
            .eq("is_worker", true)
            .limit(50);

          data = fallback.data;
          queryError = fallback.error;
        }

        if (cancelled) return;

        if (queryError) {
          setRecommendationError(queryError.message);
          setRecommendedWorkers([]);
          return;
        }

        const nextWorkers = ((data ?? []) as PublicWorkerProfile[])
          .map(asRecommendedWorker)
          .map((worker) => ({
            ...worker,
            recommendationScore: scoreWorkerForService(worker, serviceType),
          }))
          .sort((a, b) => b.recommendationScore - a.recommendationScore)
          .slice(0, 3);

        setRecommendedWorkers(nextWorkers);
      } catch (err) {
        if (cancelled) return;
        setRecommendationError(err instanceof Error ? err.message : String(err));
        setRecommendedWorkers([]);
      } finally {
        if (!cancelled) {
          setLoadingRecommendations(false);
        }
      }
    };

    void fetchRecommendations();
    return () => {
      cancelled = true;
    };
  }, [serviceType, session]);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    if (!client || !session) return;

    const workerIds = Array.from(
      new Set(
        jobs
          .flatMap((job) => [job.worker_id, job.preferred_worker_id])
          .filter((id): id is string => Boolean(id)),
      ),
    );
    if (workerIds.length === 0) {
      setWorkerProfilesById({});
      return;
    }

    let cancelled = false;
    const fetchWorkerProfiles = async () => {
      const { data, error: queryError } = await client
        .from("profiles")
        .select("id, full_name, worker_status, worker_work_details, worker_experience_years, worker_rating_avg, worker_rating_count")
        .in("id", workerIds);

      if (cancelled || queryError) return;

      const mapped = Object.fromEntries(
        ((data ?? []) as PublicWorkerProfile[])
          .map(asRecommendedWorker)
          .map((worker) => [worker.id, worker]),
      );
      setWorkerProfilesById(mapped);
    };

    void fetchWorkerProfiles();
    return () => {
      cancelled = true;
    };
  }, [jobs, session]);

  const markJobPaid = async (jobId: string, method: "card" | "upi" | "cash") => {
    const client = createSupabaseBrowserClient();
    if (!client) {
      return;
    }

    setError(null);
    setMessage(null);

    const currentJob = jobs.find((job) => job.id === jobId);
    const dueAmount = currentJob?.final_price ?? currentJob?.estimated_price;
    if (!dueAmount || dueAmount <= 0) {
      setError('No payable amount found for this job.');
      return;
    }

    setPayingJobId(jobId);

    const { data, error: updateError } = await client.rpc('mark_job_paid', {
      p_job_id: jobId,
      p_method: method,
    });

    setPayingJobId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setJobs((current) => updateJob(current, data as Job));
    setMessage(`Payment recorded via ${method.toUpperCase()}.`);
  };

  const cancelJob = async (jobId: string) => {
    const client = createSupabaseBrowserClient();
    if (!client) return;

    setCancellingJobId(jobId);
    setError(null);
    setMessage(null);

    const { data, error: cancelError } = await client.rpc("cancel_job", {
      p_job_id: jobId,
    });

    setCancellingJobId(null);

    if (cancelError) {
      setError(cancelError.message);
      return;
    }

    setJobs((current) => updateJob(current, data as Job));
    setMessage("Job cancelled.");
  };

  if (loading) {
    return <div className="dashboard-loading">Loading...</div>;
  }

  if (!session) {
    return <div className="dashboard-loading">Redirecting to sign in...</div>;
  }

  return (
    <section className="dashboard-grid">
      <div className="dashboard-stack">
        {/* New job form */}
        <article className="dashboard-card">
          <h2>Post a job</h2>
          <form className="dashboard-form" onSubmit={handleSubmit}>
            <label>
              What do you need?
              <select
                value={serviceType}
                onChange={(e) => {
                  setServiceType(e.target.value as ServiceType);
                  setPreferredWorkerId("");
                }}
              >
                {bookableServiceTypes.map((type) => (
                  <option key={type} value={type}>
                    {serviceTypeLabels[type]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Recommended workers for this category
              {loadingRecommendations ? (
                <p style={{ margin: "8px 0", color: "#666" }}>Loading recommendations...</p>
              ) : recommendationError ? (
                <p style={{ margin: "8px 0", color: "#8A1C0F" }}>{recommendationError}</p>
              ) : recommendedWorkers.length === 0 ? (
                <p style={{ margin: "8px 0", color: "#666" }}>No recommendations yet. You can still post this job.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                  {recommendedWorkers.map((worker) => (
                    <div
                      key={worker.id}
                      style={{
                        padding: "10px",
                        border: "1px solid #e3e7ee",
                        borderRadius: "10px",
                        backgroundColor: "#fff",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                        <strong>{worker.name}</strong>
                        <span style={{ color: worker.workerStatus === "online" ? "#2E7D32" : "#888", fontSize: "12px" }}>
                          {workerStatusLabel(worker.workerStatus)}
                        </span>
                      </div>
                      <p style={{ margin: "6px 0 0 0", color: "#666", fontSize: "12px" }}>
                        Experience: {worker.experienceYears} yrs • Rating: {worker.ratingCount > 0 ? `${worker.ratingAverage.toFixed(1)} (${worker.ratingCount})` : "new"}
                      </p>
                      {worker.workDetails ? (
                        <p style={{ margin: "6px 0 0 0", fontSize: "12px" }}>{worker.workDetails}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </label>

            <label>
              Preferred service partner
              <select
                value={preferredWorkerId}
                onChange={(event) => setPreferredWorkerId(event.target.value)}
              >
                <option value="">Auto-match the best available partner</option>
                {recommendedWorkers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.name}
                    {worker.workerStatus === "online" ? " · online" : ""}
                    {worker.ratingCount > 0 ? ` · ${worker.ratingAverage.toFixed(1)} rating` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Describe your situation
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="E.g., front left tire is flat, I'm on Highway 101 northbound..."
              />
            </label>

            <label>
              Service address
              <input
                value={serviceAddress}
                onChange={(e) => setServiceAddress(e.target.value)}
                placeholder="Apartment, street, building, city"
                type="text"
              />
            </label>

            <label>
              Schedule your service
              <input
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                type="datetime-local"
              />
            </label>

            <label>
              Booking payment preference
              <select
                value={bookingPaymentMethod}
                onChange={(e) => setBookingPaymentMethod(e.target.value as "card" | "upi" | "cash")}
              >
                <option value="card">{bookingPaymentMethodLabels.card}</option>
                <option value="upi">{bookingPaymentMethodLabels.upi}</option>
                <option value="cash">{bookingPaymentMethodLabels.cash}</option>
              </select>
            </label>

            <label>
              Your estimate price
              <input
                inputMode="decimal"
                onChange={(e) => setEstimatePrice(e.target.value)}
                placeholder="45.00"
                type="number"
                min="1"
                step="0.01"
                value={estimatePrice}
              />
            </label>

            <label>
              Your location (test mode)
                <select
                  value={location.name}
                  onChange={(e) => {
                    const loc = MOCK_LOCATIONS.find((l) => l.name === e.target.value);
                    if (loc) setLocation(loc);
                }}
              >
                {MOCK_LOCATIONS.map((loc) => (
                  <option key={loc.name} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </label>
            <small style={{ color: "#666", display: "block", marginTop: "4px" }}>
              Test mode uses mock locations. In production, this would use real GPS.
            </small>

            <div className="dashboard-actions">
              <button disabled={submitting} type="submit">
                {submitting ? "Posting..." : "Post job"}
              </button>
            </div>
          </form>

          {message ? <p className="auth-success">{message}</p> : null}
          {error ? <p className="auth-error">{error}</p> : null}
        </article>
      </div>

      <div className="dashboard-stack">
        <article className="dashboard-card">
          <h2>Your jobs</h2>
          {jobs.length === 0 ? (
            <div className="empty-state">
              No jobs yet. Post one above to get started.
            </div>
          ) : (
            <div className="request-list">
                {jobs.map((job) => {
                const dueAmount = job.final_price ?? job.estimated_price;
                const assignedWorker = job.worker_id ? workerProfilesById[job.worker_id] : null;
                const preferredWorker = job.preferred_worker_id ? workerProfilesById[job.preferred_worker_id] : null;
                return (
                <div className="request-item" key={job.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <h3>{serviceTypeLabels[job.service_type]}</h3>
                    <span
                      className="pill"
                      style={{
                        backgroundColor: statusColor(job.status),
                        color: "white",
                      }}
                    >
                      {jobStatusLabels[job.status]}
                    </span>
                  </div>
                  <p>{job.description}</p>
                  <div className="request-meta">
                    <span className="pill muted">
                      {job.service_address ?? "Address pending"}
                    </span>
                    <span className="pill muted">
                      {formatScheduledFor(job.scheduled_for)}
                    </span>
                    <span className="pill muted">
                      {job.booking_payment_method ? bookingPaymentMethodLabels[job.booking_payment_method] : "Payment preference pending"}
                    </span>
                  </div>
                  {preferredWorker ? (
                    <p style={{ color: "#0057FF", fontSize: "14px", margin: "8px 0 0 0" }}>
                      Preferred partner: {preferredWorker.name}
                    </p>
                  ) : job.preferred_worker_id ? (
                    <p style={{ color: "#0057FF", fontSize: "14px", margin: "8px 0 0 0" }}>
                      Preferred partner requested
                    </p>
                  ) : null}
                  {job.worker_id && (
                    <p style={{ color: "#0057FF", fontSize: "14px", margin: "8px 0 0 0" }}>
                      Helper assigned
                    </p>
                  )}
                  {assignedWorker ? (
                    <div
                      style={{
                        marginTop: "8px",
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #e3e7ee",
                        backgroundColor: "#fff",
                      }}
                    >
                      <p style={{ margin: 0, fontWeight: 600 }}>{assignedWorker.name}</p>
                      <p style={{ margin: "4px 0 0 0", color: "#666", fontSize: "12px" }}>
                        Status: {workerStatusLabel(assignedWorker.workerStatus)} • Experience: {assignedWorker.experienceYears} yrs
                      </p>
                      <p style={{ margin: "4px 0 0 0", color: "#666", fontSize: "12px" }}>
                        Rating: {assignedWorker.ratingCount > 0 ? `${assignedWorker.ratingAverage.toFixed(1)} (${assignedWorker.ratingCount})` : "new worker"}
                      </p>
                      {assignedWorker.workDetails ? (
                        <p style={{ margin: "6px 0 0 0", fontSize: "12px" }}>{assignedWorker.workDetails}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="request-meta">
                    <span className="pill muted">
                      {new Date(job.created_at).toLocaleDateString()}
                    </span>
                    <span className="pill muted">
                      {job.scheduled_for ? formatScheduledFor(job.scheduled_for) : "Schedule pending"}
                    </span>
                    {job.estimated_price ? (
                      <span className="pill muted">
                        Estimate ${job.estimated_price.toFixed(2)}
                      </span>
                    ) : null}
                    {job.final_price ? (
                      <span className="pill muted">
                        Final ${job.final_price.toFixed(2)}
                      </span>
                    ) : null}
                    <span className="pill muted">
                      {paymentStatusLabels[job.payment_status]}
                    </span>
                    <span className="pill muted">
                      {job.booking_payment_method ? bookingPaymentMethodLabels[job.booking_payment_method] : "Payment preference pending"}
                    </span>
                  </div>
                  {job.payment_reference ? (
                    <p style={{ color: '#666', fontSize: '13px', margin: '8px 0 0 0' }}>
                      Ref: {job.payment_reference}
                    </p>
                  ) : null}
                  {job.status === 'completed' && job.payment_status !== 'paid' && dueAmount ? (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>
                        Amount due: ${dueAmount.toFixed(2)}
                      </span>
                      <button
                        disabled={payingJobId === job.id}
                        onClick={() => void markJobPaid(job.id, 'card')}
                        type="button"
                      >
                        {payingJobId === job.id ? 'Processing...' : 'Pay by card'}
                      </button>
                      <button
                        disabled={payingJobId === job.id}
                        onClick={() => void markJobPaid(job.id, 'upi')}
                        type="button"
                      >
                        Mark paid by UPI
                      </button>
                      <button
                        disabled={payingJobId === job.id}
                        onClick={() => void markJobPaid(job.id, 'cash')}
                        type="button"
                      >
                        Mark paid cash
                      </button>
                    </div>
                  ) : null}
                  {job.status === "completed" && (
                    <div style={{ marginTop: "12px" }}>
                      <JobRatingPanel
                        job={job}
                        onRatingSubmitted={() => setMessage("Thank you for rating!")}
                      />
                    </div>
                  )}
                  <div className="dashboard-actions" style={{ marginTop: "10px" }}>
                    <Link href={`/dashboard/jobs/${job.id}`}>Open details</Link>
                    {job.status === "pending" ? (
                      <button
                        disabled={cancellingJobId === job.id}
                        onClick={() => void cancelJob(job.id)}
                        type="button"
                      >
                        {cancellingJobId === job.id ? "Cancelling..." : "Cancel job"}
                      </button>
                    ) : null}
                  </div>
                </div>
              );})}
            </div>
          )}
        </article>

        <article className="dashboard-card">
          <h2>Account</h2>
          <p>
            Signed in as <strong>{session.user.email ?? session.user.id}</strong>
          </p>
          <div className="dashboard-actions">
            <button
              onClick={() => createSupabaseBrowserClient()?.auth.signOut().then(() => router.replace("/auth"))}
              type="button"
            >
              Sign out
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
