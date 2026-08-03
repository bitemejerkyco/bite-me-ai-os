import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { TikTokConnectionService } from "@/features/integrations/tiktok/service";
import { hasDuplicatePublish, isPostNowEligible } from "@/features/core/post-now-policy";

function normalizeChannel(input: string): "TikTok" | "Instagram" | "Facebook" {
  const normalized = input.toLowerCase();
  if (normalized.includes("instagram")) return "Instagram";
  if (normalized.includes("facebook")) return "Facebook";
  return "TikTok";
}

export async function POST(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    const admin = createAdminClient();
    const payload = (await request.json().catch(() => null)) as {
      videoProjectId?: unknown;
      channel?: unknown;
      idempotencyKey?: unknown;
    } | null;

    const videoProjectId = String(payload?.videoProjectId || "").trim();
    const idempotencyKey = String(payload?.idempotencyKey || "").trim().slice(0, 160);
    const channel = normalizeChannel(String(payload?.channel || "TikTok"));

    if (!videoProjectId) {
      throw new Error("POST_NOW_INVALID:Choose an approved video first.");
    }

    const { data: project, error: projectError } = await admin
      .from("video_projects")
      .select("id,title,caption,status,video_storage_path")
      .eq("workspace_id", context.workspaceId)
      .eq("id", videoProjectId)
      .maybeSingle();

    if (projectError) throw new Error(`POST_NOW_PROJECT_LOOKUP_FAILED:${projectError.message}`);
    const projectRow = project as Record<string, unknown> | null;
    if (!projectRow) throw new Error("POST_NOW_INVALID:Video project was not found.");
    if (!isPostNowEligible({
      videoProjectId,
      status: String(projectRow.status || ""),
      videoStoragePath: String(projectRow.video_storage_path || "") || null,
    })) {
      throw new Error("POST_NOW_INVALID:Only approved videos with completed output can be posted now.");
    }

    const { data: existingRows, error: existingError } = await admin
      .from("scheduled_posts")
      .select("id,status,created_at")
      .eq("workspace_id", context.workspaceId)
      .eq("video_project_id", videoProjectId)
      .in("status", ["SCHEDULED", "PUBLISHING", "DELIVERED_TO_INBOX", "PUBLISHED"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingError) throw new Error(`POST_NOW_DUPLICATE_CHECK_FAILED:${existingError.message}`);
    const existing = ((existingRows as Array<Record<string, unknown>> | null) || [])[0] || null;
    const existingAll = ((existingRows as Array<Record<string, unknown>> | null) || []).map((row) => ({
      videoProjectId,
      status: String(row.status || ""),
    }));
    if (hasDuplicatePublish(existingAll, videoProjectId) && existing) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        data: {
          scheduledPostId: String(existing.id || ""),
          status: String(existing.status || "SCHEDULED"),
          idempotencyKey,
        },
      });
    }

    if (channel !== "TikTok") {
      return NextResponse.json(
        {
          ok: false,
          setupRedirect: "/integrations",
          error: "POST_NOW_SETUP_REQUIRED:Only TikTok immediate posting is configured right now. Connect more channels in Integrations.",
        },
        { status: 409 },
      );
    }

    const { data: tiktokConnection, error: tiktokError } = await admin
      .from("tiktok_connections")
      .select("status")
      .eq("workspace_id", context.workspaceId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tiktokError) throw new Error(`POST_NOW_TIKTOK_LOOKUP_FAILED:${tiktokError.message}`);
    const connectionStatus = String((tiktokConnection as Record<string, unknown> | null)?.status || "disconnected");
    if (connectionStatus !== "connected") {
      return NextResponse.json(
        {
          ok: false,
          setupRedirect: "/settings/integrations/tiktok",
          error: "POST_NOW_SETUP_REQUIRED:TikTok is not connected. Reconnect TikTok before posting now.",
        },
        { status: 409 },
      );
    }

    const scheduledPostId = randomUUID();
    const nowIso = new Date().toISOString();

    const { error: insertError } = await admin
      .from("scheduled_posts")
      .insert({
        id: scheduledPostId,
        workspace_id: context.workspaceId,
        created_by: context.userId,
        entry_type: "POST",
        channel,
        title: String(projectRow.title || "Video post"),
        content: String(projectRow.caption || ""),
        scheduled_for: nowIso,
        timezone: "UTC",
        status: "SCHEDULED",
        approved_by: context.userId,
        approved_at: nowIso,
        content_draft_id: null,
        video_project_id: videoProjectId,
        media_storage_path: String(projectRow.video_storage_path || ""),
      } as never);

    if (insertError) throw new Error(`POST_NOW_INSERT_FAILED:${insertError.message}`);

    const actor = {
      supabase: admin,
      userId: context.userId,
      workspaceId: context.workspaceId,
    };

    const publishId = await new TikTokConnectionService().sendScheduledVideoToInbox(
      actor,
      scheduledPostId,
    );

    return NextResponse.json({
      ok: true,
      data: {
        scheduledPostId,
        publishId,
        status: "PUBLISHING",
        idempotencyKey,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }
}
