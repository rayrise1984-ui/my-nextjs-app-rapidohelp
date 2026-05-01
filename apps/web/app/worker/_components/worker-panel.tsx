"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  addJob,
  bookableServiceTypes,
  calculatePayoutSplit,
  paymentStatusLabels,
  serviceTypeLabels,
  jobStatusLabels,
  statusColor,
  type Job,
  type ServiceType,
  type WorkerProfile,
} from "@/lib/marketplace";

// Mock location zones for MVP
const LOCATION_ZONES = {
  downtown: { name: "Downtown (38.294, -122.286)", lat: 38.294, lng: -122.286 },
  north: { name: "North (38.310, -122.286)", lat: 38.310, lng: -122.286 },
  south: { name: "South (38.270, -122.286)", lat: 38.270, lng: -122.286 },
};

const HELPER_BACKGROUND_CHECK_CONSENT_VERSION = "helper_background_check_v1";

const SERVICE_TYPES = bookableServiceTypes;

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
  payout_account_holder_name: string | null;
  payout_bank_name: string | null;
  payout_account_type: string | null;
  payout_account_last4: string | null;
  payout_routing_last4: string | null;
  status: string | null;
  submitted_at: string | null;
};

type BackgroundCheckInputs = {
  legalFullName: string;
  ssnLast4: string;
  driverLicenseNumber: string;
  driverLicenseState: string;
  legalAddressLine1: string;
  legalAddressLine2: string;
  legalCity: string;
  legalState: string;
  legalPostalCode: string;
  payoutAccountHolderName: string;
  payoutBankName: string;
  payoutAccountType: string;
  payoutAccountLast4: string;
  payoutRoutingLast4: string;
};

const emptyBackgroundCheckInputs: BackgroundCheckInputs = {
  legalFullName: "",
  ssnLast4: "",
  driverLicenseNumber: "",
  driverLicenseState: "",
  legalAddressLine1: "",
  legalAddressLine2: "",
  legalCity: "",
  legalState: "",
  legalPostalCode: "",
  payoutAccountHolderName: "",
  payoutBankName: "",
  payoutAccountType: "",
  payoutAccountLast4: "",
  payoutRoutingLast4: "",
};

const jobMatchesWorkerServices = (job: Job, profile: WorkerProfile | null) => {
  const serviceTypes = profile?.service_types ?? [];
  return serviceTypes.includes(job.service_type);
};

const backgroundCheckIsSubmitted = (backgroundCheck: WorkerBackgroundCheck | null) =>
  Boolean(
    backgroundCheck?.submitted_at &&
      backgroundCheck.legal_full_name?.trim() &&
      backgroundCheck.ssn_last4?.match(/^\d{4}$/) &&
      backgroundCheck.driver_license_number?.trim() &&
      backgroundCheck.driver_license_state?.match(/^[A-Z]{2}$/) &&
      backgroundCheck.legal_address_line1?.trim() &&
      backgroundCheck.legal_city?.trim() &&
      backgroundCheck.legal_state?.match(/^[A-Z]{2}$/) &&
      backgroundCheck.legal_postal_code?.trim() &&
      backgroundCheck.payout_account_holder_name?.trim() &&
      backgroundCheck.payout_bank_name?.trim() &&
      ["checking", "savings"].includes((backgroundCheck.payout_account_type ?? "").trim().toLowerCase()) &&
      backgroundCheck.payout_account_last4?.match(/^\d{4}$/) &&
      backgroundCheck.payout_routing_last4?.match(/^\d{4}$/),
  );

const backgroundCheckInputsFromRecord = (
  record: WorkerBackgroundCheck | null,
  fallbackLegalName = "",
): BackgroundCheckInputs => ({
  legalFullName: record?.legal_full_name ?? fallbackLegalName,
  ssnLast4: record?.ssn_last4 ?? "",
  driverLicenseNumber: record?.driver_license_number ?? "",
  driverLicenseState: record?.driver_license_state ?? "",
  legalAddressLine1: record?.legal_address_line1 ?? "",
  legalAddressLine2: record?.legal_address_line2 ?? "",
  legalCity: record?.legal_city ?? "",
  legalState: record?.legal_state ?? "",
  legalPostalCode: record?.legal_postal_code ?? "",
  payoutAccountHolderName: record?.payout_account_holder_name ?? fallbackLegalName,
  payoutBankName: record?.payout_bank_name ?? "",
  payoutAccountType: record?.payout_account_type?.trim().toLowerCase() ?? "",
  payoutAccountLast4: record?.payout_account_last4 ?? "",
  payoutRoutingLast4: record?.payout_routing_last4 ?? "",
});

const money = (amount: number | null | undefined) => `$${Number(amount ?? 0).toFixed(2)}`;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const getWaybillAmounts = (job: Job) => {
  const total = Number(job.final_price ?? job.estimated_price ?? 0);
  const fallbackSplit = calculatePayoutSplit(total);
  return {
    total,
    companyFee: Number(job.company_fee_amount ?? fallbackSplit.companyFeeAmount),
    workerPayout: Number(job.worker_payout_amount ?? fallbackSplit.workerPayoutAmount),
  };
};

const getWorkerJobPayout = (job: Job) => {
  const directPayout = Number(job.worker_payout_amount ?? 0);
  if (directPayout > 0) {
    return directPayout;
  }

  const payoutBase = Number(job.final_price ?? job.estimated_price ?? 0);
  if (payoutBase <= 0) {
    return 0;
  }

  return calculatePayoutSplit(payoutBase).workerPayoutAmount;
};

const isActiveWorkerJob = (job: Job) => job.status === "accepted" || job.status === "in_progress";

const downloadWorkerWaybill = (job: Job, workerName: string) => {
  if (job.status !== "completed") {
    return;
  }

  const { total, companyFee, workerPayout } = getWaybillAmounts(job);
  const completedAt = job.completed_at ? new Date(job.completed_at) : new Date();
  const issuedAt = new Date();
  const waybillNumber = `RH-${job.id.slice(0, 8).toUpperCase()}`;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>RapidoHelp Waybill ${escapeHtml(waybillNumber)}</title>
  <style>
    body { color: #111827; font-family: Arial, sans-serif; line-height: 1.5; margin: 32px; }
    header { border-bottom: 2px solid #111827; margin-bottom: 24px; padding-bottom: 16px; }
    h1 { margin: 0 0 4px; }
    h2 { border-bottom: 1px solid #d8dee8; font-size: 16px; margin-top: 24px; padding-bottom: 6px; }
    table { border-collapse: collapse; width: 100%; }
    td { border-bottom: 1px solid #e5e7eb; padding: 8px 0; vertical-align: top; }
    td:last-child { font-weight: 700; text-align: right; }
    .muted { color: #4b5563; }
  </style>
</head>
<body>
  <header>
    <h1>RapidoHelp Worker Waybill</h1>
    <p class="muted">Waybill ${escapeHtml(waybillNumber)} · Issued ${escapeHtml(issuedAt.toLocaleString())}</p>
  </header>
  <section>
    <h2>Job</h2>
    <p><strong>Service:</strong> ${escapeHtml(serviceTypeLabels[job.service_type])}</p>
    <p><strong>Description:</strong> ${escapeHtml(job.description)}</p>
    <p><strong>Location:</strong> ${escapeHtml(job.location_name ?? "Location pending")}</p>
    <p><strong>Completed:</strong> ${escapeHtml(completedAt.toLocaleString())}</p>
    <p><strong>Service partner:</strong> ${escapeHtml(workerName)}</p>
    <p><strong>Job ID:</strong> ${escapeHtml(job.id)}</p>
  </section>
  <section>
    <h2>Payment Breakdown</h2>
    <table>
      <tr><td>Customer final amount</td><td>${money(total)}</td></tr>
      <tr><td>Company fee</td><td>${money(companyFee)}</td></tr>
      <tr><td>Worker payout</td><td>${money(workerPayout)}</td></tr>
      <tr><td>Payment status</td><td>${escapeHtml(paymentStatusLabels[job.payment_status])}</td></tr>
    </table>
  </section>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${waybillNumber.toLowerCase()}-waybill.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export function WorkerPanel() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [workerStatusInput, setWorkerStatusInput] = useState<WorkerProfile["worker_status"]>("offline");
  const [workDetailsInput, setWorkDetailsInput] = useState("");
  const [experienceYearsInput, setExperienceYearsInput] = useState("");
  const [serviceTypesInput, setServiceTypesInput] = useState<ServiceType[]>([]);
  const [backgroundCheck, setBackgroundCheck] = useState<WorkerBackgroundCheck | null>(null);
  const [backgroundInputs, setBackgroundInputs] = useState<BackgroundCheckInputs>(emptyBackgroundCheckInputs);
  const [workerConsentOnFile, setWorkerConsentOnFile] = useState(false);
  const [workerConsentChecked, setWorkerConsentChecked] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [feedServiceFilter, setFeedServiceFilter] = useState<"all" | ServiceType>("all");
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const [acceptedJobs, setAcceptedJobs] = useState<Job[]>([]);
  const [completedJobs, setCompletedJobs] = useState<Job[]>([]);
  const [workerHistoryJobs, setWorkerHistoryJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);
  const [startingJobId, setStartingJobId] = useState<string | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [completingJobId, setCompletingJobId] = useState<string | null>(null);
  const [finalPriceInputs, setFinalPriceInputs] = useState<Record<string, string>>({});

  const isWorkerProfileComplete = (profile: WorkerProfile | null, check: WorkerBackgroundCheck | null) => {
    if (!profile) return false;
    const details = (profile.worker_work_details ?? "").trim();
    const hasYears = typeof profile.worker_experience_years === "number" && profile.worker_experience_years >= 0;
    const serviceTypes = profile.service_types ?? [];
    const hasConsent =
      Boolean(profile.worker_background_check_consent_at) &&
      Boolean(profile.worker_background_check_consent_platform) &&
      profile.worker_background_check_consent_version === HELPER_BACKGROUND_CHECK_CONSENT_VERSION;
    return Boolean(
      profile.is_worker &&
      profile.worker_profile_completed &&
      details.length >= 10 &&
      hasYears &&
      serviceTypes.length > 0 &&
      hasConsent &&
      backgroundCheckIsSubmitted(check),
    );
  };

  const syncWorkerProfileState = (rawProfile: WorkerProfile) => {
    const nextProfile = {
      ...rawProfile,
      service_types: (rawProfile.service_types ?? []).filter((type) =>
        bookableServiceTypes.includes(type),
      ),
    };

    setWorkerProfile(nextProfile);
    setWorkerStatusInput(nextProfile.worker_status ?? "offline");
    setWorkDetailsInput(nextProfile.worker_work_details ?? "");
    setServiceTypesInput(nextProfile.service_types ?? []);
    const nextHasConsent =
      Boolean(
        nextProfile.worker_background_check_consent_at &&
          nextProfile.worker_background_check_consent_platform &&
          nextProfile.worker_background_check_consent_version === HELPER_BACKGROUND_CHECK_CONSENT_VERSION,
      );
    setWorkerConsentOnFile(nextHasConsent);
    setWorkerConsentChecked(nextHasConsent);
    setExperienceYearsInput(
      typeof nextProfile.worker_experience_years === "number"
        ? String(nextProfile.worker_experience_years)
        : "",
    );
  };

  const syncBackgroundCheckState = (
    rawBackgroundCheck: WorkerBackgroundCheck | null,
    fallbackLegalName = "",
  ) => {
    setBackgroundCheck(rawBackgroundCheck);
    setBackgroundInputs(backgroundCheckInputsFromRecord(rawBackgroundCheck, fallbackLegalName));
  };

  const workerProfileComplete = isWorkerProfileComplete(workerProfile, backgroundCheck);
  const workerVerified = workerProfile?.worker_verified ?? false;
  const workerDisabled = workerProfile?.worker_disabled ?? false;
  const workerCanAcceptNewJobs = workerProfileComplete && workerVerified && !workerDisabled;
  const workerNeedsConsent = Boolean(workerProfile?.is_worker && !workerConsentOnFile);

  useEffect(() => {
    const client = createSupabaseBrowserClient();

    if (!client) {
      setLoading(false);
      setError("Live service partner services are not available yet. Please try again shortly.");
      return;
    }

    let disposed = false;
    let authSubscription: { unsubscribe: () => void } | null = null;
    let jobChannel: ReturnType<typeof client.channel> | null = null;
    let profileChannel: ReturnType<typeof client.channel> | null = null;

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

      // Load worker profile
      const { data: profileData, error: profileError } = await client
        .from("profiles")
        .select("*")
        .eq("id", nextSession.user.id)
        .single();

      if (disposed) return;

      if (profileData) {
        syncWorkerProfileState(profileData as WorkerProfile);
      }

      const { data: backgroundData, error: backgroundError } = await client
        .from("worker_background_checks")
        .select(
          "worker_id, legal_full_name, ssn_last4, driver_license_number, driver_license_state, legal_address_line1, legal_address_line2, legal_city, legal_state, legal_postal_code, payout_account_holder_name, payout_bank_name, payout_account_type, payout_account_last4, payout_routing_last4, status, submitted_at",
        )
        .eq("worker_id", nextSession.user.id)
        .maybeSingle();

      if (disposed) return;

      if (backgroundError) {
        setError(backgroundError.message);
      } else {
        syncBackgroundCheckState(
          (backgroundData ?? null) as WorkerBackgroundCheck | null,
          ((profileData as WorkerProfile | null)?.full_name ?? "").trim(),
        );
      }

      // Load pending jobs (jobs we haven't been offered yet)
      const { data: pendingData, error: pendingError } = await client
        .from("jobs")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (disposed) return;

      if (pendingData) {
        setPendingJobs((pendingData ?? []) as Job[]);
      }

      const { data: completedData } = await client
        .from("jobs")
        .select("*")
        .eq("worker_id", nextSession.user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });

      if (!disposed && completedData) {
        setCompletedJobs((completedData ?? []) as Job[]);
      }

      const { data: historyData } = await client
        .from("jobs")
        .select("*")
        .eq("worker_id", nextSession.user.id)
        .order("created_at", { ascending: false });

      if (!disposed && historyData) {
        const historyRows = (historyData ?? []) as Job[];
        setWorkerHistoryJobs(historyRows);
      }

      // Load accepted jobs (jobs we've accepted)
      const { data: assignmentData } = await client
        .from("job_assignments")
        .select("job_id")
        .eq("worker_id", nextSession.user.id)
        .eq("status", "accepted");

      if (disposed) return;

      if (assignmentData && assignmentData.length > 0) {
        const jobIds = assignmentData.map((a) => a.job_id);
        const { data: acceptedData } = await client
          .from("jobs")
          .select("*")
          .in("id", jobIds)
          .order("created_at", { ascending: false });

        if (!disposed && acceptedData) {
          const nextAcceptedJobs = ((acceptedData ?? []) as Job[]).filter(
            (job) => job.status === "accepted" || job.status === "in_progress",
          );
          setAcceptedJobs(nextAcceptedJobs);
          setFinalPriceInputs(
            Object.fromEntries(
              nextAcceptedJobs.map((job) => [job.id, String(job.final_price ?? job.estimated_price ?? "")]),
            ),
          );
        }
      }

      setLoading(false);

      // Subscribe to auth changes
      authSubscription = client.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          router.replace("/auth");
        }
      }).data.subscription;

      // Subscribe to new pending jobs
      jobChannel = client.channel(`worker-jobs-${nextSession.user.id}`);
      jobChannel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "jobs",
            filter: `status=eq.pending`,
          },
          (payload: { new: Job }) => {
            const newJob = payload.new as Job;
            setPendingJobs((current) => addJob(current, newJob));
            if (newJob.worker_id === nextSession.user.id) {
              setWorkerHistoryJobs((current) => addJob(current.filter((job) => job.id !== newJob.id), newJob));
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "jobs",
          },
          (payload: { new: Job }) => {
            const updated = payload.new as Job;
            setPendingJobs((current) => current.filter((j) => j.id !== updated.id));
            setWorkerHistoryJobs((current) => {
              const withoutUpdated = current.filter((job) => job.id !== updated.id);
              return updated.worker_id === nextSession.user.id
                ? addJob(withoutUpdated, updated)
                : withoutUpdated;
            });
            setAcceptedJobs((current) => {
              const withoutUpdated = current.filter((j) => j.id !== updated.id);
              const isActiveWorker = updated.worker_id === nextSession.user.id && isActiveWorkerJob(updated);

              return isActiveWorker ? [updated, ...withoutUpdated] : withoutUpdated;
            });
            setCompletedJobs((current) => {
              const withoutUpdated = current.filter((j) => j.id !== updated.id);
              const isCompletedWorkerJob = updated.worker_id === nextSession.user.id && updated.status === "completed";
              return isCompletedWorkerJob ? [updated, ...withoutUpdated] : withoutUpdated;
            });
          },
        )
        .subscribe();

      profileChannel = client.channel(`worker-profile-${nextSession.user.id}`);
      profileChannel
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${nextSession.user.id}`,
          },
          (payload: { new: WorkerProfile }) => {
            syncWorkerProfileState(payload.new as WorkerProfile);
          },
        )
        .subscribe();
    };

    void initialize();

    return () => {
      disposed = true;
      authSubscription?.unsubscribe();
      jobChannel && client.removeChannel(jobChannel as never);
      profileChannel && client.removeChannel(profileChannel as never);
    };
  }, [router]);

  const acceptJob = async (jobId: string) => {
    if (!session || !workerCanAcceptNewJobs) return;

    setAcceptingJobId(jobId);
    setError(null);

    const client = createSupabaseBrowserClient();
    if (!client) return;

    try {
      const { data, error: acceptError } = await client.rpc("accept_job", {
        p_job_id: jobId,
      });

      if (acceptError) throw acceptError;

      const acceptedJob = data as Job;
      setMessage("Job accepted! Head to the location.");
      setPendingJobs((current) => current.filter((j) => j.id !== acceptedJob.id));
      setAcceptedJobs((current) => [acceptedJob, ...current.filter((j) => j.id !== acceptedJob.id)]);
      setWorkerHistoryJobs((current) => addJob(current.filter((job) => job.id !== acceptedJob.id), acceptedJob));
      setFinalPriceInputs((current) => ({
        ...current,
        [acceptedJob.id]: String(acceptedJob.final_price ?? acceptedJob.estimated_price ?? ""),
      }));
      setWorkerProfile((current) => current ? { ...current, worker_status: "on_job" } : current);
    } catch (err) {
      setError(`Failed to accept job: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAcceptingJobId(null);
    }
  };

  const startJob = async (jobId: string) => {
    if (!session) return;

    setStartingJobId(jobId);
    setError(null);
    setMessage(null);

    const client = createSupabaseBrowserClient();
    if (!client) return;

    try {
      const { data, error: startError } = await client.rpc("start_job", {
        p_job_id: jobId,
      });

      if (startError) throw startError;

      const updated = data as Job;
      setAcceptedJobs((current) => [updated, ...current.filter((entry) => entry.id !== updated.id)]);
      setWorkerHistoryJobs((current) => addJob(current.filter((job) => job.id !== updated.id), updated));
      setMessage("Job marked in progress.");
      setWorkerProfile((current) => current ? { ...current, worker_status: "on_job" } : current);
    } catch (err) {
      setError(`Failed to start job: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setStartingJobId(null);
    }
  };

  const cancelWorkerJob = async (jobId: string) => {
    if (!session) return;

    setCancellingJobId(jobId);
    setError(null);
    setMessage(null);

    const client = createSupabaseBrowserClient();
    if (!client) return;

    try {
      const { data, error: cancelError } = await client.rpc("cancel_worker_job", {
        p_job_id: jobId,
      });

      if (cancelError) throw cancelError;

      if (data) {
        const cancelledJob = data as Job;
        setWorkerHistoryJobs((current) => addJob(current.filter((job) => job.id !== cancelledJob.id), cancelledJob));
      }

      setAcceptedJobs((current) => current.filter((entry) => entry.id !== jobId));
      setFinalPriceInputs((current) => {
        const next = { ...current };
        delete next[jobId];
        return next;
      });
      setMessage("Job cancelled and returned to your history.");
      setWorkerProfile((current) => current ? { ...current, worker_status: "online" } : current);
    } catch (err) {
      setError(`Failed to cancel job: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCancellingJobId(null);
    }
  };

  const completeJob = async (jobId: string) => {
    if (!session) return;

    const job = acceptedJobs.find((entry) => entry.id === jobId);
    const parsedFinalPrice = Number.parseFloat(finalPriceInputs[jobId] ?? "");

    if (!Number.isFinite(parsedFinalPrice) || parsedFinalPrice <= 0) {
      setError("Enter a valid final price before completing the job.");
      return;
    }

    setCompletingJobId(jobId);
    setError(null);

    const client = createSupabaseBrowserClient();
    if (!client) return;

    try {
      const { data, error: completeError } = await client.rpc("complete_job", {
        p_job_id: jobId,
        p_final_price: parsedFinalPrice,
      });

      if (completeError) throw completeError;

      setMessage(`Job marked complete at $${parsedFinalPrice.toFixed(2)}. Waybill is ready in your work history.`);
      setAcceptedJobs((current) => current.filter((entry) => entry.id !== jobId));
      setFinalPriceInputs((current) => {
        const next = { ...current };
        delete next[jobId];
        return next;
      });
      if (data) {
        setCompletedJobs((current) => [data as Job, ...current.filter((entry) => entry.id !== jobId)]);
        setWorkerHistoryJobs((current) => addJob(current.filter((job) => job.id !== jobId), data as Job));
      }
      setWorkerProfile((current) => current ? { ...current, worker_status: "online" } : current);

      if (job) {
        setPendingJobs((current) => current.filter((entry) => entry.id !== job.id));
      }
    } catch (err) {
      setError(`Failed to complete job: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCompletingJobId(null);
    }
  };

  const toggleAvailability = async () => {
    if (!session || !workerProfile) return;
    if (workerProfile.worker_status === "on_job" || !workerCanAcceptNewJobs) return;

    const newStatus = workerProfile.worker_status === "offline" ? "online" : "offline";
    const client = createSupabaseBrowserClient();
    if (!client) return;

    const { error } = await client
      .from("profiles")
      .update({ worker_status: newStatus })
      .eq("id", session.user.id);

    if (error) {
      setError(`Failed to update status: ${error.message}`);
    } else {
      setWorkerProfile({ ...workerProfile, worker_status: newStatus });
      setMessage(`Status: ${newStatus === "online" ? "Online and accepting jobs" : "Offline"}`);
    }
  };

  const toggleServiceTypeInput = (serviceType: ServiceType) => {
    setServiceTypesInput((current) =>
      current.includes(serviceType)
        ? current.filter((entry) => entry !== serviceType)
        : [...current, serviceType],
    );
  };

  const saveWorkerProfile = async () => {
    if (!session || !workerProfile) return;

    const details = workDetailsInput.trim();
    const years = Number.parseInt(experienceYearsInput, 10);
    const legalFullName = backgroundInputs.legalFullName.trim();
    const ssnLast4 = backgroundInputs.ssnLast4.replace(/\D/g, "");
    const driverLicenseNumber = backgroundInputs.driverLicenseNumber.trim();
    const driverLicenseState = backgroundInputs.driverLicenseState.trim().toUpperCase();
    const legalAddressLine1 = backgroundInputs.legalAddressLine1.trim();
    const legalAddressLine2 = backgroundInputs.legalAddressLine2.trim();
    const legalCity = backgroundInputs.legalCity.trim();
    const legalState = backgroundInputs.legalState.trim().toUpperCase();
    const legalPostalCode = backgroundInputs.legalPostalCode.trim().toUpperCase();
    const payoutAccountHolderName = backgroundInputs.payoutAccountHolderName.trim();
    const payoutBankName = backgroundInputs.payoutBankName.trim();
    const payoutAccountType = backgroundInputs.payoutAccountType.trim().toLowerCase();
    const payoutAccountLast4 = backgroundInputs.payoutAccountLast4.replace(/\D/g, "");
    const payoutRoutingLast4 = backgroundInputs.payoutRoutingLast4.replace(/\D/g, "");

    if (details.length < 10) {
      setError("Please add more work details (at least 10 characters).");
      return;
    }

    if (!Number.isInteger(years) || years < 0) {
      setError("Enter valid experience in years (0 or more).");
      return;
    }

    if (serviceTypesInput.length === 0) {
      setError("Select at least one service you can handle.");
      return;
    }

    if (!legalFullName) {
      setError("Enter your legal full name for the background check.");
      return;
    }

    if (!/^\d{4}$/.test(ssnLast4)) {
      setError("Enter the last 4 digits of your Social Security number.");
      return;
    }

    if (driverLicenseNumber.length < 3) {
      setError("Enter your driver license number.");
      return;
    }

    if (!/^[A-Z]{2}$/.test(driverLicenseState)) {
      setError("Enter the two-letter state for your driver license.");
      return;
    }

    if (!legalAddressLine1 || !legalCity || !/^[A-Z]{2}$/.test(legalState) || !legalPostalCode) {
      setError("Enter your legal address, city, two-letter state, and ZIP/postal code.");
      return;
    }

    if (!payoutAccountHolderName) {
      setError("Enter the account holder name for your payout account.");
      return;
    }

    if (!payoutBankName) {
      setError("Enter the bank name for your payout account.");
      return;
    }

    if (!["checking", "savings"].includes(payoutAccountType)) {
      setError("Select a payout account type.");
      return;
    }

    if (!/^\d{4}$/.test(payoutAccountLast4)) {
      setError("Enter the last 4 digits of your payout account number.");
      return;
    }

    if (!/^\d{4}$/.test(payoutRoutingLast4)) {
      setError("Enter the last 4 digits of your routing number.");
      return;
    }

    if (workerNeedsConsent && !workerConsentChecked) {
      setError("Service partners must consent to a background check before saving the profile.");
      return;
    }

    const client = createSupabaseBrowserClient();
    if (!client) return;

    setSavingProfile(true);
    setError(null);
    setMessage(null);

    try {
      if (workerNeedsConsent) {
        const { data: consentData, error: consentError } = await client.rpc(
          "accept_worker_background_check_consent",
          {
            p_platform: "web",
            p_consent_version: HELPER_BACKGROUND_CHECK_CONSENT_VERSION,
          },
        );

        if (consentError) throw consentError;
        if (consentData) {
          syncWorkerProfileState(consentData as WorkerProfile);
        }
      }

      const resolvedStatus = workerCanAcceptNewJobs ? workerStatusInput : "offline";
      const { data: updatedProfile, error: saveError } = await client.rpc("submit_worker_profile", {
        p_worker_status: resolvedStatus,
        p_worker_work_details: details,
        p_worker_experience_years: years,
        p_service_types: serviceTypesInput,
        p_legal_full_name: legalFullName,
        p_ssn_last4: ssnLast4,
        p_driver_license_number: driverLicenseNumber,
        p_driver_license_state: driverLicenseState,
        p_legal_address_line1: legalAddressLine1,
        p_legal_address_line2: legalAddressLine2,
        p_legal_city: legalCity,
        p_legal_state: legalState,
        p_legal_postal_code: legalPostalCode,
        p_payout_account_holder_name: payoutAccountHolderName,
        p_payout_bank_name: payoutBankName,
        p_payout_account_type: payoutAccountType,
        p_payout_account_last4: payoutAccountLast4,
        p_payout_routing_last4: payoutRoutingLast4,
      });

      if (saveError) throw saveError;

      syncWorkerProfileState(updatedProfile as WorkerProfile);
      const nextBackgroundCheck: WorkerBackgroundCheck = {
        worker_id: session.user.id,
        legal_full_name: legalFullName,
        ssn_last4: ssnLast4,
        driver_license_number: driverLicenseNumber,
        driver_license_state: driverLicenseState,
        legal_address_line1: legalAddressLine1,
        legal_address_line2: legalAddressLine2 || null,
        legal_city: legalCity,
        legal_state: legalState,
        legal_postal_code: legalPostalCode,
        payout_account_holder_name: payoutAccountHolderName,
        payout_bank_name: payoutBankName,
        payout_account_type: payoutAccountType,
        payout_account_last4: payoutAccountLast4,
        payout_routing_last4: payoutRoutingLast4,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      };
      setBackgroundCheck(nextBackgroundCheck);
      setBackgroundInputs(backgroundCheckInputsFromRecord(nextBackgroundCheck));
      if (feedServiceFilter !== "all" && !serviceTypesInput.includes(feedServiceFilter)) {
        setFeedServiceFilter("all");
      }
      setMessage(
        workerVerified && !workerDisabled
          ? "Service partner profile saved."
          : "Service partner profile, background check, and payout account details saved. Staff review is required before you can go online.",
      );
      setShowProfileEditor(false);
    } catch (err) {
      setError(`Failed to save worker profile: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const renderProfileForm = (options?: { compactHeader?: boolean }) => (
    <div style={{ maxWidth: "640px", margin: options?.compactHeader ? "0" : "0 auto", display: "flex", flexDirection: "column", gap: "12px" }}>
      {!options?.compactHeader && <h2 style={{ marginBottom: "4px" }}>Complete Service Partner Profile</h2>}
      {!options?.compactHeader && (
        <p style={{ marginTop: 0, color: "#555" }}>
          Share your services, experience, background check details, and payout account information before accepting jobs.
        </p>
      )}
      {workerNeedsConsent ? (
        <label
          style={{
            alignItems: "flex-start",
            border: "1px solid #ddd",
            borderRadius: "8px",
            display: "flex",
            gap: "10px",
            padding: "12px",
          }}
        >
          <input
            checked={workerConsentChecked}
            disabled={savingProfile}
            onChange={(event) => setWorkerConsentChecked(event.target.checked)}
            type="checkbox"
            style={{ marginTop: "4px" }}
          />
          <span style={{ lineHeight: 1.5 }}>
            I consent to a background check so RapidoHelp can review my service partner profile for approval.
          </span>
        </label>
      ) : workerConsentOnFile ? (
        <p style={{ margin: 0, color: "#2E7D32", fontSize: "13px" }}>
          Background check consent is already on file.
        </p>
      ) : null}

      {error && (
        <div style={{ color: "#8A1C0F", padding: "12px", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
          {error}
        </div>
      )}
      {message && (
        <div style={{ color: "#1B5E20", padding: "12px", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
          {message}
        </div>
      )}

      <label style={{ display: "block" }}>
        <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Current status</span>
        <select
          value={workerStatusInput}
          onChange={(event) => setWorkerStatusInput(event.target.value as WorkerProfile["worker_status"])}
          disabled={savingProfile || workerProfile?.worker_status === "on_job" || !workerCanAcceptNewJobs}
          style={{ width: "100%" }}
        >
          <option value="offline">Offline</option>
          <option value="online">Online</option>
          {workerStatusInput === "on_job" && <option value="on_job">On job</option>}
        </select>
        {!workerCanAcceptNewJobs && (
          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#666" }}>
            Service partners can go online after staff approval.
          </p>
        )}
      </label>

      <div>
        <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Services offered</span>
        <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {SERVICE_TYPES.map((type) => (
            <label
              key={type}
              style={{
                alignItems: "center",
                border: "1px solid #ddd",
                borderRadius: "6px",
                display: "flex",
                gap: "8px",
                padding: "8px",
              }}
            >
              <input
                checked={serviceTypesInput.includes(type)}
                disabled={savingProfile}
                onChange={() => toggleServiceTypeInput(type)}
                type="checkbox"
              />
              <span>{serviceTypeLabels[type]}</span>
            </label>
          ))}
        </div>
      </div>

      <label style={{ display: "block" }}>
        <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Work details</span>
        <textarea
          value={workDetailsInput}
          onChange={(event) => setWorkDetailsInput(event.target.value)}
          disabled={savingProfile}
          rows={4}
          placeholder="Example: Roadside assistance, towing, and tire repair."
          style={{ width: "100%", resize: "vertical" }}
        />
      </label>

      <label style={{ display: "block" }}>
        <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Experience (years)</span>
        <input
          type="number"
          min="0"
          step="1"
          value={experienceYearsInput}
          onChange={(event) => setExperienceYearsInput(event.target.value)}
          disabled={savingProfile}
          style={{ width: "100%" }}
        />
      </label>

      <fieldset style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "14px", margin: 0 }}>
        <legend style={{ fontWeight: 700, padding: "0 6px" }}>Background check details</legend>
        <p style={{ margin: "0 0 12px", color: "#555", fontSize: "13px", lineHeight: 1.5 }}>
          Use your legal information. RapidoHelp stores SSN last 4 here; full SSN collection should stay with an approved background-check provider.
        </p>

        <div style={{ display: "grid", gap: "12px" }}>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Legal full name</span>
            <input
              autoComplete="name"
              disabled={savingProfile}
              onChange={(event) =>
                setBackgroundInputs((current) => ({ ...current, legalFullName: event.target.value }))
              }
              placeholder="First Middle Last"
              type="text"
              value={backgroundInputs.legalFullName}
              style={{ width: "100%" }}
            />
          </label>

          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>SSN last 4</span>
              <input
                autoComplete="off"
                disabled={savingProfile}
                inputMode="numeric"
                maxLength={4}
                onChange={(event) =>
                  setBackgroundInputs((current) => ({
                    ...current,
                    ssnLast4: event.target.value.replace(/\D/g, "").slice(0, 4),
                  }))
                }
                placeholder="1234"
                type="text"
                value={backgroundInputs.ssnLast4}
                style={{ width: "100%" }}
              />
            </label>

            <label style={{ display: "block" }}>
              <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Driver license state</span>
              <input
                autoComplete="off"
                disabled={savingProfile}
                maxLength={2}
                onChange={(event) =>
                  setBackgroundInputs((current) => ({
                    ...current,
                    driverLicenseState: event.target.value.toUpperCase().slice(0, 2),
                  }))
                }
                placeholder="CA"
                type="text"
                value={backgroundInputs.driverLicenseState}
                style={{ width: "100%" }}
              />
            </label>
          </div>

          <label style={{ display: "block" }}>
            <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Driver license number</span>
            <input
              autoComplete="off"
              disabled={savingProfile}
              onChange={(event) =>
                setBackgroundInputs((current) => ({ ...current, driverLicenseNumber: event.target.value }))
              }
              type="text"
              value={backgroundInputs.driverLicenseNumber}
              style={{ width: "100%" }}
            />
          </label>

          <label style={{ display: "block" }}>
            <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Legal address</span>
            <input
              autoComplete="address-line1"
              disabled={savingProfile}
              onChange={(event) =>
                setBackgroundInputs((current) => ({ ...current, legalAddressLine1: event.target.value }))
              }
              placeholder="Street address"
              type="text"
              value={backgroundInputs.legalAddressLine1}
              style={{ width: "100%" }}
            />
          </label>

          <label style={{ display: "block" }}>
            <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Apt, suite, unit (optional)</span>
            <input
              autoComplete="address-line2"
              disabled={savingProfile}
              onChange={(event) =>
                setBackgroundInputs((current) => ({ ...current, legalAddressLine2: event.target.value }))
              }
              type="text"
              value={backgroundInputs.legalAddressLine2}
              style={{ width: "100%" }}
            />
          </label>

          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>City</span>
              <input
                autoComplete="address-level2"
                disabled={savingProfile}
                onChange={(event) =>
                  setBackgroundInputs((current) => ({ ...current, legalCity: event.target.value }))
                }
                type="text"
                value={backgroundInputs.legalCity}
                style={{ width: "100%" }}
              />
            </label>

            <label style={{ display: "block" }}>
              <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>State</span>
              <input
                autoComplete="address-level1"
                disabled={savingProfile}
                maxLength={2}
                onChange={(event) =>
                  setBackgroundInputs((current) => ({
                    ...current,
                    legalState: event.target.value.toUpperCase().slice(0, 2),
                  }))
                }
                placeholder="CA"
                type="text"
                value={backgroundInputs.legalState}
                style={{ width: "100%" }}
              />
            </label>

            <label style={{ display: "block" }}>
              <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>ZIP / postal code</span>
              <input
                autoComplete="postal-code"
                disabled={savingProfile}
                onChange={(event) =>
                  setBackgroundInputs((current) => ({ ...current, legalPostalCode: event.target.value }))
                }
                type="text"
                value={backgroundInputs.legalPostalCode}
                style={{ width: "100%" }}
              />
            </label>
          </div>
        </div>
      </fieldset>

      <fieldset style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "14px", margin: 0 }}>
        <legend style={{ fontWeight: 700, padding: "0 6px" }}>Payout account information</legend>
        <p style={{ margin: "0 0 12px", color: "#555", fontSize: "13px", lineHeight: 1.5 }}>
          Use the bank account where your worker payouts should go. We keep the payout details you enter here on file for review.
        </p>

        <div style={{ display: "grid", gap: "12px" }}>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Account holder name</span>
            <input
              autoComplete="name"
              disabled={savingProfile}
              onChange={(event) =>
                setBackgroundInputs((current) => ({ ...current, payoutAccountHolderName: event.target.value }))
              }
              placeholder="First Middle Last"
              type="text"
              value={backgroundInputs.payoutAccountHolderName}
              style={{ width: "100%" }}
            />
          </label>

          <label style={{ display: "block" }}>
            <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Bank name</span>
            <input
              autoComplete="organization"
              disabled={savingProfile}
              onChange={(event) =>
                setBackgroundInputs((current) => ({ ...current, payoutBankName: event.target.value }))
              }
              placeholder="Bank of Example"
              type="text"
              value={backgroundInputs.payoutBankName}
              style={{ width: "100%" }}
            />
          </label>

          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Account type</span>
              <select
                disabled={savingProfile}
                value={backgroundInputs.payoutAccountType}
                onChange={(event) =>
                  setBackgroundInputs((current) => ({ ...current, payoutAccountType: event.target.value }))
                }
                style={{ width: "100%" }}
              >
                <option value="">Select one</option>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </label>

            <label style={{ display: "block" }}>
              <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Account last 4</span>
              <input
                autoComplete="off"
                disabled={savingProfile}
                inputMode="numeric"
                maxLength={4}
                onChange={(event) =>
                  setBackgroundInputs((current) => ({
                    ...current,
                    payoutAccountLast4: event.target.value.replace(/\D/g, "").slice(0, 4),
                  }))
                }
                placeholder="1234"
                type="text"
                value={backgroundInputs.payoutAccountLast4}
                style={{ width: "100%" }}
              />
            </label>

            <label style={{ display: "block" }}>
              <span style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Routing last 4</span>
              <input
                autoComplete="off"
                disabled={savingProfile}
                inputMode="numeric"
                maxLength={4}
                onChange={(event) =>
                  setBackgroundInputs((current) => ({
                    ...current,
                    payoutRoutingLast4: event.target.value.replace(/\D/g, "").slice(0, 4),
                  }))
                }
                placeholder="6789"
                type="text"
                value={backgroundInputs.payoutRoutingLast4}
                style={{ width: "100%" }}
              />
            </label>
          </div>
        </div>
      </fieldset>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={saveWorkerProfile}
          disabled={savingProfile}
          style={{
            padding: "10px 16px",
            backgroundColor: "#0057FF",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: savingProfile ? "not-allowed" : "pointer",
            opacity: savingProfile ? 0.7 : 1,
          }}
        >
          {savingProfile ? "Saving..." : "Save Service Partner Profile"}
        </button>
        {options?.compactHeader && (
          <button
            onClick={() => setShowProfileEditor(false)}
            disabled={savingProfile}
            style={{
              padding: "10px 16px",
              backgroundColor: "transparent",
              color: "#333",
              border: "1px solid #bbb",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: savingProfile ? "not-allowed" : "pointer",
              opacity: savingProfile ? 0.7 : 1,
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );

  if (loading) {
    return <div className="panel"><p>Loading...</p></div>;
  }

  if (!session) {
    return <div className="panel"><p>Redirecting to sign in...</p></div>;
  }

  if (workerProfile && !workerProfileComplete) {
    return (
      <div className="panel">
        {renderProfileForm()}
      </div>
    );
  }

  const availableServiceTypes = workerProfile?.service_types ?? [];
  const totalEarnings = Number(workerProfile?.total_earnings ?? 0);
  const historyJobCount = workerHistoryJobs.length;
  const visiblePendingJobs = workerCanAcceptNewJobs
    ? pendingJobs.filter((job) => {
        if (!jobMatchesWorkerServices(job, workerProfile)) return false;
        return feedServiceFilter === "all" || job.service_type === feedServiceFilter;
      })
    : [];
  const pendingPayout = completedJobs
    .filter((job) => job.payment_status !== "paid")
    .reduce((sum, job) => {
      if (job.worker_payout_amount) return sum + Number(job.worker_payout_amount);
      const amount = Number(job.final_price ?? job.estimated_price ?? 0);
      return amount > 0 ? sum + calculatePayoutSplit(amount).workerPayoutAmount : sum;
    }, 0);
  const workerDisplayName = workerProfile?.full_name?.trim() || workerProfile?.handle || session.user.email || "Worker";

  return (
    <div className="panel">
      {/* Worker profile header */}
      <div style={{ marginBottom: "32px", padding: "16px", backgroundColor: "#f5f5f5", borderRadius: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div>
            <h3 style={{ margin: "0 0 4px 0" }}>
              {workerProfile?.handle ?? session.user.email}
            </h3>
            {(workerProfile?.worker_rating_count ?? 0) > 0 && (
              <p style={{ margin: "0", fontSize: "14px", color: "#666" }}>
                Rating: {workerProfile?.worker_rating_avg?.toFixed(1)} ({workerProfile?.worker_rating_count} ratings)
              </p>
            )}
          </div>
          <button
            onClick={toggleAvailability}
            disabled={workerProfile?.worker_status === "on_job" || !workerCanAcceptNewJobs}
            style={{
              padding: "8px 16px",
              backgroundColor:
                workerProfile?.worker_status === "on_job"
                  ? "#0057FF"
                  : workerDisabled
                    ? "#8A1C0F"
                    : !workerVerified
                      ? "#C77800"
                      : workerProfile?.worker_status === "online"
                  ? "#2E7D32"
                  : "#999",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: workerProfile?.worker_status === "on_job" || !workerCanAcceptNewJobs ? "not-allowed" : "pointer",
            }}
          >
            {workerProfile?.worker_status === "on_job"
              ? "On job"
              : workerDisabled
                ? "Paused"
                : !workerVerified
                  ? "Pending review"
                  : workerProfile?.worker_status === "online"
                    ? "Online"
                    : "Offline"}
          </button>
        </div>
        <p style={{ margin: "0", fontSize: "13px", color: "#666" }}>
          Services: {availableServiceTypes.map((type) => serviceTypeLabels[type]).join(", ")}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#666" }}>
          Background check: {backgroundCheck?.status?.replaceAll("_", " ") ?? "not submitted"}
          {backgroundCheck?.ssn_last4 ? ` · SSN last 4 ending ${backgroundCheck.ssn_last4}` : ""}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#666" }}>
          Consent: {workerConsentOnFile ? "on file" : "pending service partner consent"}
          {workerProfile?.worker_background_check_consent_platform
            ? ` · ${workerProfile.worker_background_check_consent_platform}`
            : ""}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
          <span className="pill muted">Total earnings: ${totalEarnings.toFixed(2)}</span>
          <span className="pill muted">Pending payout: ${pendingPayout.toFixed(2)}</span>
          <span className="pill muted">{historyJobCount} work history items</span>
        </div>
        <div style={{ marginTop: "12px" }}>
          <button
            onClick={() => setShowProfileEditor((current) => !current)}
            style={{
              padding: "8px 12px",
              backgroundColor: "white",
              color: "#0057FF",
              border: "1px solid #0057FF",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {showProfileEditor ? "Close Profile Editor" : "Edit Profile"}
          </button>
        </div>
      </div>

      {!workerVerified && !workerDisabled && (
        <div style={{ marginBottom: "16px", padding: "14px 16px", backgroundColor: "#FFF5E8", border: "1px solid #F0C78A", borderRadius: "8px", color: "#8A5A00" }}>
          Your service partner profile is complete and waiting for staff approval. You can keep editing your details, but job intake stays offline until review is done.
        </div>
      )}

      {workerDisabled && (
        <div style={{ marginBottom: "16px", padding: "14px 16px", backgroundColor: "#FFF1EF", border: "1px solid #E2A39A", borderRadius: "8px", color: "#8A1C0F" }}>
          Your service partner access is currently paused by staff. Review your history here and contact support if you need to restore access.
        </div>
      )}

      {!workerCanAcceptNewJobs && !workerDisabled && (
        <div
          style={{
            marginBottom: "16px",
            padding: "14px 16px",
            backgroundColor: "#FFF5E8",
            border: "1px solid #F0C78A",
            borderRadius: "8px",
            color: "#8A5A00",
          }}
        >
          Your service partner profile is complete and waiting for staff approval. You can review earnings and work history while we finish the background review.
        </div>
      )}

      {showProfileEditor && (
        <div style={{ marginBottom: "24px", padding: "16px", backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: "8px" }}>
          <h3 style={{ margin: "0 0 10px 0" }}>Edit Service Partner Profile</h3>
          {renderProfileForm({ compactHeader: true })}
        </div>
      )}

      {error && <div style={{ color: "#8A1C0F", padding: "12px", backgroundColor: "#f5f5f5", borderRadius: "4px", marginBottom: "16px" }}>{error}</div>}
      {message && <div style={{ color: "#1B5E20", padding: "12px", backgroundColor: "#f5f5f5", borderRadius: "4px", marginBottom: "16px" }}>{message}</div>}

      {/* Accepted jobs */}
      {workerCanAcceptNewJobs && acceptedJobs.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ marginBottom: "12px" }}>Active jobs ({acceptedJobs.length})</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {acceptedJobs.map((job) => (
                  <div key={job.id} style={{ padding: "16px", border: "2px solid #0057FF", borderRadius: "8px", backgroundColor: "#f0f7ff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <h3 style={{ margin: "0", fontSize: "16px" }}>{serviceTypeLabels[job.service_type]}</h3>
                  <span
                    style={{
                      padding: "4px 12px",
                      backgroundColor: statusColor(job.status),
                      color: "white",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    {jobStatusLabels[job.status]}
                  </span>
                </div>
                <p style={{ margin: "0 0 8px 0", color: "#333" }}>{job.description}</p>
                <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#666" }}>
                  Location: {job.location_name}
                </p>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#666' }}>
                  {paymentStatusLabels[job.payment_status]}
                </p>
                {job.status === "accepted" ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    <button
                      onClick={() => startJob(job.id)}
                      disabled={startingJobId === job.id}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#0057FF",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: 600,
                        cursor: startingJobId === job.id ? "not-allowed" : "pointer",
                        opacity: startingJobId === job.id ? 0.6 : 1,
                      }}
                    >
                      {startingJobId === job.id ? "Updating..." : "Mark arrived"}
                    </button>
                    <button
                      onClick={() => cancelWorkerJob(job.id)}
                      disabled={cancellingJobId === job.id}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "transparent",
                        color: "#8A1C0F",
                        border: "1px solid #8A1C0F",
                        borderRadius: "6px",
                        fontWeight: 600,
                        cursor: cancellingJobId === job.id ? "not-allowed" : "pointer",
                        opacity: cancellingJobId === job.id ? 0.6 : 1,
                      }}
                    >
                      {cancellingJobId === job.id ? "Cancelling..." : "Cancel job"}
                    </button>
                  </div>
                ) : (
                  <>
                    <label style={{ display: 'block', marginBottom: '12px' }}>
                      <span style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                        Final price for customer
                      </span>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        inputMode="decimal"
                        value={finalPriceInputs[job.id] ?? String(job.final_price ?? job.estimated_price ?? '')}
                        onChange={(event) =>
                          setFinalPriceInputs((current) => ({
                            ...current,
                            [job.id]: event.target.value,
                          }))
                        }
                        style={{ width: '100%' }}
                      />
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      <button
                        onClick={() => completeJob(job.id)}
                        disabled={completingJobId === job.id}
                        style={{
                          padding: "8px 16px",
                          backgroundColor: "#2E7D32",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontWeight: 600,
                          cursor: completingJobId === job.id ? "not-allowed" : "pointer",
                          opacity: completingJobId === job.id ? 0.6 : 1,
                        }}
                      >
                        {completingJobId === job.id ? "Marking done..." : "Mark complete"}
                      </button>
                      <button
                        onClick={() => cancelWorkerJob(job.id)}
                        disabled={cancellingJobId === job.id}
                        style={{
                          padding: "8px 16px",
                          backgroundColor: "transparent",
                          color: "#8A1C0F",
                          border: "1px solid #8A1C0F",
                          borderRadius: "6px",
                          fontWeight: 600,
                          cursor: cancellingJobId === job.id ? "not-allowed" : "pointer",
                          opacity: cancellingJobId === job.id ? 0.6 : 1,
                        }}
                      >
                        {cancellingJobId === job.id ? "Cancelling..." : "Cancel job"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Work history */}
      <div style={{ marginBottom: "32px" }}>
        <h2 style={{ marginBottom: "12px" }}>
          Work history <span style={{ color: "#666", fontSize: "14px" }}>({historyJobCount})</span>
        </h2>
        {workerHistoryJobs.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "#666" }}>
            <p>No work history yet.</p>
            <p style={{ fontSize: "12px", marginTop: "8px" }}>
              Completed, active, and cancelled jobs will appear here once you start working.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {workerHistoryJobs.map((job) => {
              const payoutAmount = getWorkerJobPayout(job);
              const payoutLabel =
                job.status === "completed"
                  ? job.payment_status === "paid"
                    ? `Earned ${money(payoutAmount)}`
                    : `Pending payout ${money(payoutAmount)}`
                  : job.status === "cancelled_by_worker"
                    ? "No payout"
                    : payoutAmount > 0
                      ? `Potential payout ${money(payoutAmount)}`
                      : "Payout pending";
              const timelineLabel = job.completed_at
                ? `Completed ${new Date(job.completed_at).toLocaleString()}`
                : job.accepted_at
                  ? `Accepted ${new Date(job.accepted_at).toLocaleString()}`
                  : `Created ${new Date(job.created_at).toLocaleString()}`;
              const isCompleted = job.status === "completed";

              return (
                <div key={job.id} style={{ padding: "16px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "8px" }}>
                    <h3 style={{ margin: "0", fontSize: "16px" }}>{serviceTypeLabels[job.service_type]}</h3>
                    <span
                      style={{
                        padding: "4px 12px",
                        backgroundColor: statusColor(job.status),
                        color: "white",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      {jobStatusLabels[job.status]}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 8px 0", color: "#333" }}>{job.description}</p>
                  {job.location_name && (
                    <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#666" }}>
                      Location: {job.location_name}
                    </p>
                  )}
                  <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#666" }}>{timelineLabel}</p>
                  <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#666" }}>{payoutLabel}</p>
                  <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#666" }}>
                    {paymentStatusLabels[job.payment_status]}
                  </p>
                  {isCompleted && (
                    <button
                      onClick={() => downloadWorkerWaybill(job, workerDisplayName)}
                      type="button"
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#0057FF",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Download waybill
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending jobs */}
      {workerCanAcceptNewJobs ? (
      <div>
        <h2 style={{ marginBottom: "12px" }}>
          Available jobs <span style={{ color: "#666", fontSize: "14px" }}>({visiblePendingJobs.length})</span>
        </h2>
        <label style={{ display: "block", marginBottom: "12px" }}>
          <span style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600 }}>
            Filter by service
          </span>
          <select
            value={feedServiceFilter}
            onChange={(event) => setFeedServiceFilter(event.target.value as "all" | ServiceType)}
            style={{ width: "100%" }}
          >
            <option value="all">All my services</option>
            {availableServiceTypes.map((type) => (
              <option key={type} value={type}>
                {serviceTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        {visiblePendingJobs.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "#666" }}>
            <p>No matching jobs available right now.</p>
            <p style={{ fontSize: "12px", marginTop: "8px" }}>
              {workerCanAcceptNewJobs
                ? "Check your services or toggle your availability status above."
                : "Once staff approval is active, matching jobs will appear here."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {visiblePendingJobs.map((job) => (
              <div key={job.id} style={{ padding: "16px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <h3 style={{ margin: "0", fontSize: "16px" }}>{serviceTypeLabels[job.service_type]}</h3>
                  {job.estimated_price && (
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#0057FF" }}>
                      ${job.estimated_price.toFixed(2)}
                    </span>
                  )}
                </div>
                <p style={{ margin: "0 0 8px 0", color: "#666", fontSize: "14px" }}>
                  {job.description}
                </p>
                <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#999" }}>
                  Location: {job.location_name}
                </p>
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#999' }}>
                  {paymentStatusLabels[job.payment_status]}
                </p>
                <button
                  onClick={() => acceptJob(job.id)}
                  disabled={acceptingJobId === job.id || workerProfile?.worker_status !== "online"}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#0057FF",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: 600,
                    cursor: acceptingJobId === job.id || workerProfile?.worker_status !== "online" ? "not-allowed" : "pointer",
                    opacity: acceptingJobId === job.id || workerProfile?.worker_status !== "online" ? 0.6 : 1,
                  }}
                >
                  {acceptingJobId === job.id
                    ? "Accepting..."
                    : workerProfile?.worker_status !== "online"
                      ? "Go online first"
                      : "Accept job"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      ) : null}
    </div>
  );
}
