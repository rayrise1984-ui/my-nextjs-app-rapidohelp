"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import type { Job } from "@/lib/marketplace";
import { createSupabaseBrowserClient } from "@/lib/supabase";

interface JobRatingPanelProps {
  job: Job;
  onRatingSubmitted?: () => void;
}

export function JobRatingPanel({ job, onRatingSubmitted }: JobRatingPanelProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!job.worker_id || job.status !== "completed") {
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a rating.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const client = createSupabaseBrowserClient();
    if (!client) return;

    try {
      const { error: ratingError } = await client.rpc("rate_worker", {
        p_job_id: job.id,
        p_rating: rating,
        p_comment: comment.trim() || null,
      });

      if (ratingError) throw ratingError;

      setSuccess(true);
      setRating(0);
      setComment("");
      onRatingSubmitted?.();
    } catch (err) {
      setError(`Failed to submit rating: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={{ padding: "16px", backgroundColor: "#e8f5e9", borderRadius: "8px", textAlign: "center" }}>
        <p style={{ margin: 0, color: "#2E7D32", fontWeight: 600 }}>Rating submitted</p>
        <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#1B5E20" }}>Thank you for helping the community!</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px", backgroundColor: "#fff3e0", borderRadius: "8px" }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>Rate this service partner</h3>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: 600 }}>How was the service?</p>
          <div style={{ display: "flex", gap: "8px" }}>
            {[1, 2, 3, 4, 5].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRating(r)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: rating >= r ? "#FFB300" : "#f5f5f5",
                  border: rating >= r ? "2px solid #FF8C00" : "1px solid #ddd",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "18px",
                  fontWeight: 600,
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", fontWeight: 600 }}>
            Comment (optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share more about your experience..."
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              minHeight: "60px",
              fontFamily: "inherit",
              fontSize: "13px",
            }}
          />
        </div>

        {error && <p style={{ margin: "0", color: "#8A1C0F", fontSize: "13px" }}>{error}</p>}

        <button
          type="submit"
          disabled={submitting || rating === 0}
          style={{
            padding: "8px 12px",
            backgroundColor: rating === 0 ? "#ccc" : "#0057FF",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontWeight: 600,
            cursor: submitting || rating === 0 ? "not-allowed" : "pointer",
            fontSize: "13px",
          }}
        >
          {submitting ? "Submitting..." : "Submit rating"}
        </button>
      </form>
    </div>
  );
}
