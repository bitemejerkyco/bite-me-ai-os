import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { enforceCreatorPermission } from "@/features/creators/permissions";
import { CREATOR_PIPELINE_STAGES, type CreatorPipelineStage } from "@/features/creators/types";

type MutationBody = {
  recordId?: unknown;
  stage?: unknown;
  notes?: unknown;
  assignedUserId?: unknown;
  campaignId?: unknown;
  nextAction?: unknown;
  nextActionAt?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseStage(value: unknown): CreatorPipelineStage | null {
  const normalized = text(value).toUpperCase();
  return CREATOR_PIPELINE_STAGES.includes(normalized as CreatorPipelineStage)
    ? (normalized as CreatorPipelineStage)
    : null;
}

export async function POST(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    await enforceCreatorPermission({
      workspaceId: context.workspaceId,
      userId: context.userId,
      action: "manage_creators",
    });

    const body = (await request.json().catch(() => null)) as MutationBody | null;
    const recordId = text(body?.recordId);
    const stage = parseStage(body?.stage);

    if (!recordId || !stage) {
      return NextResponse.json({ ok: false, error: "recordId and valid stage are required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existing, error: loadError } = await admin
      .from("creator_pipeline_records")
      .select("id,creator_id,stage")
      .eq("workspace_id", context.workspaceId)
      .eq("id", recordId)
      .maybeSingle();

    if (loadError || !existing) {
      return NextResponse.json({ ok: false, error: "Pipeline record not found." }, { status: 404 });
    }

    const updatePayload = {
      stage,
      notes: text(body?.notes) || null,
      assigned_user_id: text(body?.assignedUserId) || null,
      campaign_id: text(body?.campaignId) || null,
      next_action: text(body?.nextAction) || null,
      next_action_at: text(body?.nextActionAt) || null,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await admin
      .from("creator_pipeline_records")
      .update(updatePayload as never)
      .eq("workspace_id", context.workspaceId)
      .eq("id", recordId);

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
    }

    await admin.from("creator_activity_events").insert({
      workspace_id: context.workspaceId,
      actor_user_id: context.userId,
      event_type: "CREATOR_STAGE_MOVED",
      entity_type: "creator_pipeline",
      entity_id: recordId,
      summary: `Creator moved from ${String((existing as { stage?: string }).stage || "UNKNOWN")} to ${stage}.`,
      metadata: {
        from: (existing as { stage?: string }).stage || null,
        to: stage,
        creatorId: (existing as { creator_id?: string }).creator_id || null,
      },
    } as never);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update creator pipeline.";
    const status = message.startsWith("WORKSPACE_FORBIDDEN") ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
