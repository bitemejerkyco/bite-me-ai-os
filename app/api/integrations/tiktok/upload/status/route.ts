import { NextRequest, NextResponse } from "next/server";
import {
  resolveTikTokActor,
  safeTikTokError,
} from "@/app/api/integrations/tiktok/_lib";
import { TikTokConnectionService } from "@/features/integrations/tiktok/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as { scheduledPostId?: unknown };
    const scheduledPostId = String(input.scheduledPostId || "").trim();
    if (!UUID.test(scheduledPostId)) {
      throw new Error("TIKTOK_POST_INVALID:Choose a valid TikTok delivery.");
    }
    const actor = await resolveTikTokActor();
    const data = await new TikTokConnectionService().refreshScheduledVideoStatus(
      actor,
      scheduledPostId,
    );
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return safeTikTokError(error);
  }
}
