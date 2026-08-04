import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { TikTokPublishJobService } from "@/features/integrations/tiktok/publish-jobs";
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
      mode?: unknown;
      privacyLevel?: unknown;
      disableComment?: unknown;
      disableDuet?: unknown;
      disableStitch?: unknown;
      commercialContentDisclosure?: unknown;
      brandedContentToggle?: unknown;
    } | null;

    const videoProjectId = String(payload?.videoProjectId || "").trim();
    const idempotencyKey = String(payload?.idempotencyKey || "").trim().slice(0, 160);
    const channel = normalizeChannel(String(payload?.channel || "TikTok"));

    if (!videoProjectId) {
      throw new Error("POST_NOW_INVALID:Choose an approved video first.");
    }

    const { data: project, error: projectError } = await admin
      .from("video_projects")
      .select("id,title,caption,status,video_storage_path,media_asset_id")
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
      .select("video_project_id,status")
      .eq("workspace_id", context.workspaceId)
      .eq("video_project_id", videoProjectId)
      .in("status", ["SCHEDULED", "PUBLISHING", "DELIVERED_TO_INBOX", "PUBLISHED"])
      .limit(10);

    if (existingError) throw new Error(`POST_NOW_DUPLICATE_CHECK_FAILED:${existingError.message}`);
    const existingAll = ((existingRows as Array<Record<string, unknown>> | null) || []).map((row) => ({
      videoProjectId: String(row.video_project_id || ""),
      status: String(row.status || ""),
    }));
    if (hasDuplicatePublish(existingAll, videoProjectId)) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        data: {
          status: "PUBLISHING",
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

    let mediaAssetId = String(projectRow.media_asset_id || "").trim();
    if (!mediaAssetId) {
      const { data: mediaByPath, error: mediaLookupError } = await admin
        .from("media_assets")
        .select("id")
        .eq("workspace_id", context.workspaceId)
        .eq("storage_path", String(projectRow.video_storage_path || ""))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mediaLookupError) {
        throw new Error(`POST_NOW_MEDIA_LOOKUP_FAILED:${mediaLookupError.message}`);
      }
      mediaAssetId = String((mediaByPath as { id?: string } | null)?.id || "").trim();
    }
    if (!mediaAssetId) {
      throw new Error("POST_NOW_INVALID:The approved video asset is not available for TikTok publishing.");
    }

    const actor = {
      supabase: admin,
      userId: context.userId,
      workspaceId: context.workspaceId,
    };
    const modeRaw = String(payload?.mode || "UPLOAD_DRAFT").toUpperCase();
    const mode = modeRaw === "DIRECT_POST" ? "DIRECT_POST" : "UPLOAD_DRAFT";
    const hashtags = String(projectRow.caption || "")
      .split(/\s+/u)
      .map((part) => part.trim())
      .filter((part) => part.startsWith("#"))
      .slice(0, 8);

    const publishService = new TikTokPublishJobService();
    const job = await publishService.createTikTokPublishJob(actor, {
      mediaAssetId,
      caption: String(projectRow.caption || ""),
      hashtags,
      consent: true,
      mode,
      privacyLevel: String(payload?.privacyLevel || "").trim() || undefined,
      disableComment: payload?.disableComment === true,
      disableDuet: payload?.disableDuet === true,
      disableStitch: payload?.disableStitch === true,
      commercialContentDisclosure: payload?.commercialContentDisclosure === true,
      brandedContentToggle: payload?.brandedContentToggle === true,
      idempotencyKey: idempotencyKey || undefined,
    });
    const initialized = await publishService.initializeTikTokPublish(actor, job.id);

    return NextResponse.json({
      ok: true,
      data: {
        jobId: initialized.id,
        publishId: initialized.publishId,
        status: initialized.status,
        mode,
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
