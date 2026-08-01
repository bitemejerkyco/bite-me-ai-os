import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyIntegrationError } from "@/features/integrations/core/errors";
import type { IntegrationProviderId } from "@/features/integrations/core/registry";

export type IntegrationJobType =
  | "TOKEN_REFRESH"
  | "HEALTH_CHECK"
  | "DATA_SYNC"
  | "PUBLISH_CONTENT"
  | "CHECK_PUBLISH_STATUS"
  | "FETCH_ANALYTICS"
  | "PROCESS_WEBHOOK"
  | "RETRY_FAILED_OPERATION";

export type QueueIntegrationJobInput = {
  workspaceId: string;
  provider: IntegrationProviderId;
  type: IntegrationJobType;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  maxAttempts?: number;
  priority?: number;
  createdBy?: string | null;
  workflowId?: string | null;
};

const RETRYABLE_STATUSES = new Set(["QUEUED", "CLAIMED", "RUNNING", "RETRY_WAIT"]);

function jitterMs(baseMs: number): number {
  const spread = Math.max(1, Math.floor(baseMs * 0.2));
  const delta = Math.floor(Math.random() * spread);
  return baseMs + delta;
}

function nextBackoffMilliseconds(attempt: number): number {
  const boundedAttempt = Math.max(1, Math.min(10, attempt));
  const baseMs = Math.min(10 * 60_000, 2 ** boundedAttempt * 1000);
  return jitterMs(baseMs);
}

export async function queueIntegrationJob(input: QueueIntegrationJobInput): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integration_jobs")
    .upsert(
      {
        workspace_id: input.workspaceId,
        provider: input.provider,
        job_type: input.type,
        payload: input.payload,
        status: "QUEUED",
        idempotency_key: input.idempotencyKey,
        max_attempts: Math.max(1, Math.min(20, input.maxAttempts || 5)),
        priority: Math.max(1, Math.min(100, input.priority || 50)),
        created_by: input.createdBy || null,
        workflow_id: input.workflowId || null,
      } as never,
      { onConflict: "workspace_id,idempotency_key" },
    )
    .select("id")
    .single();
  const row = data as { id?: string | null } | null;

  if (error || !row?.id) {
    throw new Error(`INTEGRATION_JOB_QUEUE_FAILED:${error?.message || "Unable to queue job."}`);
  }

  return String(row.id);
}

export async function scheduleIntegrationJobRetry(input: {
  jobId: string;
  attempt: number;
  error: unknown;
}): Promise<void> {
  const admin = createAdminClient();
  const classified = classifyIntegrationError(input.error);
  const backoffMs = classified.retryAfterSeconds
    ? classified.retryAfterSeconds * 1000
    : nextBackoffMilliseconds(input.attempt);
  const nextAttemptAt = new Date(Date.now() + backoffMs).toISOString();

  const nextStatus = classified.retryable ? "RETRY_WAIT" : "FAILED";

  const { error } = await admin
    .from("integration_jobs")
    .update(
      {
        status: nextStatus,
        next_attempt_at: nextAttemptAt,
        attempt_count: input.attempt,
        last_error_code: classified.code,
        last_error_message: classified.message,
        locked_at: null,
        lock_expires_at: null,
        locked_by: null,
      } as never,
    )
    .eq("id", input.jobId)
    .in("status", Array.from(RETRYABLE_STATUSES));

  if (error) {
    throw new Error(`INTEGRATION_JOB_RETRY_FAILED:${error.message}`);
  }
}

export async function markIntegrationJobCompleted(input: {
  jobId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("integration_jobs")
    .update(
      {
        status: "COMPLETED",
        completed_at: new Date().toISOString(),
        locked_at: null,
        lock_expires_at: null,
        locked_by: null,
        metadata: input.metadata || {},
      } as never,
    )
    .eq("id", input.jobId)
    .in("status", ["CLAIMED", "RUNNING", "RETRY_WAIT"]);

  if (error) {
    throw new Error(`INTEGRATION_JOB_COMPLETE_FAILED:${error.message}`);
  }
}

export async function writeIntegrationEvent(input: {
  workspaceId: string | null;
  provider: IntegrationProviderId;
  operation: string;
  status: string;
  severity?: "debug" | "info" | "warning" | "error" | "critical";
  message: string;
  errorCode?: string | null;
  jobId?: string | null;
  workflowId?: string | null;
  userId?: string | null;
  attempt?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const admin = createAdminClient();
  const eventId = randomUUID();
  const { data, error } = await admin
    .from("integration_events")
    .insert(
      {
        event_id: eventId,
        workspace_id: input.workspaceId,
        provider: input.provider,
        operation: input.operation,
        status: input.status,
        severity: input.severity || "info",
        sanitized_message: input.message,
        error_code: input.errorCode || null,
        job_id: input.jobId || null,
        workflow_id: input.workflowId || null,
        user_id: input.userId || null,
        attempt: input.attempt ?? null,
        duration_ms: input.durationMs ?? null,
        metadata: input.metadata || {},
      } as never,
    )
    .select("id")
    .single();
  const row = data as { id?: string | null } | null;

  if (error || !row?.id) {
    throw new Error(`INTEGRATION_EVENT_WRITE_FAILED:${error?.message || "Unable to persist event."}`);
  }

  return String(row.id);
}
