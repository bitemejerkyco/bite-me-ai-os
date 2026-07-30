import { describe, expect, it } from "vitest";
import { AmazonAdsLiveConnectionService } from "@/features/marketing/providers/amazon-ads/live/connection-service";
import { createAmazonAdsOAuthStateStoreForTests } from "@/features/marketing/providers/amazon-ads/live/state-store";
import { createAmazonAdsTokenStoreForTests } from "@/features/marketing/providers/amazon-ads/live/token-store";
import { assertAmazonAdsReadOnlyOperation } from "@/features/marketing/providers/amazon-ads/live/read-only-allowlist";
import type { AmazonAdsTokenStore } from "@/features/marketing/providers/amazon-ads/live/types";

const mutableEnv = process.env as Record<string, string | undefined>;

const config = {
  clientId: "client",
  clientSecret: "secret",
  redirectUri: "http://localhost:3000/api/integrations/amazon-ads/callback",
  tokenEncryptionKey: Buffer.from("12345678901234567890123456789012", "utf8").toString("base64"),
  liveReadEnabled: true,
} as const;

const actor = {
  workspaceId: "ws_live_service",
  userId: "user_service",
};

function buildService(
  overrides: {
    exchangeAuthorizationCode?: () => Promise<{
      accessToken: string;
      refreshToken: string;
      expiresInSeconds: number;
    }>;
    discoverProfiles?: () => Promise<
      Array<{
        profileId: string;
        countryCode: string;
        currencyCode: string;
        accountInfo: { type: string; name: string };
      }>
    >;
    refreshAccessToken?: () => Promise<{ accessToken: string; expiresInSeconds: number }>;
    revokeRefreshToken?: () => Promise<void>;
    tokenStore?: AmazonAdsTokenStore;
  } = {},
) {
  const tokenStore = overrides.tokenStore ?? createAmazonAdsTokenStoreForTests();
  const oauthClient = {
    buildAuthorizeUrl: (state: string) => `https://www.amazon.com/ap/oa?state=${encodeURIComponent(state)}`,
    exchangeAuthorizationCode:
      overrides.exchangeAuthorizationCode ??
      (async () => ({
        accessToken: "access-token-1",
        refreshToken: "refresh-token-1",
        expiresInSeconds: 3600,
      })),
    discoverProfiles:
      overrides.discoverProfiles ??
      (async () => [
        {
          profileId: "12345",
          countryCode: "US",
          currencyCode: "USD",
          accountInfo: { type: "seller", name: "Bite Me Foods" },
        },
      ]),
    refreshAccessToken:
      overrides.refreshAccessToken ??
      (async () => ({
        accessToken: "access-token-refreshed",
        expiresInSeconds: 1200,
      })),
    revokeRefreshToken: overrides.revokeRefreshToken ?? (async () => undefined),
  };

  const service = new AmazonAdsLiveConnectionService({
    config,
    oauthClient: oauthClient as never,
    stateStore: createAmazonAdsOAuthStateStoreForTests(),
    tokenStore,
    now: () => new Date("2026-07-23T12:00:00.000Z"),
  });
  return { service, tokenStore };
}

describe("Amazon Ads live connection service", () => {
  it("completes OAuth profile discovery and requires explicit profile selection", async () => {
    const previous = process.env.AMAZON_ADS_LIVE_READ_ENABLED;
    process.env.AMAZON_ADS_LIVE_READ_ENABLED = "true";
    try {
      const { service } = buildService();
      const start = await service.beginAuthorization(actor);
      const state = new URL(start.authorizeUrl).searchParams.get("state");
      expect(state).toBeTruthy();

      await service.completeAuthorization({
        actor,
        state: state!,
        code: "auth-code",
      });

      const view = await service.getConnectionView(actor);
      expect(view.status).toBe("connected");
      expect(view.selectedProfileId).toBeNull();
      expect(view.profiles).toHaveLength(1);

      await service.selectProfile({
        actor,
        connectionId: view.connectionId!,
        profileId: "12345",
        marketplaceId: "US",
      });
      const updated = await service.getConnectionView(actor);
      expect(updated.selectedProfileId).toBe("12345");
      expect(updated.selectedMarketplaceId).toBe("US");
    } finally {
      process.env.AMAZON_ADS_LIVE_READ_ENABLED = previous;
    }
  });

  it("enforces workspace isolation and callback rejection for reused state", async () => {
    const previous = process.env.AMAZON_ADS_LIVE_READ_ENABLED;
    process.env.AMAZON_ADS_LIVE_READ_ENABLED = "true";
    try {
      const { service } = buildService();
      const start = await service.beginAuthorization(actor);
      const state = new URL(start.authorizeUrl).searchParams.get("state")!;

      await service.completeAuthorization({ actor, state, code: "first-code" });
      await expect(
        service.completeAuthorization({ actor, state, code: "second-code" }),
      ).rejects.toThrow("OAUTH_STATE_REUSED");

      const otherActor = { workspaceId: "other_ws", userId: "other_user" };
      const view = await service.getConnectionView(actor);
      await expect(
        service.selectProfile({
          actor: otherActor,
          connectionId: view.connectionId!,
          profileId: "12345",
          marketplaceId: "US",
        }),
      ).rejects.toThrow("RESOURCE_NOT_FOUND");
    } finally {
      process.env.AMAZON_ADS_LIVE_READ_ENABLED = previous;
    }
  });

  it("supports refresh token flow and redacts token values from refresh errors", async () => {
    const previous = process.env.AMAZON_ADS_LIVE_READ_ENABLED;
    process.env.AMAZON_ADS_LIVE_READ_ENABLED = "true";
    try {
      const { service } = buildService();
      const start = await service.beginAuthorization(actor);
      const state = new URL(start.authorizeUrl).searchParams.get("state")!;
      await service.completeAuthorization({ actor, state, code: "refresh-test-code" });

      const view = await service.getConnectionView(actor);
      const refreshed = await service.refreshAccessToken(actor, view.connectionId!);
      expect(refreshed.expiresAt).toContain("T");

      const { service: failingService } = buildService({
        refreshAccessToken: async () => {
          throw new Error("refresh_token=leaked-token-value");
        },
      });
      const start2 = await failingService.beginAuthorization({
        workspaceId: "ws_live_refresh_error",
        userId: "user_refresh_error",
      });
      const state2 = new URL(start2.authorizeUrl).searchParams.get("state")!;
      await failingService.completeAuthorization({
        actor: { workspaceId: "ws_live_refresh_error", userId: "user_refresh_error" },
        state: state2,
        code: "ok",
      });
      const view2 = await failingService.getConnectionView({
        workspaceId: "ws_live_refresh_error",
        userId: "user_refresh_error",
      });
      await expect(
        failingService.refreshAccessToken(
          { workspaceId: "ws_live_refresh_error", userId: "user_refresh_error" },
          view2.connectionId!,
        ),
      ).rejects.toThrow("refresh_token=[REDACTED]");
    } finally {
      process.env.AMAZON_ADS_LIVE_READ_ENABLED = previous;
    }
  });

  it("reports local credential deletion separately when remote revocation fails", async () => {
    const previous = process.env.AMAZON_ADS_LIVE_READ_ENABLED;
    process.env.AMAZON_ADS_LIVE_READ_ENABLED = "true";
    try {
      const sharedTokenStore = createAmazonAdsTokenStoreForTests();
      const { service } = buildService({ tokenStore: sharedTokenStore });
      const start = await service.beginAuthorization(actor);
      const state = new URL(start.authorizeUrl).searchParams.get("state")!;
      await service.completeAuthorization({ actor, state, code: "disconnect-code" });
      const view = await service.getConnectionView(actor);

      const { service: revocationFailService } = buildService({
        tokenStore: sharedTokenStore,
        revokeRefreshToken: async () => {
          throw new Error("refresh_token=leaked-on-revoke");
        },
      });
      const result = await revocationFailService.disconnect({
        actor,
        connectionId: view.connectionId!,
        confirmed: true,
      });
      expect(result.localCredentialsDeleted).toBe(true);
      expect(result.remoteRevocationAttempted).toBe(true);
      expect(result.remoteRevocationSucceeded).toBe(false);
      expect(result.connectionStatus).toBe("error");
      expect(result.message).toContain("Local credentials were removed");
    } finally {
      process.env.AMAZON_ADS_LIVE_READ_ENABLED = previous;
    }
  });

  it("reports remote revocation success when Amazon revoke succeeds", async () => {
    const previous = process.env.AMAZON_ADS_LIVE_READ_ENABLED;
    process.env.AMAZON_ADS_LIVE_READ_ENABLED = "true";
    try {
      const sharedTokenStore = createAmazonAdsTokenStoreForTests();
      const { service } = buildService({ tokenStore: sharedTokenStore });
      const start = await service.beginAuthorization(actor);
      const state = new URL(start.authorizeUrl).searchParams.get("state")!;
      await service.completeAuthorization({ actor, state, code: "disconnect-success-code" });
      const view = await service.getConnectionView(actor);
      const result = await service.disconnect({
        actor,
        connectionId: view.connectionId!,
        confirmed: true,
      });
      expect(result.localCredentialsDeleted).toBe(true);
      expect(result.remoteRevocationAttempted).toBe(true);
      expect(result.remoteRevocationSucceeded).toBe(true);
      expect(result.connectionStatus).toBe("disconnected");
    } finally {
      process.env.AMAZON_ADS_LIVE_READ_ENABLED = previous;
    }
  });

  it("reports local-only deletion when no token exists", async () => {
    const previous = process.env.AMAZON_ADS_LIVE_READ_ENABLED;
    process.env.AMAZON_ADS_LIVE_READ_ENABLED = "true";
    try {
      const { service } = buildService();
      const start = await service.beginAuthorization(actor);
      const state = new URL(start.authorizeUrl).searchParams.get("state")!;
      await service.completeAuthorization({ actor, state, code: "disconnect-local-only-code" });
      const view = await service.getConnectionView(actor);
      await service.disconnect({ actor, connectionId: view.connectionId!, confirmed: true });
      const result = await service.disconnect({ actor, connectionId: view.connectionId!, confirmed: true });
      expect(result.localCredentialsDeleted).toBe(true);
      expect(result.remoteRevocationAttempted).toBe(false);
      expect(result.remoteRevocationSucceeded).toBe(false);
      expect(result.connectionStatus).toBe("disconnected");
    } finally {
      process.env.AMAZON_ADS_LIVE_READ_ENABLED = previous;
    }
  });

  it("rejects in-memory token storage in production mode", async () => {
    const previousEnv = process.env.NODE_ENV;
    mutableEnv.NODE_ENV = "production";
    try {
      const service = new AmazonAdsLiveConnectionService({
        config,
        oauthClient: {
          buildAuthorizeUrl: () => "https://example.com",
          exchangeAuthorizationCode: async () => ({
            accessToken: "token",
            refreshToken: "refresh",
            expiresInSeconds: 1,
          }),
          discoverProfiles: async () => [],
          refreshAccessToken: async () => ({ accessToken: "token", expiresInSeconds: 1 }),
          revokeRefreshToken: async () => undefined,
        } as never,
        stateStore: createAmazonAdsOAuthStateStoreForTests(),
        tokenStore: createAmazonAdsTokenStoreForTests(),
      });
      expect(() => service.getConnectAvailability()).not.toThrow();
      expect(service.getConnectAvailability().enabled).toBe(false);
      await expect(service.beginAuthorization(actor)).rejects.toThrow(
        "SECURITY_POLICY_VIOLATION:Production token storage prerequisite is not met.",
      );
    } finally {
      mutableEnv.NODE_ENV = previousEnv;
    }
  });

  it("rejects file-backed token storage in production mode", async () => {
    const previousEnv = process.env.NODE_ENV;
    mutableEnv.NODE_ENV = "production";
    try {
      const fileTokenStore = {
        kind: "file" as const,
        get: async () => null,
        save: async () => {
          throw new Error("not expected");
        },
        delete: async () => undefined,
      };
      const externalStateStore = {
        kind: "external" as const,
        create: async () => {
          throw new Error("not expected");
        },
        consume: async () => {
          throw new Error("not expected");
        },
      };
      const service = new AmazonAdsLiveConnectionService({
        config,
        oauthClient: {
          buildAuthorizeUrl: () => "https://example.com",
          exchangeAuthorizationCode: async () => ({
            accessToken: "token",
            refreshToken: "refresh",
            expiresInSeconds: 1,
          }),
          discoverProfiles: async () => [],
          refreshAccessToken: async () => ({ accessToken: "token", expiresInSeconds: 1 }),
          revokeRefreshToken: async () => undefined,
        } as never,
        stateStore: externalStateStore,
        tokenStore: fileTokenStore,
      });
      await expect(service.beginAuthorization(actor)).rejects.toThrow(
        "SECURITY_POLICY_VIOLATION:Production token storage prerequisite is not met.",
      );
    } finally {
      mutableEnv.NODE_ENV = previousEnv;
    }
  });

  it("rejects in-memory OAuth state storage in production mode", async () => {
    const previousEnv = process.env.NODE_ENV;
    mutableEnv.NODE_ENV = "production";
    try {
      const externalTokenStore = {
        kind: "external" as const,
        get: async () => null,
        save: async () => {
          throw new Error("not expected");
        },
        delete: async () => undefined,
      };
      const service = new AmazonAdsLiveConnectionService({
        config,
        oauthClient: {
          buildAuthorizeUrl: () => "https://example.com",
          exchangeAuthorizationCode: async () => ({
            accessToken: "token",
            refreshToken: "refresh",
            expiresInSeconds: 1,
          }),
          discoverProfiles: async () => [],
          refreshAccessToken: async () => ({ accessToken: "token", expiresInSeconds: 1 }),
          revokeRefreshToken: async () => undefined,
        } as never,
        stateStore: createAmazonAdsOAuthStateStoreForTests(),
        tokenStore: externalTokenStore,
      });
      await expect(service.beginAuthorization(actor)).rejects.toThrow(
        "SECURITY_POLICY_VIOLATION:Production OAuth state storage prerequisite is not met.",
      );
    } finally {
      mutableEnv.NODE_ENV = previousEnv;
    }
  });

  it("rejects file-backed OAuth state storage in production mode", async () => {
    const previousEnv = process.env.NODE_ENV;
    mutableEnv.NODE_ENV = "production";
    try {
      const fileStateStore = {
        kind: "file" as const,
        create: async () => {
          throw new Error("not expected");
        },
        consume: async () => {
          throw new Error("not expected");
        },
      };
      const externalTokenStore = {
        kind: "external" as const,
        get: async () => null,
        save: async () => {
          throw new Error("not expected");
        },
        delete: async () => undefined,
      };
      const service = new AmazonAdsLiveConnectionService({
        config,
        oauthClient: {
          buildAuthorizeUrl: () => "https://example.com",
          exchangeAuthorizationCode: async () => ({
            accessToken: "token",
            refreshToken: "refresh",
            expiresInSeconds: 1,
          }),
          discoverProfiles: async () => [],
          refreshAccessToken: async () => ({ accessToken: "token", expiresInSeconds: 1 }),
          revokeRefreshToken: async () => undefined,
        } as never,
        stateStore: fileStateStore,
        tokenStore: externalTokenStore,
      });
      await expect(service.beginAuthorization(actor)).rejects.toThrow(
        "SECURITY_POLICY_VIOLATION:Production OAuth state storage prerequisite is not met.",
      );
    } finally {
      mutableEnv.NODE_ENV = previousEnv;
    }
  });

  it("enforces read-only operation allowlist and blocks mutation semantics", () => {
    expect(() => assertAmazonAdsReadOnlyOperation("profile_discovery")).not.toThrow();
    expect(() => assertAmazonAdsReadOnlyOperation("campaign_update")).toThrow("READ_ONLY_VIOLATION");
  });

  it("supports concurrent callback attempts with one-time state consumption", async () => {
    const previous = process.env.AMAZON_ADS_LIVE_READ_ENABLED;
    process.env.AMAZON_ADS_LIVE_READ_ENABLED = "true";
    try {
      const { service } = buildService();
      const start = await service.beginAuthorization(actor);
      const state = new URL(start.authorizeUrl).searchParams.get("state")!;
      const first = service.completeAuthorization({ actor, state, code: "auth-code-1" });
      const second = service.completeAuthorization({ actor, state, code: "auth-code-2" });
      const settled = await Promise.allSettled([first, second]);
      const succeeded = settled.filter((row) => row.status === "fulfilled");
      const failed = settled.filter((row) => row.status === "rejected");
      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect(String((failed[0] as PromiseRejectedResult).reason)).toContain("OAUTH_STATE");
    } finally {
      process.env.AMAZON_ADS_LIVE_READ_ENABLED = previous;
    }
  });
});
