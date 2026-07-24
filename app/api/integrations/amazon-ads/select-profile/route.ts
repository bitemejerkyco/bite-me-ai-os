import { NextRequest, NextResponse } from "next/server";
import { AmazonAdsLiveConnectionService } from "@/features/marketing/providers/amazon-ads/live/connection-service";
import { resolveActor, safeErrorResponse } from "@/app/api/integrations/amazon-ads/_lib";

export async function POST(request: NextRequest) {
  try {
    const actor = resolveActor(request);
    const body = (await request.json()) as {
      connectionId?: string;
      profileId?: string;
      marketplaceId?: string;
    };
    if (!body.connectionId || !body.profileId || !body.marketplaceId) {
      throw new Error("PROFILE_SELECTION_INVALID:connectionId, profileId, and marketplaceId are required.");
    }

    const service = new AmazonAdsLiveConnectionService();
    await service.selectProfile({
      actor,
      connectionId: body.connectionId,
      profileId: body.profileId,
      marketplaceId: body.marketplaceId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return safeErrorResponse(error, 400);
  }
}
