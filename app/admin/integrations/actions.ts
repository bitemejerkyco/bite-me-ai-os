"use server";

import { revalidatePath } from "next/cache";
import { getViewerContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAdminAuditEvent } from "@/features/admin/audit";
import { requireSensitiveReason, requireSuperAdminMutationAccess } from "@/features/admin/operation-rules";
import { writeIntegrationEvent } from "@/features/integrations/core/jobs";
import type { IntegrationProviderId } from "@/features/integrations/core/registry";

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) || "").trim();
}

function readBoolean(formData: FormData, key: string): boolean {
  return ["1", "true", "on"].includes(String(formData.get(key) || "").trim().toLowerCase());
}

async function requireAdminViewer(): Promise<{
  userId: string;
  isSuperAdmin: boolean;
}> {
  const viewer = await getViewerContext();
  requireSuperAdminMutationAccess({
    actorUserId: viewer.userId,
    actorIsSuperAdmin: viewer.isSuperAdmin,
  });
  if (!viewer.userId) {
    throw new Error("ADMIN_UNAUTHENTICATED:Sign in required.");
  }
  return {
    userId: viewer.userId,
    isSuperAdmin: viewer.isSuperAdmin,
  };
}

export async function updateIntegrationProviderControlsAction(formData: FormData): Promise<void> {
  const viewer = await requireAdminViewer();
  const reason = requireSensitiveReason(readString(formData, "reason"));
  const provider = readString(formData, "provider") as IntegrationProviderId;
  if (!provider) {
    throw new Error("INTEGRATION_PROVIDER_REQUIRED:Provider is required.");
  }

  const nextValue = {
    globally_enabled: readBoolean(formData, "globallyEnabled"),
    oauth_enabled: readBoolean(formData, "oauthEnabled"),
    publishing_enabled: readBoolean(formData, "publishingEnabled"),
    analytics_enabled: readBoolean(formData, "analyticsEnabled"),
    webhooks_enabled: readBoolean(formData, "webhooksEnabled"),
    background_sync_enabled: readBoolean(formData, "backgroundSyncEnabled"),
    maintenance_mode: readBoolean(formData, "maintenanceMode"),
    updated_by: viewer.userId,
  };

  const admin = createAdminClient();
  const previous = await admin
    .from("integration_provider_settings")
    .select("provider,globally_enabled,oauth_enabled,publishing_enabled,analytics_enabled,webhooks_enabled,background_sync_enabled,maintenance_mode")
    .eq("provider", provider)
    .maybeSingle();

  const { error } = await admin
    .from("integration_provider_settings")
    .upsert({ provider, ...nextValue } as never, { onConflict: "provider" });

  if (error) {
    throw new Error(`INTEGRATION_PROVIDER_CONTROLS_UPDATE_FAILED:${error.message}`);
  }

  await writeAdminAuditEvent({
    actorUserId: viewer.userId,
    targetAccountId: null,
    action: "integration_provider_controls_updated",
    resourceType: "integration_provider_settings",
    resourceId: provider,
    previousValue: previous.data || null,
    newValue: nextValue,
    reason,
  });

  await writeIntegrationEvent({
    workspaceId: null,
    provider,
    operation: "provider_controls_update",
    status: "completed",
    severity: "info",
    message: `Integration provider controls updated for ${provider}.`,
    userId: viewer.userId,
    metadata: { reason },
  });

  revalidatePath("/admin/integrations");
  revalidatePath("/integrations");
}

export async function retryIntegrationJobAction(formData: FormData): Promise<void> {
  const viewer = await requireAdminViewer();
  const reason = requireSensitiveReason(readString(formData, "reason"));
  const jobId = readString(formData, "jobId");
  if (!jobId) {
    throw new Error("INTEGRATION_JOB_REQUIRED:jobId is required.");
  }

  const admin = createAdminClient();
  const { data: jobRow, error: jobLookupError } = await admin
    .from("integration_jobs")
    .select("id,workspace_id,provider,status,max_attempts")
    .eq("id", jobId)
    .maybeSingle();
  if (jobLookupError || !jobRow) {
    throw new Error(`INTEGRATION_JOB_LOOKUP_FAILED:${jobLookupError?.message || "Job not found."}`);
  }

  const { error } = await admin
    .from("integration_jobs")
    .update(
      {
        status: "QUEUED",
        next_attempt_at: new Date().toISOString(),
        last_error_code: null,
        last_error_message: null,
        locked_at: null,
        lock_expires_at: null,
        locked_by: null,
      } as never,
    )
    .eq("id", jobId)
    .in("status", ["FAILED", "DEAD_LETTER", "RETRY_WAIT"]);

  if (error) {
    throw new Error(`INTEGRATION_JOB_RETRY_FAILED:${error.message}`);
  }

  await writeAdminAuditEvent({
    actorUserId: viewer.userId,
    targetAccountId: String((jobRow as { workspace_id?: string | null }).workspace_id || "") || null,
    action: "integration_job_requeued",
    resourceType: "integration_job",
    resourceId: jobId,
    newValue: { status: "QUEUED" },
    reason,
  });

  await writeIntegrationEvent({
    workspaceId: String((jobRow as { workspace_id?: string | null }).workspace_id || "") || null,
    provider: String((jobRow as { provider?: string | null }).provider || "") as IntegrationProviderId,
    operation: "admin_retry_job",
    status: "queued",
    severity: "warning",
    message: `Integration job ${jobId} requeued by admin action.`,
    userId: viewer.userId,
    metadata: { reason },
  });

  revalidatePath("/admin/integrations");
}
