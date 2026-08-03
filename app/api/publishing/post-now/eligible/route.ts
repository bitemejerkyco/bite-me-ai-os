import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { isPostNowEligible } from "@/features/core/post-now-policy";

export type PostNowEligibleItem = {
  id: string;
  videoProjectId: string;
  title: string;
  channel: "TikTok" | "Instagram Reels" | "Facebook Reels" | "YouTube Shorts";
  caption: string;
  version: string;
  status: "APPROVED";
  thumbnailStoragePath: string | null;
  mediaStoragePath: string;
};

export async function GET() {
  try {
    const context = await requireWorkspaceContext();
    const admin = createAdminClient();

    const { data: projects, error: projectsError } = await admin
      .from("video_projects")
      .select("id,title,channel,caption,updated_at,media_asset_id,video_storage_path,status")
      .eq("workspace_id", context.workspaceId)
      .eq("status", "APPROVED")
      .not("video_storage_path", "is", null)
      .order("updated_at", { ascending: false })
      .limit(40);

    if (projectsError) {
      throw new Error(`POST_NOW_ELIGIBLE_FAILED:${projectsError.message}`);
    }

    const rows = (projects as Array<Record<string, unknown>> | null) || [];
    const projectIds = rows.map((row) => String(row.id || "")).filter(Boolean);

    const { data: publishedRows, error: publishedError } = await admin
      .from("scheduled_posts")
      .select("video_project_id,status")
      .eq("workspace_id", context.workspaceId)
      .in("status", ["PUBLISHING", "DELIVERED_TO_INBOX", "PUBLISHED"])
      .in("video_project_id", projectIds.length ? projectIds : ["__none__"]);

    if (publishedError) {
      throw new Error(`POST_NOW_PUBLISHED_LOOKUP_FAILED:${publishedError.message}`);
    }

    const publishedProjectIds = new Set(
      ((publishedRows as Array<Record<string, unknown>> | null) || [])
        .map((row) => String(row.video_project_id || ""))
        .filter(Boolean),
    );

    const mediaAssetIds = rows
      .map((row) => String(row.media_asset_id || ""))
      .filter(Boolean);

    const mediaById = new Map<string, string>();
    if (mediaAssetIds.length > 0) {
      const { data: mediaRows, error: mediaError } = await admin
        .from("media_assets")
        .select("id,thumbnail_path,poster_path,storage_path")
        .eq("workspace_id", context.workspaceId)
        .in("id", mediaAssetIds);
      if (mediaError) {
        throw new Error(`POST_NOW_MEDIA_LOOKUP_FAILED:${mediaError.message}`);
      }
      for (const mediaRow of (mediaRows as Array<Record<string, unknown>> | null) || []) {
        const mediaId = String(mediaRow.id || "");
        if (!mediaId) continue;
        const thumbnail = String(mediaRow.thumbnail_path || mediaRow.poster_path || mediaRow.storage_path || "") || "";
        mediaById.set(mediaId, thumbnail);
      }
    }

    const eligible: PostNowEligibleItem[] = rows
      .filter((row) => !publishedProjectIds.has(String(row.id || "")))
      .filter((row) =>
        isPostNowEligible({
          videoProjectId: String(row.id || ""),
          status: String(row.status || ""),
          videoStoragePath: String(row.video_storage_path || "") || null,
        }),
      )
      .map((row) => {
        const channel = String(row.channel || "TikTok") as PostNowEligibleItem["channel"];
        const mediaAssetId = String(row.media_asset_id || "");
        const videoStoragePath = String(row.video_storage_path || "");
        return {
          id: `post-now-${String(row.id || "")}`,
          videoProjectId: String(row.id || ""),
          title: String(row.title || "Completed video"),
          channel,
          caption: String(row.caption || ""),
          version: `v${String(row.updated_at || "").slice(0, 10)}`,
          status: "APPROVED",
          thumbnailStoragePath: mediaById.get(mediaAssetId) || videoStoragePath || null,
          mediaStoragePath: videoStoragePath,
        };
      });

    return NextResponse.json({ ok: true, data: eligible }, { headers: { "cache-control": "no-store" } });
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
