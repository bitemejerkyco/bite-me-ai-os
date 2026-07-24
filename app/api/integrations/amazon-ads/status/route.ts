import { NextRequest, NextResponse } from "next/server";
import { AmazonAdsLiveConnectionService } from "@/features/marketing/providers/amazon-ads/live/connection-service";
import {
  attachSessionCookie,
  resolveAuthenticationSessionOrNull,
  safeErrorResponse,
} from "@/app/api/integrations/amazon-ads/_lib";
import { getAmazonAdsLiveFeatureEnabled } from "@/features/marketing/providers/amazon-ads/live/config";

export async function GET(request: NextRequest) {
  try {
    const resolvedAuth = resolveAuthenticationSessionOrNull(request);
    if (!resolvedAuth.session) {
      return NextResponse.json({
        ok: true,
        data: {
          connectionId: null,
          status: "disconnected",
          featureEnabled: getAmazonAdsLiveFeatureEnabled(),
          liveReadOnly: true,
          noCampaignChanges: true,
          profiles: [],
          selectedProfileId: null,
          selectedMarketplaceId: null,
          expiresAt: null,
          message: "Authentication setup required.",
          connectEnabled: false,
          csrfToken: "",
        },
      });
    }
    const session = resolvedAuth.session;
    const service = new AmazonAdsLiveConnectionService();
    const view = await service.getConnectionView(session.actor);
    const response = NextResponse.json({ ok: true, data: { ...view, csrfToken: session.csrfToken } });
    attachSessionCookie(response, session);
    return response;
  } catch (error) {
    return safeErrorResponse(error, 400);
  }
}
