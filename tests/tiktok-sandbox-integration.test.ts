import { describe, expect, it, vi } from "vitest";
import { parseTikTokCallback } from "@/app/api/integrations/tiktok/callback/route";
import { TikTokApiClient } from "@/features/integrations/tiktok/client";
import {
  decryptTikTokToken,
  encryptTikTokToken,
  hashOAuthState,
  redactTikTokSecrets,
} from "@/features/integrations/tiktok/token-crypto";
import type { TikTokConfig } from "@/features/integrations/tiktok/config";

const config: TikTokConfig = {
  clientKey: "client-key",
  clientSecret: "client-secret",
  redirectUri: "https://postmotive.example/api/integrations/tiktok/callback",
  encryptionKey: Buffer.from(
    "12345678901234567890123456789012",
    "utf8",
  ).toString("base64"),
  sandboxEnabled: true,
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
});
