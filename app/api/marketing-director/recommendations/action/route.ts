import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { getMarketingModeSettings } from "@/features/marketing-director/modes";
import { canUseFeature } from "@/features/billing/entitlements";
import {
  appendCommandActivity,
} from "@/features/marketing-director/command-activity";
import {
  buildDefaultRecommendationEntitlements,
  buildRecommendationRuntime,
  parsePlanById,
  validateRecommendationTransition,
  writeRecommendationStateToMetadata,
  type RecommendationActionKind,
  type RecommendationWorkflowStatus,
} from "@/features/marketing-director/recommendation-workflows";

type RecommendationActionBody = {
  planId?: unknown;
  actionId?: unknown;
  actionKind?: unknown;
  deferUntil?: unknown;
};

type ContentDraftRow = {
  id: string;
  approval_status: string | null;
  status: string | null;
};

type ScheduledPostRow = {
  id: string;
  status: string | null;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asKind(value: unknown): RecommendationActionKind | null {
  const kind = asText(value).toUpperCase();
  const allowed: RecommendationActionKind[] = [
    "GENERATE_CONTENT",
    "VIEW_DRAFT",
    "EDIT_DRAFT",
    "REGENERATE_CONTENT",
    "APPROVE_DRAFT",
    "REJECT_DRAFT",
    "SCHEDULE_CONTENT",
    "RESCHEDULE_CONTENT",
    "PUBLISH_NOW",
    "VIEW_ANALYTICS",
    "DUPLICATE_CONTENT",
    "CREATE_FOLLOW_UP",
    "CONNECT_INTEGRATION",
    "UPLOAD_ASSET",
    "OPEN_SCORE_BREAKDOWN",
    "OPEN_APPROVAL_QUEUE",
    "OPEN_CALENDAR",
    "OPEN_CAMPAIGN",
    "LEARN_MORE",
    "DISMISS",
    "DEFER",
  ];

  return allowed.includes(kind as RecommendationActionKind)
    ? (kind as RecommendationActionKind)
    : null;
}

function nextStatusForAction(actionKind: RecommendationActionKind): RecommendationWorkflowStatus | null {
  if (actionKind === "DISMISS") return "DISMISSED";
  if (actionKind === "DEFER") return "DEFERRED";
  if (actionKind === "PUBLISH_NOW") return "PUBLISHED";
  return null;
}

function humanDetails(actionKind: RecommendationActionKind): string {
  if (actionKind === "DISMISS") return "Recommendation dismissed.";
  if (actionKind === "DEFER") return "Recommendation deferred.";
  if (actionKind === "PUBLISH_NOW") return "Recommendation published now.";
  return "Recommendation updated.";
}

function asIsoDateOrNull(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function POST(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    const body = (await request.json().catch(() => null)) as RecommendationActionBody | null;

    const planId = asText(body?.planId);
    const actionId = asText(body?.actionId);
    const actionKind = asKind(body?.actionKind);

    if (!planId || !actionId || !actionKind) {
      return NextResponse.json(
        {
          ok: false,
          code: "ACTION_NOT_ALLOWED",
          error: "planId, actionId, and actionKind are required.",
        },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: commandData, error: commandError } = await admin
      .from("marketing_director_commands")
      .select("id,workspace_id,actor_user_id,prompt,status,proposal,metadata,created_at,updated_at")
      .eq("workspace_id", context.workspaceId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (commandError || !commandData) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_WORKFLOW_TRANSITION",
          error: "Unable to load recommendation context.",
        },
        { status: 400 },
      );
    }

    const commandRows = commandData as Array<{
      id: string;
      proposal: unknown;
      metadata: unknown;
      prompt: string;
    }>;

    const planRecord = parsePlanById({ commandRows, planId });
    if (!planRecord) {
      return NextResponse.json(
        {
          ok: false,
          code: "MISSING_TARGET_RECORD",
          error: "Plan not found for this workspace.",
        },
        { status: 404 },
      );
    }

    const action = planRecord.plan.recommendedActions.find((item) => item.id === actionId);
    if (!action) {
      return NextResponse.json(
        {
          ok: false,
          code: "MISSING_TARGET_RECORD",
          error: "Recommendation action not found.",
        },
        { status: 404 },
      );
    }

    const [{ data: draftData }, modeSettings] = await Promise.all([
      admin
        .from("content_drafts")
        .select("id,approval_status,status")
        .eq("workspace_id", context.workspaceId)
        .eq("plan_id", planId)
        .eq("task_id", action.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      getMarketingModeSettings(context.workspaceId),
    ]);

    const draft = (draftData as ContentDraftRow | null) || null;
    const scheduledPostResult = draft?.id
      ? await admin
          .from("scheduled_posts")
          .select("id,status")
          .eq("workspace_id", context.workspaceId)
          .eq("content_draft_id", draft.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
    const scheduledPost = (scheduledPostResult.data as ScheduledPostRow | null) || null;

    async function checkEntitlementWithFallback(feature: Parameters<typeof canUseFeature>[1], fallback: boolean) {
      try {
        return await canUseFeature(context.workspaceId, feature);
      } catch {
        return fallback;
      }
    }

    const entitlements = {
      ...buildDefaultRecommendationEntitlements(),
      canGenerateContent: await checkEntitlementWithFallback("monthly_ai_credits", true),
      canSchedule: await checkEntitlementWithFallback("scheduled_posts_per_month", true),
      canPublish: await checkEntitlementWithFallback("scheduled_posts_per_month", false),
      canUseAdvancedAnalytics: await checkEntitlementWithFallback("can_use_advanced_analytics", true),
      canConnectIntegrations: await checkEntitlementWithFallback("social_connections", true),
    };

    const runtime = buildRecommendationRuntime({
      recommendation: action,
      route: action.target,
      source: action.supportingData,
      taskMetadata: {
        recommendationType: action.control === "Prepare integration checklist" ? "INTEGRATION_CONNECTION" : undefined,
      },
      draftId: draft?.id || null,
      draftStatus: draft?.status || null,
      approvalStatus: draft?.approval_status || null,
      scheduledPostId: scheduledPost?.id || null,
      scheduledStatus: scheduledPost?.status || null,
      publishStatus: scheduledPost?.status || null,
      operatingMode: modeSettings.operatingMode,
      entitlements,
    });

    const transition = validateRecommendationTransition({
      actionKind,
      allowedActions: runtime.actions,
      operatingMode: modeSettings.operatingMode,
      workflowStatus: runtime.workflowStatus,
      draftId: runtime.draftId,
      scheduledPostId: runtime.scheduledPostId,
    });

    if (!transition.ok) {
      const status = transition.code === "MISSING_TARGET_RECORD" ? 404 : transition.code === "MODE_RESTRICTED" ? 403 : 400;
      return NextResponse.json(
        {
          ok: false,
          code: transition.code,
          error: transition.message,
        },
        { status },
      );
    }

    const nextStatus = nextStatusForAction(actionKind);
    if (!nextStatus) {
      return NextResponse.json(
        {
          ok: false,
          code: "ACTION_NOT_ALLOWED",
          error: "Action is not supported by this endpoint.",
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const deferUntil = actionKind === "DEFER" ? asIsoDateOrNull(body?.deferUntil) : null;
    if (actionKind === "DEFER" && !deferUntil) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_WORKFLOW_TRANSITION",
          error: "A valid deferUntil ISO date is required for defer action.",
        },
        { status: 400 },
      );
    }

    let metadata = writeRecommendationStateToMetadata({
      commandMetadata: planRecord.metadata,
      actionId,
      workflowStatus: nextStatus,
      deferredUntil: deferUntil,
      dismissedAt: actionKind === "DISMISS" ? now : null,
    });

    metadata = appendCommandActivity(metadata, {
      status:
        actionKind === "DISMISS"
          ? "dismissed"
          : actionKind === "DEFER"
            ? "deferred"
            : "published",
      timestamp: now,
      userId: context.userId,
      planId,
      request: planRecord.prompt,
      details: humanDetails(actionKind),
    });

    const { error: updateError } = await admin
      .from("marketing_director_commands")
      .update({ metadata } as never)
      .eq("id", planRecord.commandId)
      .eq("workspace_id", context.workspaceId);

    if (updateError) {
      throw new Error(`RECOMMENDATION_ACTION_UPDATE_FAILED:${updateError.message}`);
    }

    if (actionKind === "PUBLISH_NOW" && scheduledPost?.id) {
      await admin
        .from("scheduled_posts")
        .update({
          status: "PUBLISHED",
          published_at: now,
          updated_at: now,
        } as never)
        .eq("id", scheduledPost.id)
        .eq("workspace_id", context.workspaceId);
    }

    return NextResponse.json({
      ok: true,
      code: "ACTION_ACCEPTED",
      workflowStatus: nextStatus,
      actionId,
      planId,
      deferredUntil: deferUntil,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_WORKFLOW_TRANSITION",
        error: message.startsWith("AUTH_REQUIRED:") ? "Sign in required." : "Unable to update recommendation state right now.",
      },
      { status: 400 },
    );
  }
}
