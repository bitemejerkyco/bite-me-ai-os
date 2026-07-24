import { NextRequest, NextResponse } from "next/server";
import { AmazonAdsLiveConnectionService } from "@/features/marketing/providers/amazon-ads/live/connection-service";
import { attachSessionCookie, resolveAuthenticatedSession, safeErrorResponse } from "@/app/api/integrations/amazon-ads/_lib";

export async function GET(request: NextRequest) {
  try {
    const session = resolveAuthenticatedSession(request);
    const service = new AmazonAdsLiveConnectionService();
    const view = await service.getConnectionView(session.actor);
    const response = NextResponse.json({ ok: true, data: { ...view, csrfToken: session.csrfToken } });
    attachSessionCookie(response, session);
    return response;
  } catch (error) {
    return safeErrorResponse(error, 400);
  }
}
