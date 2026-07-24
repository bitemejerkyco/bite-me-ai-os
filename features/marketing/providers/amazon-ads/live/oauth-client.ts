import { assertAmazonAdsReadOnlyOperation } from "@/features/marketing/providers/amazon-ads/live/read-only-allowlist";

type OAuthTokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
};

type RefreshTokenResponse = {
  accessToken: string;
  expiresInSeconds: number;
};

type ProfileResponseRow = {
  profileId: string;
  accountInfo?: {
    id?: string;
    type?: string;
    name?: string;
  };
  countryCode?: string;
  currencyCode?: string;
};

type AmazonAdsOAuthClientInput = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
};

const AUTH_BASE = "https://www.amazon.com/ap/oa";
const TOKEN_ENDPOINT = "https://api.amazon.com/auth/o2/token";
const REVOKE_ENDPOINT = "https://api.amazon.com/auth/o2/token/revoke";
const ADS_API_BASE = "https://advertising-api.amazon.com";

function encodeForm(values: Record<string, string>): string {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return body.toString();
}

function toSafeMessage(code: string, status: number): string {
  return `${code}:Amazon Ads authorization request failed (${status}).`;
}

export class AmazonAdsOAuthClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly input: AmazonAdsOAuthClientInput) {
    this.fetchImpl = input.fetchImpl ?? fetch;
  }

  buildAuthorizeUrl(state: string): string {
    assertAmazonAdsReadOnlyOperation("oauth_authorize");
    const url = new URL(AUTH_BASE);
    url.searchParams.set("client_id", this.input.clientId);
    url.searchParams.set("scope", "advertising::campaign_management");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", this.input.redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeAuthorizationCode(code: string): Promise<OAuthTokenResponse> {
    assertAmazonAdsReadOnlyOperation("oauth_token_exchange");
    const response = await this.fetchImpl(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: encodeForm({
        grant_type: "authorization_code",
        code,
        client_id: this.input.clientId,
        client_secret: this.input.clientSecret,
        redirect_uri: this.input.redirectUri,
      }),
    });
    if (!response.ok) {
      throw new Error(toSafeMessage("OAUTH_TOKEN_EXCHANGE_FAILED", response.status));
    }
    const payload = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!payload.access_token || !payload.refresh_token || !payload.expires_in) {
      throw new Error("OAUTH_TOKEN_EXCHANGE_FAILED:Amazon token response was incomplete.");
    }
    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresInSeconds: payload.expires_in,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<RefreshTokenResponse> {
    assertAmazonAdsReadOnlyOperation("oauth_token_refresh");
    const response = await this.fetchImpl(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: encodeForm({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.input.clientId,
        client_secret: this.input.clientSecret,
      }),
    });
    if (!response.ok) {
      throw new Error(toSafeMessage("OAUTH_TOKEN_REFRESH_FAILED", response.status));
    }
    const payload = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!payload.access_token || !payload.expires_in) {
      throw new Error("OAUTH_TOKEN_REFRESH_FAILED:Amazon refresh response was incomplete.");
    }
    return {
      accessToken: payload.access_token,
      expiresInSeconds: payload.expires_in,
    };
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    assertAmazonAdsReadOnlyOperation("oauth_token_revoke");
    const response = await this.fetchImpl(REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: encodeForm({
        token: refreshToken,
        client_id: this.input.clientId,
        client_secret: this.input.clientSecret,
      }),
    });
    if (!response.ok) {
      throw new Error(toSafeMessage("OAUTH_TOKEN_REVOKE_FAILED", response.status));
    }
  }

  async discoverProfiles(accessToken: string): Promise<ProfileResponseRow[]> {
    assertAmazonAdsReadOnlyOperation("profile_discovery");
    const response = await this.fetchImpl(`${ADS_API_BASE}/v2/profiles`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "amazon-advertising-api-clientId": this.input.clientId,
      },
    });
    if (!response.ok) {
      throw new Error(toSafeMessage("PROFILE_DISCOVERY_FAILED", response.status));
    }
    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) {
      throw new Error("PROFILE_DISCOVERY_FAILED:Amazon profile response was invalid.");
    }
    return payload as ProfileResponseRow[];
  }
}

export type {
  OAuthTokenResponse,
  RefreshTokenResponse,
  ProfileResponseRow,
};
