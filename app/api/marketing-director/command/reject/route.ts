import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { getMarketingModeSettings } from "@/features/marketing-director/modes";
import { canUseFeature } from "@/features/billing/entitlements";
import { appendCommandActivity, planFromProposal, type CommandRecord } from "@/features/marketing-director/command-activity";
import {
  buildDefaultRecommendationEntitlements,
  buildRecommendationRuntime,
  validateRecommendationTransition,
  writeRecommendationStateToMetadata,
} from "@/features/marketing-director/recommendation-workflows";

type RejectBody = {
  commandId?: unknown;
  actionId?: unknown;
  reason?: unknown;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
    const body = (await request.json().catch(() => null)) as RejectBody | null;
    const commandId = asText(body?.commandId);
    const actionId = asText(body?.actionId);
    const reason = asText(body?.reason) || "Rejected by user.";

    if (!commandId || !actionId) {
      return NextResponse.json({ ok: false, code: "INVALID_REJECT_REQUEST", error: "commandId and actionId are required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("marketing_director_commands")
      .select("id,workspace_id,actor_user_id,prompt,status,proposal,metadata,created_at,updated_at")
      .eq("id", commandId)
      .eq("workspace_id", context.workspaceId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ ok: false, code: "COMMAND_NOT_FOUND", error: "Command not found." }, { status: 404 });
    }

    const record = data as CommandRecord;
    const plan = planFromProposal(record.proposal);
    if (!plan) {
      return NextResponse.json({ ok: false, code: "PLAN_NOT_FOUND", error: "Structured plan is not available for this command." }, { status: 404 });
    }

    const action = plan.recommendedActions.find((item) => item.id === actionId);
    if (!action) {
      return NextResponse.json({ ok: false, code: "ACTION_NOT_FOUND", error: "Action not found." }, { status: 404 });
    }

    const [modeSettings, draftResult] = await Promise.all([
      getMarketingModeSettings(context.workspaceId),
      admin
        .from("content_drafts")
        .select("id,approval_status,status")
        .eq("workspace_id", context.workspaceId)
        .eq("plan_id", plan.planId)
        .eq("task_id", action.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

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
      actionKind: "REJECT_DRAFT",
      allowedActions: runtime.actions,
      operatingMode: modeSettings.operatingMode,
      workflowStatus: runtime.workflowStatus,
      draftId: runtime.draftId,
      scheduledPostId: runtime.scheduledPostId,
    });

    if (!transition.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: transition.code,
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
      status: "rejected",
      timestamp: now,
      userId: context.userId,
      planId: plan.planId,
      request: record.prompt,
      details: `${action.title} rejected. ${reason}`,
    });
    metadata = writeRecommendationStateToMetadata({
      commandMetadata: metadata,
      actionId: action.id,
      workflowStatus: "FAILED",
      deferredUntil: null,
      dismissedAt: null,
    });

    const updatedPlan = {
      ...plan,
      recommendedActions: plan.recommendedActions.map((item) =>
        item.id === action.id ? { ...item, executionStatus: "failed" } : item),
    };

    const { error: updateError } = await admin
      .from("marketing_director_commands")
      .update({
        proposal: updatedPlan,
        status: "REJECTED",
        metadata,
      } as never)
      .eq("id", commandId)
      .eq("workspace_id", context.workspaceId);

    if (updateError) {
      throw new Error(`COMMAND_REJECT_FAILED:${updateError.message}`);
    }

    return NextResponse.json({
      ok: true,
      code: "ACTION_REJECTED",
      status: "rejected",
      proposal: updatedPlan,
      message: "Action rejected and logged.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    return NextResponse.json({
      ok: false,
      code: "REJECT_FAILED",
      error: message.startsWith("AUTH_REQUIRED:") ? "Sign in required." : "Unable to reject action right now.",
    }, { status: 400 });
  }
}
