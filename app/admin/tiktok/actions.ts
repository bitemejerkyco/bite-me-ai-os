"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewerContext } from "@/lib/auth/server";
import { requireSensitiveReason, requireSuperAdminMutationAccess } from "@/features/admin/operation-rules";
import { writeAdminAuditEvent } from "@/features/admin/audit";
import { TikTokPublishJobService } from "@/features/integrations/tiktok/publish-jobs";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function readBoolean(formData: FormData, key: string) {
  return ["true", "on", "1"].includes(String(formData.get(key) || "").toLowerCase());
}

async function requireAdminViewer() {
  const viewer = await getViewerContext();
  requireSuperAdminMutationAccess({
    actorUserId: viewer.userId,
    actorIsSuperAdmin: viewer.isSuperAdmin,
  });
  return viewer;
}

function requireAuditActorUserId(viewer: Awaited<ReturnType<typeof getViewerContext>>) {
  if (!viewer.userId) {
    throw new Error("TIKTOK_ADMIN_UNAUTHENTICATED:Sign in required.");
  }
  return viewer.userId;
}

function returnPath(formData: FormData) {
  return readString(formData, "returnPath") || "/admin/tiktok";
}

export async function updateTikTokWorkspaceBetaAccessAction(formData: FormData) {
  const path = returnPath(formData);
  const viewer = await requireAdminViewer();
  const admin = createAdminClient();
  const workspaceId = readString(formData, "workspaceId");
  const enabled = readBoolean(formData, "enabled");
  const reason = requireSensitiveReason(readString(formData, "reason"));
  if (!workspaceId) {
    throw new Error("TIKTOK_ADMIN_INVALID:Choose a workspace.");
  }
  if (enabled) {
    const { error } = await admin.from("tiktok_beta_allowed_workspaces").upsert({
      workspace_id: workspaceId,
      reason,
      created_by: viewer.userId,
    } as never);
    if (error) throw new Error(`TIKTOK_ADMIN_BETA_WORKSPACE_UPSERT_FAILED:${error.message}`);
  } else {
    const { error } = await admin.from("tiktok_beta_allowed_workspaces").delete().eq("workspace_id", workspaceId);
    if (error) throw new Error(`TIKTOK_ADMIN_BETA_WORKSPACE_DELETE_FAILED:${error.message}`);
  }
    const actorUserId = requireAuditActorUserId(viewer);
  await writeAdminAuditEvent({
      actorUserId,
    targetAccountId: workspaceId,
    action: enabled ? "tiktok_beta_workspace_access_enabled" : "tiktok_beta_workspace_access_disabled",
    resourceType: "tiktok_beta_allowed_workspace",
    resourceId: workspaceId,
    reason,
    newValue: { enabled },
  });
  revalidatePath(path);
}

export async function updateTikTokUserBetaAccessAction(formData: FormData) {
  const path = returnPath(formData);
  const viewer = await requireAdminViewer();
  const admin = createAdminClient();
  const userId = readString(formData, "userId");
  const enabled = readBoolean(formData, "enabled");
  const reason = requireSensitiveReason(readString(formData, "reason"));
  if (!userId) {
    throw new Error("TIKTOK_ADMIN_INVALID:Choose a user.");
  }
  if (enabled) {
    const { error } = await admin.from("tiktok_beta_allowed_users").upsert({
      user_id: userId,
      reason,
      created_by: viewer.userId,
    } as never);
    if (error) throw new Error(`TIKTOK_ADMIN_BETA_USER_UPSERT_FAILED:${error.message}`);
  } else {
    const { error } = await admin.from("tiktok_beta_allowed_users").delete().eq("user_id", userId);
    if (error) throw new Error(`TIKTOK_ADMIN_BETA_USER_DELETE_FAILED:${error.message}`);
  }
    const actorUserId = requireAuditActorUserId(viewer);
  await writeAdminAuditEvent({
      actorUserId,
    targetAccountId: null,
    action: enabled ? "tiktok_beta_user_access_enabled" : "tiktok_beta_user_access_disabled",
    resourceType: "tiktok_beta_allowed_user",
    resourceId: userId,
    reason,
    newValue: { enabled },
  });
  revalidatePath(path);
}

export async function forceTikTokReconnectRequiredAction(formData: FormData) {
  const path = returnPath(formData);
  const viewer = await requireAdminViewer();
  const admin = createAdminClient();
  const connectionId = readString(formData, "connectionId");
  const reason = requireSensitiveReason(readString(formData, "reason"));
  if (!connectionId) {
    throw new Error("TIKTOK_ADMIN_INVALID:Choose a connection.");
  }
  const { error } = await admin
    .from("tiktok_connections")
    .update({ status: "RECONNECT_REQUIRED", last_error: reason } as never)
    .eq("id", connectionId);
  if (error) throw new Error(`TIKTOK_ADMIN_RECONNECT_FAILED:${error.message}`);
  const actorUserId = requireAuditActorUserId(viewer);
  await writeAdminAuditEvent({
    actorUserId,
    action: "tiktok_connection_force_reconnect",
    resourceType: "tiktok_connection",
    resourceId: connectionId,
    reason,
    newValue: { status: "RECONNECT_REQUIRED" },
  });
  revalidatePath(path);
}

export async function cancelTikTokLocalPendingJobAction(formData: FormData) {
  const path = returnPath(formData);
  const viewer = await requireAdminViewer();
  const admin = createAdminClient();
  const jobId = readString(formData, "jobId");
  const reason = requireSensitiveReason(readString(formData, "reason"));
  if (!jobId) {
    throw new Error("TIKTOK_ADMIN_INVALID:Choose a job.");
  }
  const { error } = await admin
    .from("tiktok_publish_jobs")
    .update({ status: "cancelled" } as never)
    .eq("id", jobId)
    .in("status", ["draft", "validating", "initializing", "uploading", "processing", "reconnect_required"]);
  if (error) throw new Error(`TIKTOK_ADMIN_CANCEL_FAILED:${error.message}`);
  const actorUserId = requireAuditActorUserId(viewer);
  await writeAdminAuditEvent({
    actorUserId,
    action: "tiktok_publish_job_cancelled",
    resourceType: "tiktok_publish_job",
    resourceId: jobId,
    reason,
    newValue: { status: "cancelled" },
  });
  revalidatePath(path);
}

export async function retryTikTokSafeStatusCheckAction(formData: FormData) {
  const path = returnPath(formData);
  const viewer = await requireAdminViewer();
  const admin = createAdminClient();
  const workspaceId = readString(formData, "workspaceId");
  const jobId = readString(formData, "jobId");
  const reason = requireSensitiveReason(readString(formData, "reason"));
  if (!workspaceId || !jobId) {
    throw new Error("TIKTOK_ADMIN_INVALID:Choose a workspace and job.");
  }
  const actor = {
    supabase: admin,
    userId: viewer.userId,
    workspaceId,
  };
  await new TikTokPublishJobService().retryTikTokStatusCheck(actor as never, jobId);
  const actorUserId = requireAuditActorUserId(viewer);
  await writeAdminAuditEvent({
    actorUserId,
    targetAccountId: workspaceId,
    action: "tiktok_publish_job_status_retry",
    resourceType: "tiktok_publish_job",
    resourceId: jobId,
    reason,
    newValue: { retried: true },
  });
  revalidatePath(path);
}