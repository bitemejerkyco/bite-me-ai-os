import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CreateRenderJobInput,
  RenderJobRecord,
  RendererProgressEvent,
  VideoRendererQueue,
} from "@/features/core/video-renderer-contract";

type RenderJobRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  workflow_key: string;
  provider: string;
  status: string;
  attempt: number;
  progress_percent: number;
  provider_job_id: string | null;
  output_url: string | null;
  failure_code: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

function toRecord(row: RenderJobRow): RenderJobRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    workflowKey: row.workflow_key,
    provider: row.provider as RenderJobRecord["provider"],
    status: row.status as RenderJobRecord["status"],
    attempt: Number(row.attempt || 1),
    progressPercent: Number(row.progress_percent || 0),
    providerJobId: row.provider_job_id || undefined,
    outputUrl: row.output_url || undefined,
    failureCode: row.failure_code || undefined,
    failureReason: row.failure_reason || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadJobById(jobId: string): Promise<RenderJobRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("video_render_jobs")
    .select("id,workspace_id,project_id,workflow_key,provider,status,attempt,progress_percent,provider_job_id,output_url,failure_code,failure_reason,created_at,updated_at")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("RENDER_JOB_NOT_FOUND");
  }

  return data as RenderJobRow;
}

export class SupabaseRenderJobQueue implements VideoRendererQueue {
  async createJob(input: CreateRenderJobInput): Promise<RenderJobRecord> {
    const admin = createAdminClient();

    const { data: existing, error: existingError } = await admin
      .from("video_render_jobs")
      .select("id,workspace_id,project_id,workflow_key,provider,status,attempt,progress_percent,provider_job_id,output_url,failure_code,failure_reason,created_at,updated_at")
      .eq("workspace_id", input.workspaceId)
      .eq("workflow_key", input.workflowKey)
      .maybeSingle();

    if (existingError) {
      throw new Error(`RENDER_JOB_LOOKUP_FAILED:${existingError.message}`);
    }

    if (existing) {
      return toRecord(existing as RenderJobRow);
    }

    const { data: created, error: insertError } = await admin
      .from("video_render_jobs")
      .insert({
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        workflow_key: input.workflowKey,
        provider: input.provider,
        status: "queued",
        attempt: 1,
        progress_percent: 0,
      } as never)
      .select("id,workspace_id,project_id,workflow_key,provider,status,attempt,progress_percent,provider_job_id,output_url,failure_code,failure_reason,created_at,updated_at")
      .single();

    if (insertError || !created) {
      throw new Error(`RENDER_JOB_CREATE_FAILED:${insertError?.message || "unknown"}`);
    }

    return toRecord(created as RenderJobRow);
  }

  async claimJob(input: { workspaceId: string; workerId: string }): Promise<RenderJobRecord | null> {
    const admin = createAdminClient();
    const { data: queued, error: queuedError } = await admin
      .from("video_render_jobs")
      .select("id,workspace_id,project_id,workflow_key,provider,status,attempt,progress_percent,provider_job_id,output_url,failure_code,failure_reason,created_at,updated_at")
      .eq("workspace_id", input.workspaceId)
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (queuedError) {
      throw new Error(`RENDER_JOB_CLAIM_LOOKUP_FAILED:${queuedError.message}`);
    }

    if (!queued) return null;

    const { data: claimed, error: claimError } = await admin
      .from("video_render_jobs")
      .update({
        status: "claimed",
        provider_job_id: (queued as RenderJobRow).provider_job_id || input.workerId,
        failure_code: null,
        failure_reason: null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", (queued as RenderJobRow).id)
      .eq("status", "queued")
      .select("id,workspace_id,project_id,workflow_key,provider,status,attempt,progress_percent,provider_job_id,output_url,failure_code,failure_reason,created_at,updated_at")
      .maybeSingle();

    if (claimError || !claimed) {
      return null;
    }

    return toRecord(claimed as RenderJobRow);
  }

  async updateProgress(event: RendererProgressEvent): Promise<RenderJobRecord> {
    const current = await loadJobById(event.jobId);
    const admin = createAdminClient();

    const { data: updated, error: updateError } = await admin
      .from("video_render_jobs")
      .update({
        status: event.status,
        progress_percent: Math.max(0, Math.min(100, Math.round(event.progressPercent))),
        provider_job_id: event.providerJobId || current.provider_job_id,
        output_url: event.outputUrl || current.output_url,
        failure_code: event.failureCode || null,
        failure_reason: event.failureReason || null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", event.jobId)
      .select("id,workspace_id,project_id,workflow_key,provider,status,attempt,progress_percent,provider_job_id,output_url,failure_code,failure_reason,created_at,updated_at")
      .single();

    if (updateError || !updated) {
      throw new Error(`RENDER_JOB_UPDATE_FAILED:${updateError?.message || "unknown"}`);
    }

    return toRecord(updated as RenderJobRow);
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
    const current = await loadJobById(input.jobId);
    const admin = createAdminClient();

    const { data: retried, error: retryError } = await admin
      .from("video_render_jobs")
      .update({
        status: "retrying",
        attempt: Number(current.attempt || 1) + 1,
        progress_percent: 0,
        failure_code: null,
        failure_reason: input.reason,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", input.jobId)
      .select("id,workspace_id,project_id,workflow_key,provider,status,attempt,progress_percent,provider_job_id,output_url,failure_code,failure_reason,created_at,updated_at")
      .single();

    if (retryError || !retried) {
      throw new Error(`RENDER_JOB_RETRY_FAILED:${retryError?.message || "unknown"}`);
    }

    return toRecord(retried as RenderJobRow);
  }
}

export const renderJobQueue = new SupabaseRenderJobQueue();
