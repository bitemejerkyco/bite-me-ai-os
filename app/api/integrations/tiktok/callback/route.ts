import { NextRequest, NextResponse } from "next/server";
import { resolveTikTokActor } from "@/app/api/integrations/tiktok/_lib";
import { writeAdminAuditEvent } from "@/features/admin/audit";
import { assertTikTokConfigured } from "@/features/integrations/tiktok/config";
import { TikTokConnectionService } from "@/features/integrations/tiktok/service";
import {
  hashOAuthState,
  redactTikTokSecrets,
  TIKTOK_OAUTH_STATE_COOKIE_NAME,
  validateTikTokOAuthState,
} from "@/features/integrations/tiktok/token-crypto";

const SETTINGS_PATH = "/settings/integrations/tiktok";
const MAX_OAUTH_VALUE_LENGTH = 2048;
const SAFE_AUTHORIZATION_CODE = /^[A-Za-z0-9._~!*'-]+$/u;
const SAFE_STATE = /^[A-Za-z0-9._~-]+$/u;

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
    !SAFE_AUTHORIZATION_CODE.test(code) ||
    !SAFE_STATE.test(state)
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
  const clearCookie = (response: NextResponse) => {
    response.cookies.set(TIKTOK_OAUTH_STATE_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/api/integrations/tiktok/callback",
    });
    return response;
  };
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
    const stateCookie = request.cookies.get(TIKTOK_OAUTH_STATE_COOKIE_NAME)?.value;
    if (!stateCookie) {
      throw new Error("TIKTOK_STATE_INVALID:OAuth state cookie is missing.");
    }
    try {
      validateTikTokOAuthState(stateCookie, input.state, config.encryptionKey, {
        userId: actor.userId,
        workspaceId: actor.workspaceId,
      });
    } catch (validationError) {
      await writeAdminAuditEvent({
        actorUserId: actor.userId,
        targetAccountId: actor.workspaceId,
        action: "tiktok_oauth_state_validation_failed",
        resourceType: "tiktok_oauth_state",
        resourceId: hashOAuthState(stateCookie),
        newValue: { workspaceId: actor.workspaceId, userId: actor.userId },
      });
      throw validationError;
    }
    const stateLookup = await actor.supabase
      .from("tiktok_oauth_states")
      .select("state_hash,expires_at,used_at")
      .eq("state_hash", hashOAuthState(input.state))
      .eq("workspace_id", actor.workspaceId)
      .eq("user_id", actor.userId)
      .maybeSingle();
    if (stateLookup.error) {
      throw new Error(`TIKTOK_STATE_LOOKUP_FAILED:${stateLookup.error.message}`);
    }
    if (!stateLookup.data) {
      throw new Error("TIKTOK_STATE_INVALID:Authorization state was not found.");
    }
    const storedState = stateLookup.data as { expires_at?: string | null; used_at?: string | null };
    if (storedState.used_at || new Date(String(storedState.expires_at || "")).getTime() <= Date.now()) {
      throw new Error("TIKTOK_STATE_INVALID:Authorization state is invalid or expired.");
    }
    const { error: usedError } = await actor.supabase
      .from("tiktok_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("state_hash", hashOAuthState(input.state))
      .eq("workspace_id", actor.workspaceId)
      .eq("user_id", actor.userId);
    if (usedError) {
      throw new Error(`TIKTOK_STATE_UPDATE_FAILED:${usedError.message}`);
    }
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
  return clearCookie(NextResponse.redirect(destination));
}
