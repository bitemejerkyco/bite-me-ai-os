import { NextResponse } from "next/server";
import { resolveTikTokActor, safeTikTokError } from "@/app/api/integrations/tiktok/_lib";
import { writeAdminAuditEvent } from "@/features/admin/audit";
import { assertTikTokConfigured } from "@/features/integrations/tiktok/config";
import { TikTokConnectionService } from "@/features/integrations/tiktok/service";
import {
  createTikTokOAuthState,
  createTikTokOAuthStateCookie,
  hashOAuthState,
} from "@/features/integrations/tiktok/token-crypto";

export async function GET() {
  try {
    const actor = await resolveTikTokActor();
    const service = new TikTokConnectionService();
    const config = assertTikTokConfigured();
    const state = createTikTokOAuthState(
      {
        userId: actor.userId,
        workspaceId: actor.workspaceId,
        expiresAt: Date.now() + 10 * 60 * 1000,
      },
      config.encryptionKey,
    );
    const { error } = await actor.supabase.from("tiktok_oauth_states").insert({
      state_hash: hashOAuthState(state),
      workspace_id: actor.workspaceId,
      user_id: actor.userId,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) {
      throw new Error(`TIKTOK_STATE_STORE_FAILED:${error.message}`);
    }
    await writeAdminAuditEvent({
      actorUserId: actor.userId,
      targetAccountId: actor.workspaceId,
      action: "tiktok_oauth_state_created",
      resourceType: "tiktok_oauth_state",
      resourceId: hashOAuthState(state),
      newValue: { workspaceId: actor.workspaceId, userId: actor.userId },
    });
    const authorizeUrl = await service.beginAuthorization(actor, state);
    const response = NextResponse.redirect(authorizeUrl);
    const cookie = createTikTokOAuthStateCookie(
      {
        userId: actor.userId,
        workspaceId: actor.workspaceId,
        expiresAt: Date.now() + 10 * 60 * 1000,
      },
      config.encryptionKey,
    );
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    return safeTikTokError(error);
  }
}
