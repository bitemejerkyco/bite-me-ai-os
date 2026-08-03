import "server-only";

import { randomUUID } from "node:crypto";
import type {
  CreateRenderJobInput,
  RenderJobRecord,
  RendererProgressEvent,
  VideoRendererQueue,
} from "@/features/core/video-renderer-contract";

type QueueState = {
  jobs: Map<string, RenderJobRecord>;
  byWorkflowKey: Map<string, string>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function getQueueState(): QueueState {
  const globalState = globalThis as typeof globalThis & {
    __postmotiveRenderQueue?: QueueState;
  };
  if (!globalState.__postmotiveRenderQueue) {
    globalState.__postmotiveRenderQueue = {
      jobs: new Map(),
      byWorkflowKey: new Map(),
    };
  }
  return globalState.__postmotiveRenderQueue;
}

export function resetRenderJobQueue(): void {
  const state = getQueueState();
  state.jobs.clear();
  state.byWorkflowKey.clear();
}

export class InMemoryRenderJobQueue implements VideoRendererQueue {
  async createJob(input: CreateRenderJobInput): Promise<RenderJobRecord> {
    const state = getQueueState();
    const existingId = state.byWorkflowKey.get(input.workflowKey);
    if (existingId) {
      const existing = state.jobs.get(existingId);
      if (existing) return existing;
    }

    const record: RenderJobRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      workflowKey: input.workflowKey,
      provider: input.provider,
      status: "queued",
      attempt: 1,
      progressPercent: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    state.jobs.set(record.id, record);
    state.byWorkflowKey.set(input.workflowKey, record.id);
    return record;
  }

  async claimJob(workerId: string): Promise<RenderJobRecord | null> {
    const state = getQueueState();
    const queued = [...state.jobs.values()].find((job) => job.status === "queued");
    if (!queued) return null;
    const claimed: RenderJobRecord = {
      ...queued,
      status: "claimed",
      updatedAt: nowIso(),
      failureReason: undefined,
      failureCode: undefined,
      providerJobId: queued.providerJobId || workerId,
    };
    state.jobs.set(claimed.id, claimed);
    return claimed;
  }

  async updateProgress(event: RendererProgressEvent): Promise<RenderJobRecord> {
    const state = getQueueState();
    const current = state.jobs.get(event.jobId);
    if (!current) throw new Error("RENDER_JOB_NOT_FOUND");
    const next: RenderJobRecord = {
      ...current,
      status: event.status,
      progressPercent: Math.max(0, Math.min(100, Math.round(event.progressPercent))),
      providerJobId: event.providerJobId || current.providerJobId,
      failureCode: event.failureCode,
      failureReason: event.failureReason,
      outputUrl: event.outputUrl || current.outputUrl,
      updatedAt: nowIso(),
    };
    state.jobs.set(next.id, next);
    return next;
  }

  async completeJob(input: { jobId: string; outputUrl: string }): Promise<RenderJobRecord> {
    return this.updateProgress({
      jobId: input.jobId,
      status: "completed",
      progressPercent: 100,
      outputUrl: input.outputUrl,
    });
  }

  async failJob(input: { jobId: string; failureCode: string; failureReason: string }): Promise<RenderJobRecord> {
    return this.updateProgress({
      jobId: input.jobId,
      status: "failed",
      progressPercent: 0,
      failureCode: input.failureCode,
      failureReason: input.failureReason,
    });
  }

  async retryJob(input: { jobId: string; reason: string }): Promise<RenderJobRecord> {
    const state = getQueueState();
    const current = state.jobs.get(input.jobId);
    if (!current) throw new Error("RENDER_JOB_NOT_FOUND");
    const next: RenderJobRecord = {
      ...current,
      status: "retrying",
      attempt: current.attempt + 1,
      failureReason: input.reason,
      updatedAt: nowIso(),
    };
    state.jobs.set(next.id, next);
    return next;
  }
}

export const renderJobQueue = new InMemoryRenderJobQueue();
