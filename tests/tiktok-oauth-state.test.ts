import { describe, expect, it } from "vitest";
import {
  createTikTokOAuthState,
  createTikTokOAuthStateCookie,
  validateTikTokOAuthState,
  verifyTikTokOAuthState,
} from "@/features/integrations/tiktok/token-crypto";

const encryptionKey = Buffer.from(
  "12345678901234567890123456789012",
  "utf8",
).toString("base64");

describe("TikTok OAuth state", () => {
  it("generates a secure httpOnly cookie for the state", () => {
    const cookie = createTikTokOAuthStateCookie(
      {
        userId: "user-1",
        workspaceId: "workspace-1",
        expiresAt: Date.now() + 600_000,
      },
      encryptionKey,
    );
    expect(cookie.name).toBe("pm_tiktok_oauth_state");
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.sameSite).toBe("lax");
    expect(cookie.options.path).toBe("/api/integrations/tiktok/callback");
    expect(cookie.value).toContain(".");
    expect(verifyTikTokOAuthState(cookie.value, encryptionKey).userId).toBe("user-1");
  });

  it("rejects a mismatched OAuth state", () => {
    const cookieState = createTikTokOAuthState(
      {
        userId: "user-1",
        workspaceId: "workspace-1",
        expiresAt: Date.now() + 600_000,
      },
      encryptionKey,
    );
    const requestState = createTikTokOAuthState(
      {
        userId: "user-1",
        workspaceId: "workspace-1",
        expiresAt: Date.now() + 600_000,
      },
      encryptionKey,
    );

    expect(() =>
      validateTikTokOAuthState(cookieState, requestState, encryptionKey, {
        userId: "user-1",
        workspaceId: "workspace-1",
      }),
    ).toThrow(/does not match the cookie/i);
  });

  it("rejects an expired OAuth state", () => {
    const state = createTikTokOAuthState(
      {
        userId: "user-1",
        workspaceId: "workspace-1",
        expiresAt: Date.now() - 1,
      },
      encryptionKey,
    );

    expect(() =>
      validateTikTokOAuthState(state, state, encryptionKey, {
        userId: "user-1",
        workspaceId: "workspace-1",
        now: Date.now(),
      }),
    ).toThrow(/invalid or expired/i);
  });
});