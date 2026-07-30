import { randomBytes } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";
import {
  getMissingTikTokConfig,
  loadTikTokConfig,
  type TikTokConfig,
} from "@/features/integrations/tiktok/config";
import { TikTokApiClient } from "@/features/integrations/tiktok/client";
import {
  decryptTikTokToken,
  encryptTikTokToken,
  hashOAuthState,
} from "@/features/integrations/tiktok/token-crypto";
import {
  TIKTOK_REQUIRED_SCOPES,
  type TikTokConnectionView,
  type TikTokCreatorInfo,
} from "@/features/integrations/tiktok/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type TikTokActor = {
  supabase: SupabaseServerClient;
  userId: string;
  workspaceId: string;
};

type TikTokConnectionRow = {
  id: string;
  workspace_id: string;
  connected_by: string;
  status: "CONNECTING" | "CONNECTED" | "EXPIRED" | "ERROR";
  open_id: string;
  scopes: string[];
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  access_expires_at: string;
  refresh_expires_at: string;
  creator_username: string | null;
  creator_nickname: string | null;
  creator_avatar_url: string | null;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_duration_seconds: number | null;
  last_error: string | null;
};

type ServiceDependencies = {
  config?: TikTokConfig;
  client?: TikTokApiClient;
  now?: () => Date;
};

const STATE_TTL_MILLISECONDS = 10 * 60 * 1000;

function expiresAt(now: Date, seconds: number): string {
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

function creatorFromRow(row: TikTokConnectionRow): TikTokCreatorInfo {
  return {
    avatarUrl: row.creator_avatar_url,
    username: row.creator_username,
    nickname: row.creator_nickname,
    privacyLevelOptions: row.privacy_level_options || [],
    commentDisabled: row.comment_disabled,
    duetDisabled: row.duet_disabled,
    stitchDisabled: row.stitch_disabled,
    maxVideoDurationSeconds: row.max_video_duration_seconds,
  };
}

function missingScopes(scopes: string[]): string[] {
  return TIKTOK_REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope));
}

export class TikTokConnectionService {
  private readonly config: TikTokConfig;
  private readonly client: TikTokApiClient;
  private readonly now: () => Date;

  constructor(dependencies: ServiceDependencies = {}) {
    this.config = dependencies.config ?? loadTikTokConfig();
    this.client = dependencies.client ?? new TikTokApiClient(this.config);
    this.now = dependencies.now ?? (() => new Date());
  }

  getConfiguration(): { configured: boolean; message: string | null } {
    const missing = getMissingTikTokConfig(this.config);
    return {
      configured: missing.length === 0,
      message:
        missing.length > 0
          ? `TikTok sandbox setup requires: ${missing.join(", ")}.`
          : null,
    };
  }

  async beginAuthorization(actor: TikTokActor): Promise<string> {
    const availability = this.getConfiguration();
    if (!availability.configured) {
      throw new Error(`TIKTOK_SETUP_REQUIRED:${availability.message}`);
    }
    const state = randomBytes(32).toString("base64url");
    const stateHash = hashOAuthState(state);
    const now = this.now();
    await actor.supabase
      .from("tiktok_oauth_states")
      .delete()
      .eq("user_id", actor.userId)
      .lt("expires_at", now.toISOString());
    const { error } = await actor.supabase.from("tiktok_oauth_states").insert({
      state_hash: stateHash,
      workspace_id: actor.workspaceId,
      user_id: actor.userId,
      expires_at: new Date(
        now.getTime() + STATE_TTL_MILLISECONDS,
      ).toISOString(),
    });
    if (error) throw new Error(`TIKTOK_STATE_FAILED:${error.message}`);
    return this.client.buildAuthorizeUrl(state);
  }

  async completeAuthorization(
    actor: TikTokActor,
    input: { state: string; code: string; scopes: string[] },
  ): Promise<void> {
    const stateHash = hashOAuthState(input.state);
    const { data: stateRow, error: stateError } = await actor.supabase
      .from("tiktok_oauth_states")
      .select("state_hash,workspace_id,user_id,expires_at,used_at")
      .eq("state_hash", stateHash)
      .eq("workspace_id", actor.workspaceId)
      .eq("user_id", actor.userId)
      .maybeSingle();
    if (stateError) throw new Error(`TIKTOK_STATE_FAILED:${stateError.message}`);
    if (
      !stateRow ||
      stateRow.used_at ||
      new Date(String(stateRow.expires_at)).getTime() <= this.now().getTime()
    ) {
      throw new Error("TIKTOK_STATE_INVALID:Authorization state is invalid or expired.");
    }
    const { error: consumeError } = await actor.supabase
      .from("tiktok_oauth_states")
      .update({ used_at: this.now().toISOString() })
      .eq("state_hash", stateHash)
      .is("used_at", null);
    if (consumeError) {
      throw new Error(`TIKTOK_STATE_FAILED:${consumeError.message}`);
    }

    const tokens = await this.client.exchangeCode(input.code);
    const grantedScopes = Array.from(
      new Set([...tokens.scope, ...input.scopes]),
    ).sort();
    const absent = missingScopes(grantedScopes);
    if (absent.length > 0) {
      throw new Error(
        `TIKTOK_SCOPE_MISSING:Authorization did not grant ${absent.join(", ")}.`,
      );
    }
    const creator = await this.client.queryCreatorInfo(tokens.accessToken);
    const now = this.now();
    const row = {
      workspace_id: actor.workspaceId,
      connected_by: actor.userId,
      environment: "SANDBOX",
      status: "CONNECTED",
      open_id: tokens.openId,
      scopes: grantedScopes,
      access_token_ciphertext: encryptTikTokToken(
        tokens.accessToken,
        this.config.encryptionKey,
      ),
      refresh_token_ciphertext: encryptTikTokToken(
        tokens.refreshToken,
        this.config.encryptionKey,
      ),
      access_expires_at: expiresAt(now, tokens.expiresInSeconds),
      refresh_expires_at: expiresAt(now, tokens.refreshExpiresInSeconds),
      creator_username: creator.username,
      creator_nickname: creator.nickname,
      creator_avatar_url: creator.avatarUrl,
      privacy_level_options: creator.privacyLevelOptions,
      comment_disabled: creator.commentDisabled,
      duet_disabled: creator.duetDisabled,
      stitch_disabled: creator.stitchDisabled,
      max_video_duration_seconds: creator.maxVideoDurationSeconds,
      last_error: null,
      connected_at: now.toISOString(),
    };
    const { error } = await actor.supabase
      .from("tiktok_connections")
      .upsert(row, { onConflict: "workspace_id" });
    if (error) throw new Error(`TIKTOK_CONNECTION_FAILED:${error.message}`);
  }

  async getStatus(actor: TikTokActor): Promise<TikTokConnectionView> {
    const availability = this.getConfiguration();
    const { data, error } = await actor.supabase
      .from("tiktok_connections")
      .select(
        "id,workspace_id,connected_by,status,open_id,scopes,access_token_ciphertext,refresh_token_ciphertext,access_expires_at,refresh_expires_at,creator_username,creator_nickname,creator_avatar_url,privacy_level_options,comment_disabled,duet_disabled,stitch_disabled,max_video_duration_seconds,last_error",
      )
      .eq("workspace_id", actor.workspaceId)
      .maybeSingle();
    if (error) throw new Error(`TIKTOK_STATUS_FAILED:${error.message}`);
    if (!data) {
      return {
        configured: availability.configured,
        sandboxMode: true,
        status: "disconnected",
        message: availability.message,
        connectionId: null,
        openId: null,
        scopes: [],
        accessExpiresAt: null,
        refreshExpiresAt: null,
        creator: null,
        postingMode: "SANDBOX_PRIVATE_ONLY",
      };
    }
    const row = data as TikTokConnectionRow;
    const refreshExpired =
      new Date(row.refresh_expires_at).getTime() <= this.now().getTime();
    return {
      configured: availability.configured,
      sandboxMode: true,
      status: refreshExpired
        ? "expired"
        : row.status === "CONNECTED"
          ? "connected"
          : row.status === "CONNECTING"
            ? "connecting"
            : row.status === "ERROR"
              ? "error"
              : "expired",
      message: refreshExpired
        ? "TikTok authorization expired. Reconnect the account."
        : row.last_error || availability.message,
      connectionId: row.id,
      openId: row.open_id,
      scopes: row.scopes || [],
      accessExpiresAt: row.access_expires_at,
      refreshExpiresAt: row.refresh_expires_at,
      creator: creatorFromRow(row),
      postingMode: "SANDBOX_PRIVATE_ONLY",
    };
  }

  async disconnect(actor: TikTokActor): Promise<string | null> {
    const { data, error } = await actor.supabase
      .from("tiktok_connections")
      .select(
        "id,workspace_id,connected_by,status,open_id,scopes,access_token_ciphertext,refresh_token_ciphertext,access_expires_at,refresh_expires_at,creator_username,creator_nickname,creator_avatar_url,privacy_level_options,comment_disabled,duet_disabled,stitch_disabled,max_video_duration_seconds,last_error",
      )
      .eq("workspace_id", actor.workspaceId)
      .maybeSingle();
    if (error) throw new Error(`TIKTOK_DISCONNECT_FAILED:${error.message}`);
    if (!data) return null;
    let warning: string | null = null;
    try {
      const accessToken = decryptTikTokToken(
        String(data.access_token_ciphertext),
        this.config.encryptionKey,
      );
      await this.client.revoke(accessToken);
    } catch {
      warning =
        "The local connection was removed, but TikTok token revocation could not be confirmed.";
    }
    const { error: deleteError } = await actor.supabase
      .from("tiktok_connections")
      .delete()
      .eq("workspace_id", actor.workspaceId)
      .eq("connected_by", actor.userId);
    if (deleteError) {
      throw new Error(`TIKTOK_DISCONNECT_FAILED:${deleteError.message}`);
    }
    return warning;
  }
}
