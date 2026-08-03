import { describe, expect, it } from "vitest";
import {
  createPendingVideoProject,
  isDatabaseUuid,
  markPendingWorkflowFailed,
  removePendingVideoProjects,
  resolveRetryProjectId,
  shouldPollVideoWorkflow,
} from "@/components/core/VideoStudio";
import type { VideoProject } from "@/features/core/video-project";

function makeProject(overrides: Partial<VideoProject> = {}): VideoProject {
  const now = new Date().toISOString();
  return {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Project",
    channel: "TikTok",
    objective: "Engagement",
    prompt: "Prompt",
    script: "Script",
    caption: "Caption",
    hashtags: [],
    callToAction: "Shop now",
    scenes: [],
    durationSeconds: 8,
    aspectRatio: "9:16",
    voice: "marin",
    voiceDisclosure: true,
    musicMode: "NONE",
    provider: "OPENAI_SORA_TEMPORARY",
    status: "GENERATING",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("video workflow UI state helpers", () => {
  it("detects database UUIDs and rejects pending client IDs", () => {
    expect(isDatabaseUuid("00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isDatabaseUuid("pending-1234")).toBe(false);
    expect(isDatabaseUuid(123)).toBe(false);
  });

  it("does not poll pending workflow IDs or retry them directly", () => {
    const pending = createPendingVideoProject({
      project: null,
      channel: "TikTok",
      objective: "Engagement",
      message: "Show product",
      callToAction: "Shop now",
      duration: 8,
      voice: "marin",
      musicMode: "NONE",
      workflowKey: "wf-pending",
    });

    expect(shouldPollVideoWorkflow(pending)).toBe(false);
    expect(resolveRetryProjectId(pending, true)).toBeUndefined();
    expect(shouldPollVideoWorkflow(makeProject())).toBe(true);
  });

  it("marks a pending workflow failed without keeping it pollable", () => {
    const pending = createPendingVideoProject({
      project: null,
      channel: "TikTok",
      objective: "Engagement",
      message: "Show product",
      callToAction: "Shop now",
      duration: 8,
      voice: "marin",
      musicMode: "NONE",
      workflowKey: "wf-pending",
    });

    const failed = markPendingWorkflowFailed({
      project: pending,
      errorMessage: "REPLICATE_RATE_LIMITED",
    });

    expect(failed.status).toBe("FAILED");
    expect(failed.workflowStage).toBe("FAILED");
    expect(failed.failureReason).toBe("REPLICATE_RATE_LIMITED");
    expect(shouldPollVideoWorkflow(failed)).toBe(false);
  });

  it("drops pending projects when the server project arrives", () => {
    const pending = createPendingVideoProject({
      project: null,
      channel: "TikTok",
      objective: "Engagement",
      message: "Show product",
      callToAction: "Shop now",
      duration: 8,
      voice: "marin",
      musicMode: "NONE",
      workflowKey: "wf-pending",
    });
    const serverProject = makeProject({ id: "11111111-1111-4111-8111-111111111111" });

    const visible = removePendingVideoProjects([pending, serverProject]);

    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe(serverProject.id);
  });
});
