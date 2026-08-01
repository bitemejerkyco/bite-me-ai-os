export type PublishingQueueStage = "Queued" | "Preparing" | "Publishing" | "Published" | "Retry" | "Failed" | "Cancelled";

export type PublishingQueueItem = {
  id: string;
  draftId: string;
  channel: string;
  stage: PublishingQueueStage;
  retryCount: number;
  maxRetries: number;
  failureReason?: string;
  lastAttemptAt?: string;
};

export type QueueTransitionResult =
  | { ok: true; item: PublishingQueueItem }
  | { ok: false; code: "INVALID_WORKFLOW" | "WORKFLOW_BLOCKED"; message: string };

const TRANSITIONS: Record<PublishingQueueStage, PublishingQueueStage[]> = {
  Queued: ["Preparing", "Cancelled"],
  Preparing: ["Publishing", "Retry", "Failed", "Cancelled"],
  Publishing: ["Published", "Retry", "Failed", "Cancelled"],
  Published: [],
  Retry: ["Preparing", "Publishing", "Failed", "Cancelled"],
  Failed: ["Retry", "Cancelled"],
  Cancelled: [],
};

export function transitionQueueStage(
  item: PublishingQueueItem,
  next: PublishingQueueStage,
  options?: { failureReason?: string },
): QueueTransitionResult {
  if (!TRANSITIONS[item.stage].includes(next)) {
    return {
      ok: false,
      code: "INVALID_WORKFLOW",
      message: `Invalid queue transition from ${item.stage} to ${next}.`,
    };
  }

  if (next === "Retry" && item.retryCount >= item.maxRetries) {
    return {
      ok: false,
      code: "WORKFLOW_BLOCKED",
      message: `Retry limit exceeded for queue item ${item.id}.`,
    };
  }

  const retryCount = next === "Retry" ? item.retryCount + 1 : item.retryCount;
  return {
    ok: true,
    item: {
      ...item,
      stage: next,
      retryCount,
      lastAttemptAt: new Date().toISOString(),
      failureReason: next === "Failed" || next === "Retry" ? options?.failureReason || item.failureReason : undefined,
    },
  };
}
