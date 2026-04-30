import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addJob,
  bookableServiceTypes,
  calculatePayoutSplit,
  isBookableServiceType,
  jobStatusLabels,
  paymentStatusLabels,
  removeJob,
  serviceTypeLabels,
  sortJobs,
  statusColor,
  updateJob,
  type Job,
  type ServiceType,
} from "./marketplace.ts";

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: overrides.id ?? "job-1",
  user_id: overrides.user_id ?? "user-1",
  worker_id: overrides.worker_id ?? null,
  service_type: overrides.service_type ?? "flat_tire",
  description: overrides.description ?? "Flat tire on driveway",
  location_lat: overrides.location_lat ?? 38.294,
  location_lng: overrides.location_lng ?? -122.286,
  location_name: overrides.location_name ?? "Downtown",
  status: overrides.status ?? "pending",
  estimated_price: overrides.estimated_price ?? 45,
  final_price: overrides.final_price,
  payment_status: overrides.payment_status ?? "unpaid",
  payment_method: overrides.payment_method,
  payment_reference: overrides.payment_reference,
  paid_at: overrides.paid_at,
  company_fee_amount: overrides.company_fee_amount,
  worker_payout_amount: overrides.worker_payout_amount,
  created_at: overrides.created_at ?? "2026-04-27T12:00:00.000Z",
  accepted_at: overrides.accepted_at,
  completed_at: overrides.completed_at,
  updated_at: overrides.updated_at ?? "2026-04-27T12:00:00.000Z",
});

describe("marketplace job list helpers", () => {
  it("sorts jobs newest first", () => {
    const older = makeJob({ id: "older", created_at: "2026-04-27T10:00:00.000Z" });
    const newer = makeJob({ id: "newer", created_at: "2026-04-27T12:00:00.000Z" });

    assert.deepEqual(sortJobs([older, newer]).map((job) => job.id), ["newer", "older"]);
  });

  it("adds a job and keeps the list sorted", () => {
    const current = [makeJob({ id: "old", created_at: "2026-04-27T10:00:00.000Z" })];
    const next = addJob(current, makeJob({ id: "new", created_at: "2026-04-27T13:00:00.000Z" }));

    assert.deepEqual(next.map((job) => job.id), ["new", "old"]);
  });

  it("updates only the matching job", () => {
    const first = makeJob({ id: "first", status: "pending" });
    const second = makeJob({ id: "second", status: "pending" });
    const updatedSecond = makeJob({ id: "second", status: "accepted", worker_id: "worker-1" });

    const result = updateJob([first, second], updatedSecond);

    assert.equal(result.find((job) => job.id === "first")?.status, "pending");
    assert.equal(result.find((job) => job.id === "second")?.status, "accepted");
    assert.equal(result.find((job) => job.id === "second")?.worker_id, "worker-1");
  });

  it("removes a job by id", () => {
    const result = removeJob([makeJob({ id: "keep" }), makeJob({ id: "remove" })], "remove");

    assert.deepEqual(result.map((job) => job.id), ["keep"]);
  });
});

describe("marketplace service catalog", () => {
  it("has labels for every known service type", () => {
    const expectedTypes: ServiceType[] = [
      "flat_tire",
      "jump_start",
      "fuel_delivery",
      "towing",
      "moving_help",
      "handyman_help",
      "plumbing_help",
      "electrical_help",
      "cna_support",
      "senior_helper",
      "cleaning_help",
      "delivery_help",
      "pet_help",
      "tech_help",
      "others",
    ];

    assert.deepEqual(Object.keys(serviceTypeLabels).sort(), expectedTypes.sort());
  });

  it("guards bookable service types", () => {
    assert.equal(isBookableServiceType("flat_tire"), true);
    assert.equal(isBookableServiceType("tech_help"), true);
    assert.equal(isBookableServiceType("plumbing_help"), false);
    assert.equal(isBookableServiceType("not_a_service"), false);
    assert.ok(bookableServiceTypes.every((type) => serviceTypeLabels[type]));
  });
});

describe("marketplace payment and status helpers", () => {
  it("calculates the 20 percent company fee and worker payout with cents", () => {
    assert.deepEqual(calculatePayoutSplit(50), {
      companyFeeAmount: 10,
      workerPayoutAmount: 40,
    });
    assert.deepEqual(calculatePayoutSplit(45.55), {
      companyFeeAmount: 9.11,
      workerPayoutAmount: 36.44,
    });
  });

  it("labels all job and payment statuses used by the UI", () => {
    assert.equal(jobStatusLabels.pending, "Looking for help");
    assert.equal(jobStatusLabels.accepted, "Help on the way");
    assert.equal(jobStatusLabels.in_progress, "Worker arrived");
    assert.equal(jobStatusLabels.completed, "Completed");
    assert.equal(jobStatusLabels.cancelled_by_worker, "Worker cancelled");

    assert.equal(paymentStatusLabels.unpaid, "Payment pending");
    assert.equal(paymentStatusLabels.processing, "Payment processing");
    assert.equal(paymentStatusLabels.paid, "Paid");
    assert.equal(paymentStatusLabels.refunded, "Refunded");
  });

  it("returns stable colors for each job status", () => {
    assert.equal(statusColor("pending"), "#ff6b35");
    assert.equal(statusColor("accepted"), "#004e89");
    assert.equal(statusColor("in_progress"), "#f77f00");
    assert.equal(statusColor("completed"), "#06a77d");
    assert.equal(statusColor("cancelled"), "#999999");
    assert.equal(statusColor("cancelled_by_worker"), "#999999");
  });
});
