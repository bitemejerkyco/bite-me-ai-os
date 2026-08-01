import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const EXECUTION_ERROR_CODES = {
  INVALID_WORKFLOW: "INVALID_WORKFLOW",
  APPROVAL_REQUIRED: "APPROVAL_REQUIRED",
  MODE_RESTRICTED: "MODE_RESTRICTED",
  ENTITLEMENT_REQUIRED: "ENTITLEMENT_REQUIRED",
  INTEGRATION_NOT_CONNECTED: "INTEGRATION_NOT_CONNECTED",
  WORKFLOW_BLOCKED: "WORKFLOW_BLOCKED",
} as const;

export type ExecutionErrorCode = (typeof EXECUTION_ERROR_CODES)[keyof typeof EXECUTION_ERROR_CODES];

export type AutonomyLevel = 1 | 2 | 3 | 4 | 5;

export type PublishingQueueStatus =
  | "Queued"
  | "Preparing"
  | "Publishing"
  | "Published"
  | "Retry"
  | "Failed"
  | "Cancelled";

export type WorkflowSummary = {
  total: number;
  inProgress: number;
  blocked: number;
  awaitingApproval: number;
  publishing: number;
  completed: number;
  failed: number;
  cancelled: number;
};

export type ApprovalSummary = {
  pending: number;
  approved: number;
  rejected: number;
  editRequested: number;
};

export type PublishingQueueSummary = {
  queued: number;
  preparing: number;
  publishing: number;
  published: number;
  retry: number;
  failed: number;
  cancelled: number;
};

export type NotificationPreferenceMap = {
  approvalRequired: boolean;
  publishingFailed: boolean;
  campaignCompleted: boolean;
  analyticsAvailable: boolean;
  majorOpportunity: boolean;
  majorRisk: boolean;
  emailEnabled: boolean;
};

export type ExecutionEventWrite = {
  workspaceId: string;
  workflowId?: string | null;
  stepId?: string | null;
  approvalItemId?: string | null;
  eventType: string;
  status: string;
  actorUserId?: string | null;
  agent?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
};

function normalizeAutonomyLevel(value: unknown): AutonomyLevel {
  const parsed = Number(value || 3);
  if (!Number.isFinite(parsed)) return 3;
  if (parsed <= 1) return 1;
  if (parsed >= 5) return 5;
  return Math.round(parsed) as AutonomyLevel;
}

function ratingFromRatio(value: number): "healthy" | "warning" | "critical" {
  if (value >= 0.8) return "healthy";
  if (value >= 0.5) return "warning";
  return "critical";
}

export async function recordExecutionEvent(input: ExecutionEventWrite): Promise<void> {
  const admin = createAdminClient();
  await admin.from("marketing_execution_events").insert({
    workspace_id: input.workspaceId,
    workflow_id: input.workflowId || null,
    step_id: input.stepId || null,
    approval_item_id: input.approvalItemId || null,
    event_type: input.eventType,
    status: input.status,
    actor_user_id: input.actorUserId || null,
    agent: input.agent || null,
    message: input.message,
    metadata: input.metadata || {},
  } as never);
}

export async function loadExecutionOperationalSnapshot(workspaceId: string): Promise<{
  autonomyLevel: AutonomyLevel;
  workflowSummary: WorkflowSummary;
  approvalSummary: ApprovalSummary;
  publishingQueue: PublishingQueueSummary;
}> {
  const admin = createAdminClient();
  const [settingsResult, workflowsResult, approvalsResult, scheduledResult] = await Promise.all([
    admin.from("workspace_marketing_settings").select("autonomy_level").eq("workspace_id", workspaceId).maybeSingle(),
    admin.from("marketing_workflows").select("state").eq("workspace_id", workspaceId),
    admin.from("marketing_approval_items").select("status").eq("workspace_id", workspaceId),
    admin.from("scheduled_posts").select("status").eq("workspace_id", workspaceId),
  ]);

  const workflowRows = (workflowsResult.data as Array<{ state: string | null }> | null) || [];
  const approvalRows = (approvalsResult.data as Array<{ status: string | null }> | null) || [];
  const scheduledRows = (scheduledResult.data as Array<{ status: string | null }> | null) || [];

  const workflowSummary: WorkflowSummary = {
    total: workflowRows.length,
    inProgress: workflowRows.filter((row) => row.state === "IN_PROGRESS").length,
    blocked: workflowRows.filter((row) => row.state === "BLOCKED").length,
    awaitingApproval: workflowRows.filter((row) => row.state === "AWAITING_APPROVAL").length,
    publishing: workflowRows.filter((row) => row.state === "PUBLISHING").length,
    completed: workflowRows.filter((row) => row.state === "COMPLETED").length,
    failed: workflowRows.filter((row) => row.state === "FAILED").length,
    cancelled: workflowRows.filter((row) => row.state === "CANCELLED").length,
  };

  const approvalSummary: ApprovalSummary = {
    pending: approvalRows.filter((row) => row.status === "PENDING").length,
    approved: approvalRows.filter((row) => row.status === "APPROVED").length,
    rejected: approvalRows.filter((row) => row.status === "REJECTED").length,
    editRequested: approvalRows.filter((row) => row.status === "EDIT_REQUESTED").length,
  };

  const publishingQueue: PublishingQueueSummary = {
    queued: scheduledRows.filter((row) => row.status === "PENDING_APPROVAL").length,
    preparing: scheduledRows.filter((row) => row.status === "DRAFT").length,
    publishing: scheduledRows.filter((row) => row.status === "PUBLISHING" || row.status === "DELIVERED_TO_INBOX").length,
    published: scheduledRows.filter((row) => row.status === "PUBLISHED").length,
    retry: scheduledRows.filter((row) => row.status === "FAILED").length,
    failed: scheduledRows.filter((row) => row.status === "FAILED").length,
    cancelled: scheduledRows.filter((row) => row.status === "CANCELED").length,
  };

  return {
    autonomyLevel: normalizeAutonomyLevel((settingsResult.data as { autonomy_level?: unknown } | null)?.autonomy_level),
    workflowSummary,
    approvalSummary,
    publishingQueue,
  };
}

export async function upsertApprovalItem(input: {
  workspaceId: string;
  workflowId?: string | null;
  itemType: "draft" | "campaign" | "schedule" | "publish" | "recommendation";
  title: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EDIT_REQUESTED" | "CANCELLED";
  requestedBy?: string | null;
  resolvedBy?: string | null;
  targetRecordType?: string | null;
  targetRecordId?: string | null;
  comment?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("marketing_approval_items")
    .insert({
      workspace_id: input.workspaceId,
      workflow_id: input.workflowId || null,
      item_type: input.itemType,
      title: input.title,
      status: input.status,
      requested_by: input.requestedBy || null,
      resolved_by: input.resolvedBy || null,
      resolved_at: input.resolvedBy ? now : null,
      target_record_type: input.targetRecordType || null,
      target_record_id: input.targetRecordId || null,
      comment: input.comment || null,
      metadata: input.metadata || {},
    } as never)
    .select("id")
    .maybeSingle();

  if (error) return null;
  return ((data as { id?: string } | null)?.id || null);
}

export async function upsertForecast(input: {
  workspaceId: string;
  workflowId?: string | null;
  forecastType:
    | "content_readiness"
    | "publishing_capacity"
    | "campaign_completion"
    | "lead_generation"
    | "marketing_workload"
    | "approval_backlog"
    | "confidence";
  measuredValue?: number | null;
  estimatedValue?: number | null;
  confidence: number;
  note: string;
  measured: boolean;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("marketing_forecasts").insert({
    workspace_id: input.workspaceId,
    workflow_id: input.workflowId || null,
    forecast_type: input.forecastType,
    measured_value: input.measuredValue ?? null,
    estimated_value: input.estimatedValue ?? null,
    confidence: Math.min(1, Math.max(0, input.confidence)),
    note: input.note,
    measured: input.measured,
  } as never);
}

export async function refreshAiHealthMetrics(input: {
  workspaceId: string;
  metricDate?: string;
}): Promise<{
  acceptanceRate: number;
  approvalRate: number;
  executionSuccessRate: number;
  publishingSuccessRate: number;
  forecastAccuracyRate: number;
  userEditsBeforeApprovalRate: number;
  campaignCompletionRate: number;
  learningImprovementRate: number;
  status: "healthy" | "warning" | "critical";
}> {
  const admin = createAdminClient();
  const dateKey = input.metricDate || new Date().toISOString().slice(0, 10);

  const [approvalResult, workflowResult, scheduledResult, forecastResult, commandResult] = await Promise.all([
    admin.from("marketing_approval_items").select("status,metadata").eq("workspace_id", input.workspaceId),
    admin.from("marketing_workflows").select("state").eq("workspace_id", input.workspaceId),
    admin.from("scheduled_posts").select("status").eq("workspace_id", input.workspaceId),
    admin.from("marketing_forecasts").select("measured_value,estimated_value").eq("workspace_id", input.workspaceId),
    admin.from("marketing_director_commands").select("status,metadata").eq("workspace_id", input.workspaceId),
  ]);

  const approvals = (approvalResult.data as Array<{ status: string | null; metadata?: Record<string, unknown> | null }> | null) || [];
  const workflows = (workflowResult.data as Array<{ state: string | null }> | null) || [];
  const scheduledPosts = (scheduledResult.data as Array<{ status: string | null }> | null) || [];
  const forecasts = (forecastResult.data as Array<{ measured_value: number | null; estimated_value: number | null }> | null) || [];
  const commands = (commandResult.data as Array<{ status: string | null; metadata?: Record<string, unknown> | null }> | null) || [];

  const acceptanceRate = commands.length > 0
    ? commands.filter((row) => row.status === "APPROVED" || row.status === "EXECUTED").length / commands.length
    : 0;

  const approvalDenominator = approvals.filter((row) => row.status === "PENDING" || row.status === "APPROVED" || row.status === "REJECTED").length;
  const approvalRate = approvalDenominator > 0
    ? approvals.filter((row) => row.status === "APPROVED").length / approvalDenominator
    : 0;

  const executionDenominator = workflows.filter((row) => row.state !== "CANCELLED").length;
  const executionSuccessRate = executionDenominator > 0
    ? workflows.filter((row) => row.state === "COMPLETED").length / executionDenominator
    : 0;

  const publishingDenominator = scheduledPosts.filter((row) => row.status === "PUBLISHED" || row.status === "FAILED" || row.status === "PUBLISHING").length;
  const publishingSuccessRate = publishingDenominator > 0
    ? scheduledPosts.filter((row) => row.status === "PUBLISHED").length / publishingDenominator
    : 0;

  const measurableForecasts = forecasts.filter((row) => row.measured_value != null && row.estimated_value != null);
  const forecastAccuracyRate = measurableForecasts.length > 0
    ? measurableForecasts.reduce((sum, row) => {
        const measured = Number(row.measured_value || 0);
        const estimated = Number(row.estimated_value || 0);
        if (measured === 0 && estimated === 0) return sum + 1;
        const denominator = Math.max(1, Math.abs(measured));
        const error = Math.abs(measured - estimated) / denominator;
        return sum + Math.max(0, 1 - error);
      }, 0) / measurableForecasts.length
    : 0;

  const editedApprovals = approvals.filter((row) => {
    const metadata = row.metadata || {};
    return Boolean(metadata["editedBeforeApproval"]);
  }).length;
  const userEditsBeforeApprovalRate = approvals.length > 0 ? editedApprovals / approvals.length : 0;

  const campaignCompletionRate = workflows.length > 0
    ? workflows.filter((row) => row.state === "COMPLETED").length / workflows.length
    : 0;

  const learningImprovementRate = commands.length > 0
    ? commands.filter((row) => String(row.metadata?.["activitySummary"] || "").toLowerCase().includes("improved")).length / commands.length
    : 0;

  await admin.from("marketing_ai_health_metrics").upsert({
    workspace_id: input.workspaceId,
    metric_date: dateKey,
    recommendation_acceptance_rate: acceptanceRate,
    approval_rate: approvalRate,
    execution_success_rate: executionSuccessRate,
    publishing_success_rate: publishingSuccessRate,
    forecast_accuracy_rate: forecastAccuracyRate,
    user_edits_before_approval_rate: userEditsBeforeApprovalRate,
    campaign_completion_rate: campaignCompletionRate,
    learning_improvement_rate: learningImprovementRate,
  } as never, { onConflict: "workspace_id,metric_date" });

  const status = ratingFromRatio(
    (acceptanceRate + approvalRate + executionSuccessRate + publishingSuccessRate + forecastAccuracyRate) / 5,
  );

  return {
    acceptanceRate,
    approvalRate,
    executionSuccessRate,
    publishingSuccessRate,
    forecastAccuracyRate,
    userEditsBeforeApprovalRate,
    campaignCompletionRate,
    learningImprovementRate,
    status,
  };
}

export async function enqueueNotification(input: {
  workspaceId: string;
  userId?: string | null;
  channel: "in_app" | "email" | "mobile_future";
  triggerType:
    | "approval_required"
    | "publishing_failed"
    | "campaign_completed"
    | "analytics_available"
    | "major_opportunity"
    | "major_risk";
  title: string;
  body: string;
  preferenceKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("marketing_notifications").insert({
    workspace_id: input.workspaceId,
    user_id: input.userId || null,
    channel: input.channel,
    trigger_type: input.triggerType,
    title: input.title,
    body: input.body,
    preference_key: input.preferenceKey || null,
    metadata: input.metadata || {},
  } as never);
}

export function defaultNotificationPreferences(): NotificationPreferenceMap {
  return {
    approvalRequired: true,
    publishingFailed: true,
    campaignCompleted: true,
    analyticsAvailable: true,
    majorOpportunity: true,
    majorRisk: true,
    emailEnabled: false,
  };
}

export function buildMeasuredOrEstimatedLabel(input: {
  measured: boolean;
  measuredValue?: number | null;
  estimatedValue?: number | null;
  unit?: "%" | "count" | "currency";
}): string {
  const value = input.measured ? input.measuredValue : input.estimatedValue;
  if (value == null) return input.measured ? "Measured: unavailable" : "Estimated: unavailable";

  const numeric = Number(value);
  const formatted = input.unit === "%"
    ? `${(numeric * 100).toFixed(1)}%`
    : input.unit === "currency"
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(numeric)
      : String(Math.round(numeric));

  return input.measured ? `Measured: ${formatted}` : `Estimated: ${formatted}`;
}
