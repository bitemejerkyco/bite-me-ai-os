import { NextRequest, NextResponse } from "next/server";
import { resolveTikTokActor } from "@/app/api/integrations/tiktok/_lib";
import { assertTikTokConfigured } from "@/features/integrations/tiktok/config";
import { TikTokConnectionService } from "@/features/integrations/tiktok/service";
import { redactTikTokSecrets } from "@/features/integrations/tiktok/token-crypto";

const SETTINGS_PATH = "/settings/integrations/tiktok";
const MAX_OAUTH_VALUE_LENGTH = 2048;
const SAFE_OAUTH_VALUE = /^[A-Za-z0-9._~-]+$/u;

export function parseTikTokCallback(url: URL): {
  code: string;
  state: string;
  scopes: string[];
} {
  const error = (url.searchParams.get("error") || "").trim();
  if (error) {
    throw new Error(`TIKTOK_AUTH_DENIED:${error}.`);
  }
  const code = (url.searchParams.get("code") || "").trim();
  const state = (url.searchParams.get("state") || "").trim();
  if (!code || !state) {
    throw new Error("TIKTOK_CALLBACK_INVALID:Missing authorization code or state.");
  }
  if (
    code.length > MAX_OAUTH_VALUE_LENGTH ||
    state.length > MAX_OAUTH_VALUE_LENGTH ||
    !SAFE_OAUTH_VALUE.test(code) ||
    !SAFE_OAUTH_VALUE.test(state)
  ) {
    throw new Error("TIKTOK_CALLBACK_INVALID:Authorization response is malformed.");
  }
  const scopes = (url.searchParams.get("scopes") || "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  return { code, state, scopes };
}

export async function GET(request: NextRequest) {
  const destination = new URL(SETTINGS_PATH, request.url);
  try {
    const config = assertTikTokConfigured();
    const requestUrl = new URL(request.url);
    const callbackUrl = `${requestUrl.origin}${requestUrl.pathname}`;
    if (callbackUrl !== config.redirectUri) {
      throw new Error(
        "TIKTOK_REDIRECT_MISMATCH:Callback URL does not match TIKTOK_REDIRECT_URI.",
      );
    }
    const actor = await resolveTikTokActor();
    const input = parseTikTokCallback(requestUrl);
    await new TikTokConnectionService({ config }).completeAuthorization(
      actor,
      input,
    );
    destination.searchParams.set("result", "connected");
  } catch (error) {
    destination.searchParams.set("result", "error");
    destination.searchParams.set(
      "message",
      redactTikTokSecrets(error instanceof Error ? error.message : String(error)),
    );
  }
  return NextResponse.redirect(destination);
}
