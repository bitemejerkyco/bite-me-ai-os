import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { getMarketingModeSettings } from "@/features/marketing-director/modes";
import { canUseFeature } from "@/features/billing/entitlements";
import {
  appendCommandActivity,
  planFromProposal,
  type CommandRecord,
} from "@/features/marketing-director/command-activity";
import {
  isExecutionBlockedInAdvisor,
  type MarketingDirectorStructuredPlan,
} from "@/features/marketing-director/conversational-plan";
import {
  buildDefaultRecommendationEntitlements,
  buildRecommendationRuntime,
  validateRecommendationTransition,
  writeRecommendationStateToMetadata,
} from "@/features/marketing-director/recommendation-workflows";
import {
  enqueueNotification,
  EXECUTION_ERROR_CODES,
  recordExecutionEvent,
  upsertApprovalItem,
} from "@/features/marketing-director/execution-engine";

type ApproveBody = {
  commandId?: unknown;
  actionId?: unknown;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getAction(plan: MarketingDirectorStructuredPlan, actionId: string) {
  return plan.recommendedActions.find((item) => item.id === actionId) || null;
}

async function checkEntitlementWithFallback(
  accountId: string,
  feature: Parameters<typeof canUseFeature>[1],
  fallback: boolean,
) {
  try {
    return await canUseFeature(accountId, feature);
  } catch {
    return fallback;
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    const body = (await request.json().catch(() => null)) as ApproveBody | null;
    const commandId = asText(body?.commandId);
    const actionId = asText(body?.actionId);

    if (!commandId || !actionId) {
      return NextResponse.json({ ok: false, code: EXECUTION_ERROR_CODES.INVALID_WORKFLOW, error: "commandId and actionId are required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("marketing_director_commands")
      .select("id,workspace_id,actor_user_id,prompt,status,proposal,metadata,created_at,updated_at")
      .eq("id", commandId)
      .eq("workspace_id", context.workspaceId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ ok: false, code: EXECUTION_ERROR_CODES.WORKFLOW_BLOCKED, error: "Command not found." }, { status: 404 });
    }

    const record = data as CommandRecord;
    const plan = planFromProposal(record.proposal);
    if (!plan) {
      return NextResponse.json({ ok: false, code: EXECUTION_ERROR_CODES.WORKFLOW_BLOCKED, error: "Structured plan is not available for this command." }, { status: 404 });
    }

    const action = getAction(plan, actionId);
    if (!action) {
      return NextResponse.json({ ok: false, code: EXECUTION_ERROR_CODES.WORKFLOW_BLOCKED, error: "Action not found." }, { status: 404 });
    }

    const modeSettings = await getMarketingModeSettings(context.workspaceId);
    if (modeSettings.operatingMode === "advisor" && isExecutionBlockedInAdvisor(action)) {
      const blockedMetadata = appendCommandActivity(record.metadata, {
        status: "failed",
        timestamp: new Date().toISOString(),
        userId: context.userId,
        planId: plan.planId,
        request: record.prompt,
        details: `Blocked in advisor mode for action ${action.title}.`,
      });

      await admin
        .from("marketing_director_commands")
        .update({ metadata: blockedMetadata } as never)
        .eq("id", commandId)
        .eq("workspace_id", context.workspaceId);

      return NextResponse.json(
        {
          ok: false,
          code: EXECUTION_ERROR_CODES.MODE_RESTRICTED,
          error: "Advisor mode cannot execute scheduling, publishing, or budget actions automatically.",
        },
        { status: 403 },
      );
    }

    const draftResult = await admin
      .from("content_drafts")
      .select("id,approval_status,status")
      .eq("workspace_id", context.workspaceId)
      .eq("plan_id", plan.planId)
      .eq("task_id", action.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const draft = (draftResult.data as { id: string; approval_status: string | null; status: string | null } | null) || null;
    const entitlements = {
      ...buildDefaultRecommendationEntitlements(),
      canGenerateContent: await checkEntitlementWithFallback(context.workspaceId, "monthly_ai_credits", true),
      canSchedule: await checkEntitlementWithFallback(context.workspaceId, "scheduled_posts_per_month", true),
      canPublish: await checkEntitlementWithFallback(context.workspaceId, "scheduled_posts_per_month", false),
      canUseAdvancedAnalytics: await checkEntitlementWithFallback(context.workspaceId, "can_use_advanced_analytics", true),
      canConnectIntegrations: await checkEntitlementWithFallback(context.workspaceId, "social_connections", true),
    };

    const runtime = buildRecommendationRuntime({
      recommendation: action,
      route: action.target,
      source: action.supportingData,
      draftId: draft?.id || null,
      draftStatus: draft?.status || null,
      approvalStatus: draft?.approval_status || null,
      operatingMode: modeSettings.operatingMode,
      entitlements,
    });

    const transition = validateRecommendationTransition({
      actionKind: "APPROVE_DRAFT",
      allowedActions: runtime.actions,
      operatingMode: modeSettings.operatingMode,
      workflowStatus: runtime.workflowStatus,
      draftId: runtime.draftId,
      scheduledPostId: runtime.scheduledPostId,
    });

    if (!transition.ok) {
      const code =
        transition.code === "APPROVAL_REQUIRED"
          ? EXECUTION_ERROR_CODES.APPROVAL_REQUIRED
          : transition.code === "MODE_RESTRICTED"
            ? EXECUTION_ERROR_CODES.MODE_RESTRICTED
            : transition.code === "ENTITLEMENT_REQUIRED"
              ? EXECUTION_ERROR_CODES.ENTITLEMENT_REQUIRED
              : transition.code === "INTEGRATION_NOT_AVAILABLE"
                ? EXECUTION_ERROR_CODES.INTEGRATION_NOT_CONNECTED
                : transition.code === "MISSING_TARGET_RECORD"
                  ? EXECUTION_ERROR_CODES.WORKFLOW_BLOCKED
                  : EXECUTION_ERROR_CODES.INVALID_WORKFLOW;
      return NextResponse.json(
        {
          ok: false,
          code,
          error: transition.message,
        },
        { status: transition.code === "MODE_RESTRICTED" ? 403 : transition.code === "MISSING_TARGET_RECORD" ? 404 : 400 },
      );
    }

    const now = new Date().toISOString();
    let metadata = appendCommandActivity(record.metadata, {
      status: "approval_requested",
      timestamp: now,
      userId: context.userId,
      planId: plan.planId,
      request: record.prompt,
      details: `Approval requested for action ${action.title}.`,
    });
    metadata = appendCommandActivity(metadata, {
      status: "approved",
      timestamp: now,
      userId: context.userId,
      planId: plan.planId,
      request: record.prompt,
      details: `Approved action ${action.title}.`,
    });
    metadata = writeRecommendationStateToMetadata({
      commandMetadata: metadata,
      actionId: action.id,
      workflowStatus: "APPROVED",
      deferredUntil: null,
      dismissedAt: null,
    });

    const markCompleted = ["Create draft", "Generate content plan", "Prepare campaign brief", "Prepare integration checklist"].includes(action.control);
    if (markCompleted) {
      metadata = appendCommandActivity(metadata, {
        status: "draft_created",
        timestamp: now,
        userId: context.userId,
        planId: plan.planId,
        request: record.prompt,
        details: `Draft artifact created for ${action.title}.`,
      });
      metadata = appendCommandActivity(metadata, {
        status: "completed",
        timestamp: now,
        userId: context.userId,
        planId: plan.planId,
        request: record.prompt,
        details: `Completed action ${action.title}.`,
      });
    }

    const updatedActions = plan.recommendedActions.map((item) =>
      item.id === action.id
        ? {
            ...item,
            executionStatus: markCompleted ? "completed" : "approval_required",
          }
        : item,
    );

    const updatedPlan = {
      ...plan,
      recommendedActions: updatedActions,
    };

    const { error: updateError } = await admin
      .from("marketing_director_commands")
      .update({
        proposal: updatedPlan,
        status: markCompleted ? "EXECUTED" : "APPROVED",
        approved_by: context.userId,
        approved_at: now,
        executed_at: markCompleted ? now : null,
        metadata,
      } as never)
      .eq("id", commandId)
      .eq("workspace_id", context.workspaceId);

    if (updateError) {
      throw new Error(`COMMAND_APPROVE_FAILED:${updateError.message}`);
    }

    const approvalItemId = await upsertApprovalItem({
      workspaceId: context.workspaceId,
      itemType: "recommendation",
      title: action.title,
      status: "APPROVED",
      requestedBy: context.userId,
      resolvedBy: context.userId,
      targetRecordType: "marketing_director_command",
      targetRecordId: commandId,
      comment: `Approved from command approval endpoint for action ${action.id}.`,
      metadata: {
        commandId,
        actionId,
        planId: plan.planId,
        markCompleted,
      },
    });

    await recordExecutionEvent({
      workspaceId: context.workspaceId,
      approvalItemId,
      actorUserId: context.userId,
      eventType: "approval",
      status: markCompleted ? "COMPLETED" : "APPROVED",
      message: markCompleted
        ? `Action ${action.title} approved and completed.`
        : `Action ${action.title} approved and queued for execution.`,
      metadata: {
        commandId,
        actionId,
      },
    });

    await enqueueNotification({
      workspaceId: context.workspaceId,
      userId: context.userId,
      channel: "in_app",
      triggerType: "approval_required",
      title: "Approval processed",
      body: markCompleted
        ? `Approved and completed: ${action.title}`
        : `Approved: ${action.title}`,
      preferenceKey: "approvalRequired",
      metadata: {
        commandId,
        actionId,
      },
    });

    return NextResponse.json({
      ok: true,
      code: markCompleted ? "ACTION_COMPLETED" : "ACTION_APPROVED",
      status: markCompleted ? "completed" : "approved",
      proposal: updatedPlan,
      message: markCompleted
        ? "Action approved and completed as a safe draft/planning operation."
        : "Action approved. Further execution remains approval-gated.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    return NextResponse.json({
      ok: false,
      code: EXECUTION_ERROR_CODES.INVALID_WORKFLOW,
      error: message.startsWith("AUTH_REQUIRED:") ? "Sign in required." : "Unable to approve action right now.",
    }, { status: 400 });
  }
}
