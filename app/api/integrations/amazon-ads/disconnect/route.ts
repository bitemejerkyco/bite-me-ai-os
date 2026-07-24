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
      confirmed?: boolean;
    };
    if (!body.connectionId) {
      throw new Error("DISCONNECT_INVALID:connectionId is required.");
    }
    if (!SAFE_REFERENCE.test(body.connectionId)) {
      throw new Error("DISCONNECT_INVALID:connectionId is malformed.");
    }
    const service = new AmazonAdsLiveConnectionService();
    const result = await service.disconnect({
      actor: session.actor,
      connectionId: body.connectionId,
      confirmed: body.confirmed === true,
    });
    const response = NextResponse.json({ ok: true, data: result });
    attachSessionCookie(response, session);
    return response;
  } catch (error) {
    return safeErrorResponse(error, 400);
  }
}
