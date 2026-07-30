import type {
  TikTokCreatorInfo,
  TikTokTokenResponse,
} from "@/features/integrations/tiktok/types";
import type { TikTokConfig } from "@/features/integrations/tiktok/config";

const AUTHORIZE_ENDPOINT = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_ENDPOINT = "https://open.tiktokapis.com/v2/oauth/token/";
const REVOKE_ENDPOINT = "https://open.tiktokapis.com/v2/oauth/revoke/";
const USER_INFO_ENDPOINT = "https://open.tiktokapis.com/v2/user/info/";
const CREATOR_INFO_ENDPOINT =
  "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";

type TikTokClientDependencies = {
  fetchImpl?: typeof fetch;
};

type TokenPayload = {
  access_token?: string;
  refresh_token?: string;
  open_id?: string;
  scope?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  error?: string;
  error_description?: string;
};

function encodeForm(values: Record<string, string>): string {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return body.toString();
}

async function parseTokenResponse(response: Response): Promise<TikTokTokenResponse> {
  const payload = (await response.json()) as TokenPayload;
  if (
    !response.ok ||
    !payload.access_token ||
    !payload.refresh_token ||
    !payload.open_id ||
    !payload.expires_in ||
    !payload.refresh_expires_in
  ) {
    throw new Error(
      `TIKTOK_TOKEN_FAILED:${payload.error || "token_request_failed"} (${response.status}).`,
    );
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    openId: payload.open_id,
    scope: (payload.scope || "")
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean),
    expiresInSeconds: payload.expires_in,
    refreshExpiresInSeconds: payload.refresh_expires_in,
  };
}

export class TikTokApiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly config: TikTokConfig,
    dependencies: TikTokClientDependencies = {},
  ) {
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
  }

  buildAuthorizeUrl(state: string): string {
    const url = new URL(AUTHORIZE_ENDPOINT);
    url.searchParams.set("client_key", this.config.clientKey);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", this.config.scopes.join(","));
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("disable_auto_auth", "1");
    return url.toString();
  }

  async exchangeCode(code: string): Promise<TikTokTokenResponse> {
    const response = await this.fetchImpl(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "cache-control": "no-cache",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: encodeForm({
        client_key: this.config.clientKey,
        client_secret: this.config.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.config.redirectUri,
      }),
    });
    return parseTokenResponse(response);
  }

  async refreshToken(refreshToken: string): Promise<TikTokTokenResponse> {
    const response = await this.fetchImpl(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "cache-control": "no-cache",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: encodeForm({
        client_key: this.config.clientKey,
        client_secret: this.config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    return parseTokenResponse(response);
  }

  async revoke(accessToken: string): Promise<void> {
    const response = await this.fetchImpl(REVOKE_ENDPOINT, {
      method: "POST",
      headers: {
        "cache-control": "no-cache",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: encodeForm({
        client_key: this.config.clientKey,
        client_secret: this.config.clientSecret,
        token: accessToken,
      }),
    });
    if (!response.ok) {
      throw new Error(`TIKTOK_REVOKE_FAILED:TikTok returned ${response.status}.`);
    }
  }

  async queryCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
    const response = await this.fetchImpl(CREATOR_INFO_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json; charset=UTF-8",
      },
    });
    const payload = (await response.json()) as {
      data?: {
        creator_avatar_url?: string;
        creator_username?: string;
        creator_nickname?: string;
        privacy_level_options?: string[];
        comment_disabled?: boolean;
        duet_disabled?: boolean;
        stitch_disabled?: boolean;
        max_video_post_duration_sec?: number;
      };
      error?: { code?: string };
    };
    if (!response.ok || payload.error?.code !== "ok" || !payload.data) {
      throw new Error(
        `TIKTOK_CREATOR_INFO_FAILED:${payload.error?.code || response.status}.`,
      );
    }
    return {
      avatarUrl: payload.data.creator_avatar_url || null,
      username: payload.data.creator_username || null,
      nickname: payload.data.creator_nickname || null,
      privacyLevelOptions: Array.isArray(payload.data.privacy_level_options)
        ? payload.data.privacy_level_options.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
      commentDisabled: Boolean(payload.data.comment_disabled),
      duetDisabled: Boolean(payload.data.duet_disabled),
      stitchDisabled: Boolean(payload.data.stitch_disabled),
      maxVideoDurationSeconds:
        typeof payload.data.max_video_post_duration_sec === "number"
          ? payload.data.max_video_post_duration_sec
          : null,
    };
  }

  async queryBasicUserInfo(accessToken: string): Promise<TikTokCreatorInfo> {
    const url = new URL(USER_INFO_ENDPOINT);
    url.searchParams.set("fields", "open_id,avatar_url,display_name");
    const response = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = (await response.json()) as {
      data?: {
        user?: {
          avatar_url?: string;
          display_name?: string;
        };
      };
      error?: { code?: string };
    };
    if (!response.ok || payload.error?.code !== "ok" || !payload.data?.user) {
      throw new Error(
        `TIKTOK_USER_INFO_FAILED:${payload.error?.code || response.status}.`,
      );
    }
    return {
      avatarUrl: payload.data.user.avatar_url || null,
      username: null,
      nickname: payload.data.user.display_name || null,
      privacyLevelOptions: [],
      commentDisabled: false,
      duetDisabled: false,
      stitchDisabled: false,
      maxVideoDurationSeconds: null,
    };
  }
}
