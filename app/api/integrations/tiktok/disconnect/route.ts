import { NextResponse } from "next/server";
import { resolveTikTokActor, safeTikTokError } from "@/app/api/integrations/tiktok/_lib";
import { TikTokConnectionService } from "@/features/integrations/tiktok/service";

export async function POST() {
  try {
    const actor = await resolveTikTokActor();
    const warning = await new TikTokConnectionService().disconnect(actor);
    return NextResponse.json({ ok: true, data: { warning } });
  } catch (error) {
    return safeTikTokError(error);
  }
}
