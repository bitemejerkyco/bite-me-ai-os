import { describe, expect, it } from "vitest";
import { transitionQueueStage } from "@/features/marketing-director/publishing-queue";

describe("publishing-queue", () => {
  it("supports queued to preparing transition", () => {
    const result = transitionQueueStage(
      {
        id: "q1",
        draftId: "d1",
        channel: "tiktok",
        stage: "Queued",
        retryCount: 0,
        maxRetries: 2,
      },
      "Preparing",
    );

    expect(result.ok).toBe(true);
  });

  it("blocks retries beyond max limit", () => {
    const result = transitionQueueStage(
      {
        id: "q2",
        draftId: "d2",
        channel: "tiktok",
        stage: "Failed",
        retryCount: 2,
        maxRetries: 2,
      },
      "Retry",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("WORKFLOW_BLOCKED");
  });
});
