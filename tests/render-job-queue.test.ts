import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { InMemoryRenderJobQueue, resetRenderJobQueue } from "@/features/core/render-job-queue";

vi.mock("server-only", () => ({}));

beforeEach(() => {
  resetRenderJobQueue();
});

describe("render job queue", () => {
  it("keeps idempotency by workflow key", async () => {
    const queue = new InMemoryRenderJobQueue();
    const first = await queue.createJob({
      workspaceId: "workspace-1",
      projectId: "project-1",
      workflowKey: "wf-1",
      prompt: "Prompt",
      durationSeconds: 12,
      qualityTier: "ECONOMY",
      provider: "INTERNAL",
    });
    const second = await queue.createJob({
      workspaceId: "workspace-1",
      projectId: "project-1",
      workflowKey: "wf-1",
      prompt: "Prompt",
      durationSeconds: 12,
      qualityTier: "ECONOMY",
      provider: "INTERNAL",
    });
    expect(second.id).toBe(first.id);
  });

  it("supports claim, progress, complete, fail and retry lifecycle", async () => {
    const queue = new InMemoryRenderJobQueue();
    const created = await queue.createJob({
      workspaceId: "workspace-1",
      projectId: "project-2",
      workflowKey: "wf-2",
      prompt: "Prompt",
      durationSeconds: 12,
      qualityTier: "BALANCED",
      provider: "INTERNAL",
    });

    const claimed = await queue.claimJob("worker-1");
    expect(claimed?.id).toBe(created.id);

    const inProgress = await queue.updateProgress({
      jobId: created.id,
      status: "in_progress",
      progressPercent: 56,
    });
    expect(inProgress.progressPercent).toBe(56);

    const retried = await queue.retryJob({ jobId: created.id, reason: "provider timeout" });
    expect(retried.attempt).toBe(2);
    expect(retried.status).toBe("retrying");

    const failed = await queue.failJob({
      jobId: created.id,
      failureCode: "TEMP_ERROR",
      failureReason: "temporary",
    });
    expect(failed.status).toBe("failed");

    const completed = await queue.completeJob({ jobId: created.id, outputUrl: "https://example.com/video.mp4" });
    expect(completed.status).toBe("completed");
    expect(completed.outputUrl).toContain("video.mp4");
  });

  it("does not leak jobs across workspace when keyed differently", async () => {
    const queue = new InMemoryRenderJobQueue();
    const a = await queue.createJob({
      workspaceId: "workspace-1",
      projectId: "project-a",
      workflowKey: "wf-a",
      prompt: "A",
      durationSeconds: 10,
      qualityTier: "ECONOMY",
      provider: "INTERNAL",
    });
    const b = await queue.createJob({
      workspaceId: "workspace-2",
      projectId: "project-b",
      workflowKey: "wf-b",
      prompt: "B",
      durationSeconds: 10,
      qualityTier: "ECONOMY",
      provider: "INTERNAL",
    });
    expect(a.id).not.toBe(b.id);
  });
});
