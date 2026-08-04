import { NextResponse } from "next/server";
import { resolveTikTokActor, safeTikTokError } from "@/app/api/integrations/tiktok/_lib";
import { TikTokPublishJobService } from "@/features/integrations/tiktok/publish-jobs";

export async function GET(request: Request) {
  try {
    const actor = await resolveTikTokActor();
    const url = new URL(request.url);
    const mediaAssetId = String(url.searchParams.get("mediaAssetId") || "").trim();
    if (!mediaAssetId) {
      throw new Error("TIKTOK_MEDIA_INVALID:Choose a READY video before posting.");
    }

    const preflight = await new TikTokPublishJobService().getTikTokPublishPreflight(
      actor,
      mediaAssetId,
    );

    return NextResponse.json(
      { ok: true, data: preflight },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return safeTikTokError(error);
  }
}
