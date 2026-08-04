import { describe, expect, it, vi } from "vitest";
import { parseTikTokCallback } from "@/app/api/integrations/tiktok/callback/route";
import { TikTokApiClient } from "@/features/integrations/tiktok/client";
import {
  createTikTokOAuthState,
  decryptTikTokToken,
  encryptTikTokToken,
  hashOAuthState,
  redactTikTokSecrets,
  verifyTikTokOAuthState,
} from "@/features/integrations/tiktok/token-crypto";
import type { TikTokConfig } from "@/features/integrations/tiktok/config";
import { validateSystemSettingValue } from "@/features/admin/settings-rules";
import { normalizeTikTokIntegrationMode } from "@/features/integrations/tiktok/types";

vi.mock("@/features/admin/audit", () => ({
  writeAdminAuditEvent: vi.fn(async () => undefined),
}));

const config: TikTokConfig = {
  clientKey: "client-key",
  clientSecret: "client-secret",
  redirectUri: "https://postmotive.example/api/integrations/tiktok/callback",
  encryptionKey: Buffer.from(
    "12345678901234567890123456789012",
    "utf8",
  ).toString("base64"),
  postingMode: "beta_upload",
  webhooksEnabled: false,
  mediaBaseUrl: "https://media.postmotive.example",
  verifiedUrlPrefix: "https://media.postmotive.example/storage/v1/object/sign/brand-media/",
  scopes: ["user.info.basic", "video.upload"],
};

describe("TikTok sandbox integration", () => {
  it("builds a scoped OAuth v2 authorization URL", () => {
    const url = new URL(new TikTokApiClient(config).buildAuthorizeUrl("state-1"));
    expect(url.origin + url.pathname).toBe(
      "https://www.tiktok.com/v2/auth/authorize/",
    );
    expect(url.searchParams.get("client_key")).toBe("client-key");
    expect(url.searchParams.get("scope")).toBe(
      "user.info.basic,video.upload",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);
    expect(url.searchParams.get("state")).toBe("state-1");
  });

  it("exchanges a code without exposing the client secret", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    const fetchImpl = vi.fn(
      async (input: URL | RequestInfo, init?: RequestInit) => {
        capturedUrl = String(input);
        capturedBody = String(init?.body || "");
        return new Response(
        JSON.stringify({
          access_token: "access",
          refresh_token: "refresh",
          open_id: "open-id",
          scope: "user.info.basic,video.upload",
          expires_in: 86400,
          refresh_expires_in: 31536000,
          token_type: "Bearer",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    );
    const tokens = await new TikTokApiClient(config, {
      fetchImpl: fetchImpl as typeof fetch,
    }).exchangeCode("authorization-code");
    expect(tokens.scope).toEqual(["user.info.basic", "video.upload"]);
    expect(tokens.accessToken).toBe("access");
    expect(capturedUrl).toBe("https://open.tiktokapis.com/v2/oauth/token/");
    expect(capturedBody).toContain("client_secret=client-secret");
  });

  it("normalizes creator posting restrictions", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            creator_username: "creator",
            creator_nickname: "Creator Name",
            privacy_level_options: ["SELF_ONLY"],
            comment_disabled: true,
            duet_disabled: true,
            stitch_disabled: false,
            max_video_post_duration_sec: 180,
          },
          error: { code: "ok", message: "", log_id: "log" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const creator = await new TikTokApiClient(config, {
      fetchImpl: fetchImpl as typeof fetch,
    }).queryCreatorInfo("access");
    expect(creator.nickname).toBe("Creator Name");
    expect(creator.privacyLevelOptions).toEqual(["SELF_ONLY"]);
    expect(creator.maxVideoDurationSeconds).toBe(180);
  });

  it("loads the sandbox creator profile with user.info.basic", async () => {
    let capturedUrl = "";
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      capturedUrl = String(input);
      return new Response(
        JSON.stringify({
          data: {
            user: {
              open_id: "open-id",
              avatar_url: "https://example.com/avatar.jpg",
              display_name: "Original Bite Me Jerky",
            },
          },
          error: { code: "ok", message: "", log_id: "log" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const creator = await new TikTokApiClient(config, {
      fetchImpl: fetchImpl as typeof fetch,
    }).queryBasicUserInfo("access");
    expect(capturedUrl).toContain("/v2/user/info/");
    expect(capturedUrl).toContain("display_name");
    expect(creator.nickname).toBe("Original Bite Me Jerky");
    expect(creator.avatarUrl).toBe("https://example.com/avatar.jpg");
  });

  it("initializes an editable TikTok inbox draft from a protected URL", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    const fetchImpl = vi.fn(
      async (input: URL | RequestInfo, init?: RequestInit) => {
        capturedUrl = String(input);
        capturedBody = String(init?.body || "");
        return new Response(
          JSON.stringify({
            data: { publish_id: "publish-123" },
            error: { code: "ok", message: "", log_id: "log" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    );
    const publishId = await new TikTokApiClient(config, {
      fetchImpl: fetchImpl as typeof fetch,
    }).initializeInboxVideoFromUrl(
      "access",
      "https://postmotive.example/api/integrations/tiktok/media?token=protected",
    );
    expect(publishId).toBe("publish-123");
    expect(capturedUrl).toBe(
      "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/",
    );
    expect(JSON.parse(capturedBody)).toEqual({
      source_info: {
        source: "PULL_FROM_URL",
        video_url:
          "https://postmotive.example/api/integrations/tiktok/media?token=protected",
      },
    });
  });

  it("initializes a direct post from a protected URL with privacy and disclosure controls", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    const fetchImpl = vi.fn(
      async (input: URL | RequestInfo, init?: RequestInit) => {
        capturedUrl = String(input);
        capturedBody = String(init?.body || "");
        return new Response(
          JSON.stringify({
            data: { publish_id: "publish-direct-1" },
            error: { code: "ok", message: "", log_id: "log" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    );

    const publishId = await new TikTokApiClient(config, {
      fetchImpl: fetchImpl as typeof fetch,
    }).initializeDirectPostFromUrl({
      accessToken: "access",
      videoUrl: "https://postmotive.example/api/integrations/tiktok/media?token=protected",
      title: "New product launch",
      privacyLevel: "SELF_ONLY",
      disableComment: true,
      disableDuet: false,
      disableStitch: true,
      commercialContentDisclosure: true,
      brandedContentToggle: false,
    });

    expect(publishId).toBe("publish-direct-1");
    expect(capturedUrl).toBe("https://open.tiktokapis.com/v2/post/publish/video/init/");
    expect(JSON.parse(capturedBody)).toEqual({
      post_info: {
        title: "New product launch",
        privacy_level: "SELF_ONLY",
        disable_comment: true,
        disable_duet: false,
        disable_stitch: true,
        video_cover_timestamp_ms: 1000,
        brand_content_toggle: true,
        brand_organic_toggle: false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url:
          "https://postmotive.example/api/integrations/tiktok/media?token=protected",
      },
    });
  });

  it("reads TikTok inbox delivery status without treating delivery as publication", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: { status: "SEND_TO_USER_INBOX" },
          error: { code: "ok", message: "", log_id: "log" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const status = await new TikTokApiClient(config, {
      fetchImpl: fetchImpl as typeof fetch,
    }).fetchPublishStatus("access", "publish-123");
    expect(status).toEqual({
      status: "SEND_TO_USER_INBOX",
      failureReason: null,
    });
  });

  it("validates callback values and returned scopes", () => {
    const parsed = parseTikTokCallback(
      new URL(
        "https://postmotive.example/callback?code=code-1&state=state-1&scopes=user.info.basic%2Cvideo.upload",
      ),
    );
    expect(parsed).toEqual({
      code: "code-1",
      state: "state-1",
      scopes: ["user.info.basic", "video.upload"],
    });
    expect(
      parseTikTokCallback(
        new URL(
          "https://postmotive.example/callback?code=code-1*0!&state=state-1",
        ),
      ).code,
    ).toBe("code-1*0!");
    expect(() =>
      parseTikTokCallback(
        new URL("https://postmotive.example/callback?code=bad%20code&state=x"),
      ),
    ).toThrow("TIKTOK_CALLBACK_INVALID");
    expect(() =>
      parseTikTokCallback(
        new URL("https://postmotive.example/callback?error=access_denied"),
      ),
    ).toThrow("TIKTOK_AUTH_DENIED");
  });

  it("encrypts tokens, hashes OAuth state, and redacts secrets", () => {
    const encrypted = encryptTikTokToken("private-token", config.encryptionKey);
    expect(encrypted).not.toContain("private-token");
    expect(decryptTikTokToken(encrypted, config.encryptionKey)).toBe(
      "private-token",
    );
    expect(hashOAuthState("state-value")).toHaveLength(64);
    const redacted = redactTikTokSecrets(
      "access_token=access refresh_token=refresh client_secret=secret code=code",
    );
    expect(redacted).not.toContain("access_token=access");
    expect(redacted).not.toContain("refresh_token=refresh");
    expect(redacted).not.toContain("client_secret=secret");
    expect(redacted).not.toContain("code=code");
  });

  it("signs OAuth state and rejects tampering", () => {
    const state = createTikTokOAuthState(
      {
        userId: "user-1",
        workspaceId: "workspace-1",
        expiresAt: 2_000_000_000_000,
      },
      config.encryptionKey,
    );
    expect(verifyTikTokOAuthState(state, config.encryptionKey)).toMatchObject({
      userId: "user-1",
      workspaceId: "workspace-1",
      expiresAt: 2_000_000_000_000,
    });
    const [payload, signature] = state.split(".");
    const tamperedSignature = `${signature.startsWith("a") ? "b" : "a"}${signature.slice(1)}`;
    expect(() =>
      verifyTikTokOAuthState(
        `${payload}.${tamperedSignature}`,
        config.encryptionKey,
      ),
    ).toThrow("TIKTOK_STATE_INVALID");
  });

  it("normalizes TikTok integration modes and validates system settings", () => {
    expect(normalizeTikTokIntegrationMode("beta_upload")).toBe("beta_upload");
    expect(normalizeTikTokIntegrationMode("DIRECT_POST")).toBe("direct_post");
    expect(normalizeTikTokIntegrationMode("unknown-mode")).toBe("beta_upload");
    expect(validateSystemSettingValue("tiktok_content_posting_mode", "sandbox")).toBe("sandbox");
    expect(validateSystemSettingValue("tiktok_webhooks_enabled", "true")).toBe(true);
    expect(() =>
      validateSystemSettingValue("tiktok_content_posting_mode", "invalid"),
    ).toThrow("SETTING_VALUE_INVALID");
  });
});
