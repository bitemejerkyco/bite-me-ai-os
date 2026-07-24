import { NextRequest, NextResponse } from "next/server";
import { AmazonAdsLiveConnectionService } from "@/features/marketing/providers/amazon-ads/live/connection-service";
import { assertAmazonAdsLiveConnectionEnabled } from "@/features/marketing/providers/amazon-ads/live/config";
import { AMAZON_ADS_OAUTH_SCOPE } from "@/features/marketing/providers/amazon-ads/live/oauth-client";
import { attachSessionCookie, resolveAuthenticatedSession } from "@/app/api/integrations/amazon-ads/_lib";
import { redactSecrets } from "@/features/marketing/providers/amazon-ads/live/token-crypto";

const POST_CALLBACK_DESTINATION = "/settings/integrations/amazon-ads";
const MAX_OAUTH_INPUT_LENGTH = 2048;
const SAFE_OAUTH_TOKEN = /^[A-Za-z0-9._~-]+$/;

export function validateOAuthCallbackQuery(url: URL): { code: string; state: string } {
  const code = (url.searchParams.get("code") || "").trim();
  const state = (url.searchParams.get("state") || "").trim();
  const scope = (url.searchParams.get("scope") || "").trim();
  if (!code || !state) {
    throw new Error("OAUTH_CALLBACK_INVALID:Missing authorization code or state.");
  }
  if (code.length > MAX_OAUTH_INPUT_LENGTH || state.length > MAX_OAUTH_INPUT_LENGTH) {
    throw new Error("OAUTH_CALLBACK_INVALID:Authorization code or state is too large.");
  }
  if (!SAFE_OAUTH_TOKEN.test(code) || !SAFE_OAUTH_TOKEN.test(state)) {
    throw new Error("OAUTH_CALLBACK_INVALID:Authorization code or state is malformed.");
  }
  if (scope && scope !== AMAZON_ADS_OAUTH_SCOPE) {
    throw new Error("OAUTH_SCOPE_INVALID:Unexpected OAuth scope returned by provider.");
  }
  return { code, state };
}

export async function GET(request: NextRequest) {
  const destination = new URL(POST_CALLBACK_DESTINATION, request.url);

  try {
    const session = resolveAuthenticatedSession(request);
    const config = assertAmazonAdsLiveConnectionEnabled();
    const url = new URL(request.url);
    const callbackWithoutQuery = `${url.origin}${url.pathname}`;
    if (callbackWithoutQuery !== config.redirectUri) {
      throw new Error("OAUTH_REDIRECT_URI_MISMATCH:Callback URL does not match AMAZON_ADS_REDIRECT_URI.");
    }

    const { code, state } = validateOAuthCallbackQuery(url);
    if (url.searchParams.get("error")) {
      throw new Error("OAUTH_CALLBACK_DENIED:Authorization was denied by Amazon.");
    }

    const service = new AmazonAdsLiveConnectionService({ config });
    await service.completeAuthorization({ actor: session.actor, state, code });
    destination.searchParams.set("result", "connected");
    const response = NextResponse.redirect(destination);
    attachSessionCookie(response, session);
    return response;
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : String(error));
    destination.searchParams.set("result", "error");
    destination.searchParams.set("message", message);
    return NextResponse.redirect(destination);
  }
}
