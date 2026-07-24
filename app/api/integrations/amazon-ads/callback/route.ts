import { NextRequest, NextResponse } from "next/server";
import { AmazonAdsLiveConnectionService } from "@/features/marketing/providers/amazon-ads/live/connection-service";
import { assertAmazonAdsLiveConnectionEnabled } from "@/features/marketing/providers/amazon-ads/live/config";
import { resolveActor } from "@/app/api/integrations/amazon-ads/_lib";
import { redactSecrets } from "@/features/marketing/providers/amazon-ads/live/token-crypto";

export async function GET(request: NextRequest) {
  const actor = resolveActor(request);
  const destination = new URL("/settings/integrations/amazon-ads", request.url);
  destination.searchParams.set("workspaceId", actor.workspaceId);
  destination.searchParams.set("userId", actor.userId);

  try {
    const config = assertAmazonAdsLiveConnectionEnabled();
    const url = new URL(request.url);
    const callbackWithoutQuery = `${url.origin}${url.pathname}`;
    if (callbackWithoutQuery !== config.redirectUri) {
      throw new Error("OAUTH_REDIRECT_URI_MISMATCH:Callback URL does not match AMAZON_ADS_REDIRECT_URI.");
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) {
      throw new Error("OAUTH_CALLBACK_INVALID:Missing authorization code or state.");
    }
    if (url.searchParams.get("error")) {
      throw new Error("OAUTH_CALLBACK_DENIED:Authorization was denied by Amazon.");
    }

    const service = new AmazonAdsLiveConnectionService({ config });
    await service.completeAuthorization({ actor, state, code });
    destination.searchParams.set("result", "connected");
    return NextResponse.redirect(destination);
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : String(error));
    destination.searchParams.set("result", "error");
    destination.searchParams.set("message", message);
    return NextResponse.redirect(destination);
  }
}
