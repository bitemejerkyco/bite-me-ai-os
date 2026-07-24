import { NextRequest, NextResponse } from "next/server";
import { AmazonAdsLiveConnectionService } from "@/features/marketing/providers/amazon-ads/live/connection-service";
import { resolveActor, safeErrorResponse } from "@/app/api/integrations/amazon-ads/_lib";

export async function GET(request: NextRequest) {
  try {
    const actor = resolveActor(request);
    const service = new AmazonAdsLiveConnectionService();
    const result = await service.beginAuthorization(actor);
    return NextResponse.redirect(result.authorizeUrl);
  } catch (error) {
    return safeErrorResponse(error, 400);
  }
}
