import { NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import {
  resolveMediaRows,
  type MediaAssociation,
  type MediaUrlResolverRow,
} from "@/features/media/media-url-resolver";
import { filterRowsForWorkspace } from "@/features/media/workspace-access";

type ResolveRequest = {
  assetIds?: unknown;
};

function parseAssetIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 200);
}

export async function POST(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    const supabase = context.supabase;
    const workspaceId = context.workspaceId;

    const body = (await request.json().catch(() => null)) as ResolveRequest | null;
    const assetIds = parseAssetIds(body?.assetIds);
    if (!assetIds.length) {
      return NextResponse.json({ ok: true, assets: [] }, { headers: { "cache-control": "no-store" } });
    }

    const { data: rows, error } = await supabase
      .from("media_assets")
      .select(
        "id,workspace_id,file_name,asset_type,mime_type,storage_path,thumbnail_path,poster_path,size_bytes,tags,created_at,folder_id,source,generation_status,generation_job_id,width,height,duration_seconds,archived_at",
      )
      .eq("workspace_id", workspaceId)
      .in("id", assetIds)
      .is("archived_at", null);

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Unable to resolve media previews." },
        { status: 400 },
      );
    }

    const mediaRows = filterRowsForWorkspace(
      workspaceId,
      ((rows || []) as MediaUrlResolverRow[]).filter((row) => assetIds.includes(row.id)),
    );

    const { data: ugcRows } = await supabase
      .from("creator_ugc_assets")
      .select("media_library_asset_id,campaign_id,creator_id,usage_rights_start,usage_rights_end,approval_status")
      .in("media_library_asset_id", mediaRows.map((row) => row.id));

    const creatorIds = [...new Set(((ugcRows || []) as Array<{ creator_id?: string | null }>).map((row) => row.creator_id).filter(Boolean))] as string[];

    let creatorNameMap = new Map<string, string>();
    if (creatorIds.length) {
      const { data: creators } = await supabase
        .from("creators")
        .select("id,display_name")
        .in("id", creatorIds);
      creatorNameMap = new Map(
        ((creators || []) as Array<{ id: string; display_name: string }>).map((row) => [
          row.id,
          row.display_name,
        ]),
      );
    }

    const associations: MediaAssociation[] = ((ugcRows || []) as Array<{
      media_library_asset_id: string;
      campaign_id: string | null;
      creator_id: string | null;
      usage_rights_start: string | null;
      usage_rights_end: string | null;
      approval_status: string | null;
    }>).map((row) => ({
      mediaAssetId: row.media_library_asset_id,
      campaignId: row.campaign_id || undefined,
      creatorName: row.creator_id ? creatorNameMap.get(row.creator_id) : undefined,
      usageRightsStart: row.usage_rights_start || undefined,
      usageRightsEnd: row.usage_rights_end || undefined,
      approvalStatus: row.approval_status || undefined,
    }));

    const assets = await resolveMediaRows({
      rows: mediaRows,
      associations,
      storage: supabase.storage,
      downloadRoutePrefix: "/api/media/download",
    });

    return NextResponse.json(
      { ok: true, assets },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unable to resolve media previews.";
    return NextResponse.json(
      { ok: false, error: message || "Unable to resolve media previews." },
      { status: 500 },
    );
  }
}
