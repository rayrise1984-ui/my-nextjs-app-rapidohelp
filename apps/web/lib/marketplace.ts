// Service platform types for RapidoHelp.

export type ServiceType =
  | 'flat_tire'
  | 'jump_start'
  | 'fuel_delivery'
  | 'towing'
  | 'moving_help'
  | 'handyman_help'
  | 'plumbing_help'
  | 'electrical_help'
  | 'cna_support'
  | 'senior_helper'
  | 'cleaning_help'
  | 'delivery_help'
  | 'pet_help'
  | 'tech_help'
  | 'others';
export type JobStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'cancelled_by_worker';
export type WorkerStatus = 'offline' | 'online' | 'on_job';
export type AppRole = 'customer' | 'agent' | 'admin';

export interface Job {
  id: string;
  user_id: string;
  worker_id: string | null;
  service_type: ServiceType;
  description: string;
  location_lat: number;
  location_lng: number;
  location_name?: string;
  status: JobStatus;
  estimated_price?: number;
  final_price?: number;
  payment_status: 'unpaid' | 'processing' | 'paid' | 'refunded';
  payment_method?: 'card' | 'upi' | 'cash';
  payment_reference?: string;
  paid_at?: string;
  company_fee_amount?: number;
  worker_payout_amount?: number;
  created_at: string;
  accepted_at?: string;
  completed_at?: string;
  updated_at: string;
}

export interface WorkerProfile {
  id: string;
  email?: string;
  handle?: string;
  full_name?: string | null;
  avatar_url?: string;
  role?: AppRole;
  is_worker: boolean;
  worker_rating_avg?: number;
  worker_rating_count: number;
  total_earnings: number;
  worker_status: WorkerStatus;
  worker_verified?: boolean | null;
  worker_disabled?: boolean | null;
  worker_background_check_consent_at?: string | null;
  worker_background_check_consent_platform?: string | null;
  worker_background_check_consent_version?: string | null;
  service_types: ServiceType[];
  worker_work_details?: string | null;
  worker_experience_years?: number | null;
  worker_profile_completed?: boolean | null;
}

export interface JobAssignment {
  id: string;
  job_id: string;
  worker_id: string;
  status: 'offered' | 'accepted' | 'declined' | 'completed';
  offered_at: string;
  responded_at?: string;
}

export interface WorkerRating {
  id: string;
  job_id: string;
  from_user_id: string;
  to_worker_id: string;
  rating: number; // 1-5
  comment?: string;
  created_at: string;
}

// Realtime payload type
export type PostgresChangePayload<T> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: Partial<T> & { id?: string };
};

// Helper functions for job state management

export function updateJob(jobs: Job[], updated: Job): Job[] {
  return jobs
    .map((j) => (j.id === updated.id ? updated : j))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function removeJob(jobs: Job[], jobId: string): Job[] {
  return jobs.filter((j) => j.id !== jobId);
}

export function addJob(jobs: Job[], newJob: Job): Job[] {
  return [newJob, ...jobs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function sortJobs(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export const serviceTypeLabels: Record<ServiceType, string> = {
  flat_tire: 'Flat Tire Fix',
  jump_start: 'Jump Start',
  fuel_delivery: 'Fuel Delivery',
  towing: 'Towing',
  moving_help: 'Moving Help',
  handyman_help: 'Handyman Help',
  plumbing_help: 'Plumbing Help',
  electrical_help: 'Electrical Help',
  cna_support: 'CNA Support',
  senior_helper: 'Senior Helper',
  cleaning_help: 'Cleaning Help',
  delivery_help: 'Delivery Help',
  pet_help: 'Pet Help',
  tech_help: 'Tech Help',
  others: 'Others',
};

export const bookableServiceTypes: ServiceType[] = [
  'flat_tire',
  'jump_start',
  'fuel_delivery',
  'towing',
  'moving_help',
  'handyman_help',
  'cleaning_help',
  'delivery_help',
  'pet_help',
  'tech_help',
];

export function isBookableServiceType(value: string): value is ServiceType {
  return bookableServiceTypes.includes(value as ServiceType);
}

export const jobStatusLabels: Record<JobStatus, string> = {
  pending: 'Looking for help',
  accepted: 'Help on the way',
  in_progress: 'Worker arrived',
  completed: 'Completed',
  cancelled: 'Cancelled',
  cancelled_by_worker: 'Worker cancelled',
};

export const paymentStatusLabels: Record<Job['payment_status'], string> = {
  unpaid: 'Payment pending',
  processing: 'Payment processing',
  paid: 'Paid',
  refunded: 'Refunded',
};

export function calculatePayoutSplit(amount: number): { companyFeeAmount: number; workerPayoutAmount: number } {
  const roundedAmount = Number(amount.toFixed(2));
  const companyFeeAmount = Number((roundedAmount * 0.2).toFixed(2));
  const workerPayoutAmount = Number((roundedAmount - companyFeeAmount).toFixed(2));

  return {
    companyFeeAmount,
    workerPayoutAmount,
  };
}

export function statusColor(status: JobStatus): string {
  switch (status) {
    case 'pending':
      return '#ff6b35'; // orange
    case 'accepted':
      return '#004e89'; // blue
    case 'in_progress':
      return '#f77f00'; // darker orange
    case 'completed':
      return '#06a77d'; // green
    case 'cancelled':
    case 'cancelled_by_worker':
      return '#999999'; // grey
    default:
      return '#999999';
  }
}
