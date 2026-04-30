export type SupportRequestStatus = "open" | "in_progress" | "resolved" | "closed";

export type SupportRequest = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: SupportRequestStatus;
  priority: string;
  created_at: string;
};

export type SupportRequestComment = {
  id: string;
  request_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
};

export type PostgresChangePayload<T> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T;
  old: Partial<T> & { id?: string };
};

export function sortRequests(requests: SupportRequest[]) {
  return [...requests].sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
}

export function upsertRequest(
  requests: SupportRequest[],
  nextRequest: SupportRequest,
) {
  const withoutCurrent = requests.filter((request) => request.id !== nextRequest.id);
  return sortRequests([nextRequest, ...withoutCurrent]);
}

export function removeRequest(requests: SupportRequest[], requestId: string) {
  return requests.filter((request) => request.id !== requestId);
}

export function groupCommentsByRequest(comments: SupportRequestComment[]) {
  return comments.reduce<Record<string, SupportRequestComment[]>>((acc, comment) => {
    acc[comment.request_id] = [...(acc[comment.request_id] ?? []), comment].sort(
      (left, right) => left.created_at.localeCompare(right.created_at),
    );
    return acc;
  }, {});
}

export function upsertComment(
  commentsByRequest: Record<string, SupportRequestComment[]>,
  nextComment: SupportRequestComment,
) {
  const currentComments = commentsByRequest[nextComment.request_id] ?? [];
  const nextComments = [
    ...currentComments.filter((comment) => comment.id !== nextComment.id),
    nextComment,
  ].sort((left, right) => left.created_at.localeCompare(right.created_at));

  return {
    ...commentsByRequest,
    [nextComment.request_id]: nextComments,
  };
}

export function removeComment(
  commentsByRequest: Record<string, SupportRequestComment[]>,
  commentId: string,
) {
  const nextEntries = Object.entries(commentsByRequest).map(([requestId, comments]) => [
    requestId,
    comments.filter((comment) => comment.id !== commentId),
  ]);

  return Object.fromEntries(nextEntries) as Record<string, SupportRequestComment[]>;
}