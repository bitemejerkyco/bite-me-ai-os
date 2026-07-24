import { NextRequest, NextResponse } from "next/server";
import { AmazonAdsLiveConnectionService } from "@/features/marketing/providers/amazon-ads/live/connection-service";
import {
  assertCsrfToken,
  assertTrustedPostRequest,
  attachSessionCookie,
  resolveAuthenticatedSession,
  safeErrorResponse,
} from "@/app/api/integrations/amazon-ads/_lib";

const SAFE_REFERENCE = /^[A-Za-z0-9._:-]{1,200}$/;

export async function POST(request: NextRequest) {
  try {
    assertTrustedPostRequest(request);
    const session = resolveAuthenticatedSession(request);
    assertCsrfToken(request, session.csrfToken);
    const body = (await request.json()) as {
      connectionId?: string;
      profileId?: string;
      marketplaceId?: string;
    };
    if (!body.connectionId || !body.profileId || !body.marketplaceId) {
      throw new Error("PROFILE_SELECTION_INVALID:connectionId, profileId, and marketplaceId are required.");
    }
    if (
      !SAFE_REFERENCE.test(body.connectionId) ||
      !SAFE_REFERENCE.test(body.profileId) ||
      !SAFE_REFERENCE.test(body.marketplaceId)
    ) {
      throw new Error("PROFILE_SELECTION_INVALID:connectionId, profileId, or marketplaceId is malformed.");
    }

    const service = new AmazonAdsLiveConnectionService();
    await service.selectProfile({
      actor: session.actor,
      connectionId: body.connectionId,
      profileId: body.profileId,
      marketplaceId: body.marketplaceId,
    });
    const response = NextResponse.json({ ok: true });
    attachSessionCookie(response, session);
    return response;
  } catch (error) {
    return safeErrorResponse(error, 400);
  }
}
