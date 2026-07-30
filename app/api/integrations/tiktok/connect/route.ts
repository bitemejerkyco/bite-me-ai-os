import { NextResponse } from "next/server";
import { resolveTikTokActor, safeTikTokError } from "@/app/api/integrations/tiktok/_lib";
import { TikTokConnectionService } from "@/features/integrations/tiktok/service";

export async function GET() {
  try {
    const actor = await resolveTikTokActor();
    const service = new TikTokConnectionService();
    const authorizeUrl = await service.beginAuthorization(actor);
    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    return safeTikTokError(error);
  }
}
