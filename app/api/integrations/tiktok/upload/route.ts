import { NextRequest, NextResponse } from "next/server";
import {
  resolveTikTokActor,
  safeTikTokError,
} from "@/app/api/integrations/tiktok/_lib";
import { TikTokConnectionService } from "@/features/integrations/tiktok/service";
import { TikTokPublishJobService } from "@/features/integrations/tiktok/publish-jobs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as {
      mediaAssetId?: unknown;
      caption?: unknown;
      hashtags?: unknown;
      consent?: unknown;
      scheduledPostId?: unknown;
    };
    const actor = await resolveTikTokActor();
    const mediaAssetId = String(input.mediaAssetId || "").trim();
    if (mediaAssetId) {
      const caption = String(input.caption || "").trim();
      const hashtags = Array.isArray(input.hashtags)
        ? input.hashtags.map((value) => String(value || "").trim()).filter(Boolean)
        : [];
      const consent = input.consent === true || String(input.consent || "").toLowerCase() === "true";
      const service = new TikTokPublishJobService();
      const job = await service.createTikTokPublishJob(actor, {
        mediaAssetId,
        caption,
        hashtags,
        consent,
      });
      const initialized = await service.initializeTikTokInboxUpload(actor, job.id);
      return NextResponse.json({ ok: true, data: initialized }, { headers: { "cache-control": "no-store" } });
    }
    const scheduledPostId = String(input.scheduledPostId || "").trim();
    if (!UUID.test(scheduledPostId)) {
      throw new Error("TIKTOK_POST_INVALID:Choose a valid completed video.");
    }
    const publishId = await new TikTokConnectionService().sendScheduledVideoToInbox(
      actor,
      scheduledPostId,
    );
    return NextResponse.json({ ok: true, data: { publishId } }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return safeTikTokError(error);
  }
}
