import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { enforceCreatorPermission } from "@/features/creators/permissions";

type SaveBody = {
  creatorId?: unknown;
  saved?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    await enforceCreatorPermission({ workspaceId: context.workspaceId, userId: context.userId, action: "manage_creators" });

    const body = (await request.json().catch(() => null)) as SaveBody | null;
    const creatorId = text(body?.creatorId);
    const saved = Boolean(body?.saved);

    if (!creatorId) {
      return NextResponse.json({ ok: false, error: "creatorId is required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("creators")
      .update({ saved, updated_at: new Date().toISOString() } as never)
      .eq("workspace_id", context.workspaceId)
      .eq("id", creatorId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    await admin.from("creator_activity_events").insert({
      workspace_id: context.workspaceId,
      actor_user_id: context.userId,
      event_type: saved ? "CREATOR_SAVED" : "CREATOR_UNSAVED",
      entity_type: "creator",
      entity_id: creatorId,
      summary: saved ? "Creator saved." : "Creator removed from saved list.",
      metadata: { saved },
    } as never);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save creator.";
    const status = message.startsWith("WORKSPACE_FORBIDDEN") ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
