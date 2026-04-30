import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  groupCommentsByRequest,
  removeComment,
  removeRequest,
  sortRequests,
  upsertComment,
  upsertRequest,
  type SupportRequest,
  type SupportRequestComment,
} from "./support.ts";

const makeRequest = (overrides: Partial<SupportRequest> = {}): SupportRequest => ({
  id: overrides.id ?? "request-1",
  user_id: overrides.user_id ?? "user-1",
  title: overrides.title ?? "Need help",
  description: overrides.description ?? "Test request",
  status: overrides.status ?? "open",
  priority: overrides.priority ?? "medium",
  created_at: overrides.created_at ?? "2026-04-27T12:00:00.000Z",
});

const makeComment = (
  overrides: Partial<SupportRequestComment> = {},
): SupportRequestComment => ({
  id: overrides.id ?? "comment-1",
  request_id: overrides.request_id ?? "request-1",
  author_id: overrides.author_id ?? "user-1",
  body: overrides.body ?? "Comment body",
  is_internal: overrides.is_internal ?? false,
  created_at: overrides.created_at ?? "2026-04-27T12:00:00.000Z",
});

describe("support request helpers", () => {
  it("sorts requests newest first", () => {
    const older = makeRequest({ id: "older", created_at: "2026-04-27T09:00:00.000Z" });
    const newer = makeRequest({ id: "newer", created_at: "2026-04-27T11:00:00.000Z" });

    assert.deepEqual(sortRequests([older, newer]).map((request) => request.id), [
      "newer",
      "older",
    ]);
  });

  it("upserts requests without duplicates", () => {
    const original = makeRequest({ id: "request-1", title: "Old title" });
    const updated = makeRequest({ id: "request-1", title: "New title" });

    const result = upsertRequest([original], updated);

    assert.equal(result.length, 1);
    assert.equal(result[0].title, "New title");
  });

  it("removes a request by id", () => {
    const result = removeRequest(
      [makeRequest({ id: "keep" }), makeRequest({ id: "remove" })],
      "remove",
    );

    assert.deepEqual(result.map((request) => request.id), ["keep"]);
  });
});

describe("support comment helpers", () => {
  it("groups comments by request and sorts them oldest first", () => {
    const grouped = groupCommentsByRequest([
      makeComment({
        id: "later",
        request_id: "request-1",
        created_at: "2026-04-27T12:00:00.000Z",
      }),
      makeComment({
        id: "earlier",
        request_id: "request-1",
        created_at: "2026-04-27T10:00:00.000Z",
      }),
      makeComment({ id: "other", request_id: "request-2" }),
    ]);

    assert.deepEqual(grouped["request-1"].map((comment) => comment.id), [
      "earlier",
      "later",
    ]);
    assert.deepEqual(grouped["request-2"].map((comment) => comment.id), ["other"]);
  });

  it("upserts a comment in the correct request bucket", () => {
    const current = groupCommentsByRequest([
      makeComment({ id: "comment-1", body: "Old body" }),
    ]);

    const result = upsertComment(
      current,
      makeComment({ id: "comment-1", body: "New body" }),
    );

    assert.equal(result["request-1"].length, 1);
    assert.equal(result["request-1"][0].body, "New body");
  });

  it("removes a comment from every request bucket", () => {
    const current = groupCommentsByRequest([
      makeComment({ id: "remove", request_id: "request-1" }),
      makeComment({ id: "keep", request_id: "request-2" }),
    ]);

    const result = removeComment(current, "remove");

    assert.deepEqual(result["request-1"], []);
    assert.deepEqual(result["request-2"].map((comment) => comment.id), ["keep"]);
  });
});
