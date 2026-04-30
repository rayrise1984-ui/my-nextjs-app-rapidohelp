"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";

import type { SupportRequestComment } from "@/lib/support";

type RequestCommentsProps = {
  allowInternal?: boolean;
  comments: SupportRequestComment[];
  currentUserId: string;
  onSubmitComment: (body: string, isInternal?: boolean) => Promise<void> | void;
  requestId: string;
  requestOwnerId: string;
  staffView: boolean;
  submitting: boolean;
};

type CommentVisibilityFilter = "all" | "public" | "internal";

function getAuthorLabel(
  comment: SupportRequestComment,
  currentUserId: string,
  requestOwnerId: string,
  staffView: boolean,
) {
  if (comment.author_id === currentUserId) {
    return "You";
  }

  if (staffView) {
    return comment.author_id === requestOwnerId ? "Customer" : "Staff";
  }

  return "Support team";
}

export function RequestComments({
  allowInternal = false,
  comments,
  currentUserId,
  onSubmitComment,
  requestId,
  requestOwnerId,
  staffView,
  submitting,
}: RequestCommentsProps) {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [filter, setFilter] = useState<CommentVisibilityFilter>("all");

  const publicCount = comments.filter((comment) => !comment.is_internal).length;
  const internalCount = comments.filter((comment) => comment.is_internal).length;
  const filteredComments = comments.filter((comment) => {
    if (filter === "public") {
      return !comment.is_internal;
    }

    if (filter === "internal") {
      return comment.is_internal;
    }

    return true;
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextBody = body.trim();

    if (!nextBody) {
      return;
    }

    await onSubmitComment(nextBody, allowInternal ? internal : false);
    setBody("");
    setInternal(false);
  };

  const onBodyChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setBody(event.target.value);
  };

  const onInternalChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInternal(event.target.checked);
  };

  return (
    <div className="comments-block" data-request-id={requestId}>
      <h4 className="comments-title">Conversation</h4>

      {staffView ? (
        <div className="comments-toolbar">
          <div className="comments-stats">
            <span className="pill muted">{publicCount} customer-visible</span>
            <span className="pill">{internalCount} internal</span>
          </div>
          <div className="comments-filters" role="tablist" aria-label="Comment filter">
            <button
              className={filter === "all" ? "comment-filter active" : "comment-filter"}
              onClick={() => setFilter("all")}
              type="button"
            >
              All
            </button>
            <button
              className={filter === "public" ? "comment-filter active" : "comment-filter"}
              onClick={() => setFilter("public")}
              type="button"
            >
              Customer-visible
            </button>
            <button
              className={filter === "internal" ? "comment-filter active" : "comment-filter"}
              onClick={() => setFilter("internal")}
              type="button"
            >
              Internal only
            </button>
          </div>
        </div>
      ) : null}

      {filteredComments.length === 0 ? (
        <div className="empty-state">
          {comments.length === 0
            ? "No comments yet."
            : "No comments match the current filter."}
        </div>
      ) : (
        <div className="comments-list">
          {filteredComments.map((comment) => (
            <div className="comment-item" key={comment.id}>
              <div className="comment-meta">
                <span className="pill muted">
                  {getAuthorLabel(comment, currentUserId, requestOwnerId, staffView)}
                </span>
                {comment.is_internal ? (
                  <span className="pill">Internal note</span>
                ) : staffView ? (
                  <span className="pill muted">Visible to customer</span>
                ) : null}
                <span className="pill muted">
                  {new Date(comment.created_at).toLocaleString()}
                </span>
              </div>
              <p>{comment.body}</p>
            </div>
          ))}
        </div>
      )}

      <form className="dashboard-form comments-form" onSubmit={submit}>
        <label>
          {staffView ? "Add reply or note" : "Add comment"}
          <textarea
            onChange={onBodyChange}
            placeholder={
              staffView
                ? "Share an update with the customer or leave a staff note."
                : "Add more detail or respond to the support team."
            }
            required
            value={body}
          />
        </label>

        {allowInternal ? (
          <label className="comments-checkbox">
            <input
              checked={internal}
              onChange={onInternalChange}
              type="checkbox"
            />
            Save as internal note
          </label>
        ) : null}

        <div className="dashboard-actions">
          <button disabled={submitting} type="submit">
            {submitting ? "Posting..." : "Post comment"}
          </button>
        </div>
      </form>
    </div>
  );
}