import { NextRequest, NextResponse } from "next/server";
import { AmazonAdsLiveConnectionService } from "@/features/marketing/providers/amazon-ads/live/connection-service";
import { resolveActor, safeErrorResponse } from "@/app/api/integrations/amazon-ads/_lib";

export async function POST(request: NextRequest) {
  try {
    const actor = resolveActor(request);
    const body = (await request.json()) as {
      connectionId?: string;
      confirmed?: boolean;
    };
    if (!body.connectionId) {
      throw new Error("DISCONNECT_INVALID:connectionId is required.");
    }
    const service = new AmazonAdsLiveConnectionService();
    await service.disconnect({
      actor,
      connectionId: body.connectionId,
      confirmed: body.confirmed === true,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return safeErrorResponse(error, 400);
  }
}
