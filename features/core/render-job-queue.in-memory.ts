import { randomUUID } from "node:crypto";
import type {
  CreateRenderJobInput,
  RenderJobRecord,
  RendererProgressEvent,
  VideoRendererQueue,
} from "@/features/core/video-renderer-contract";

function nowIso(): string {
  return new Date().toISOString();
}

export class InMemoryRenderJobQueue implements VideoRendererQueue {
  private jobs = new Map<string, RenderJobRecord>();
  private byWorkflowKey = new Map<string, string>();

  reset(): void {
    this.jobs.clear();
    this.byWorkflowKey.clear();
  }

  async createJob(input: CreateRenderJobInput): Promise<RenderJobRecord> {
    const existingId = this.byWorkflowKey.get(`${input.workspaceId}:${input.workflowKey}`);
    if (existingId) {
      const existing = this.jobs.get(existingId);
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

    this.jobs.set(record.id, record);
    this.byWorkflowKey.set(`${input.workspaceId}:${input.workflowKey}`, record.id);
    return record;
  }

  async claimJob(input: { workspaceId: string; workerId: string }): Promise<RenderJobRecord | null> {
    const queued = [...this.jobs.values()].find((job) => job.workspaceId === input.workspaceId && job.status === "queued");
    if (!queued) return null;
    const claimed: RenderJobRecord = {
      ...queued,
      status: "claimed",
      updatedAt: nowIso(),
      failureReason: undefined,
      failureCode: undefined,
      providerJobId: queued.providerJobId || input.workerId,
    };
    this.jobs.set(claimed.id, claimed);
    return claimed;
  }

  async updateProgress(event: RendererProgressEvent): Promise<RenderJobRecord> {
    const current = this.jobs.get(event.jobId);
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
    this.jobs.set(next.id, next);
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
    const current = this.jobs.get(input.jobId);
    if (!current) throw new Error("RENDER_JOB_NOT_FOUND");
    const next: RenderJobRecord = {
      ...current,
      status: "retrying",
      attempt: current.attempt + 1,
      failureReason: input.reason,
      updatedAt: nowIso(),
    };
    this.jobs.set(next.id, next);
    return next;
  }
}
