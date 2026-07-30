import { NextResponse } from "next/server";
import { resolveTikTokActor, safeTikTokError } from "@/app/api/integrations/tiktok/_lib";
import { TikTokConnectionService } from "@/features/integrations/tiktok/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await resolveTikTokActor();
    const data = await new TikTokConnectionService().getStatus(actor);
    return NextResponse.json(
      { ok: true, data },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return safeTikTokError(error);
  }
}
