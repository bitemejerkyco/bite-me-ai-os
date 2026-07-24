import { describe, expect, it } from "vitest";
import { validateOAuthCallbackQuery } from "@/app/api/integrations/amazon-ads/callback/route";
import { AMAZON_ADS_OAUTH_SCOPE } from "@/features/marketing/providers/amazon-ads/live/oauth-client";

describe("Amazon Ads OAuth callback query validation", () => {
  it("accepts valid code and state", () => {
    const url = new URL("https://example.com/callback?code=abc123-._~&state=def456-._~");
    const parsed = validateOAuthCallbackQuery(url);
    expect(parsed.code).toBe("abc123-._~");
    expect(parsed.state).toBe("def456-._~");
  });

  it("rejects missing or malformed fields", () => {
    expect(() => validateOAuthCallbackQuery(new URL("https://example.com/callback?state=s"))).toThrow(
      "OAUTH_CALLBACK_INVALID",
    );
    expect(() => validateOAuthCallbackQuery(new URL("https://example.com/callback?code=a&state=bad value"))).toThrow(
      "OAUTH_CALLBACK_INVALID",
    );
  });

  it("rejects oversized input and unexpected scope", () => {
    const oversized = "a".repeat(2050);
    expect(() =>
      validateOAuthCallbackQuery(new URL(`https://example.com/callback?code=${oversized}&state=state-ok`)),
    ).toThrow("OAUTH_CALLBACK_INVALID");

    expect(() =>
      validateOAuthCallbackQuery(
        new URL(`https://example.com/callback?code=code-ok&state=state-ok&scope=${encodeURIComponent("profile")}`),
      ),
    ).toThrow("OAUTH_SCOPE_INVALID");

    expect(() =>
      validateOAuthCallbackQuery(
        new URL(
          `https://example.com/callback?code=code-ok&state=state-ok&scope=${encodeURIComponent(AMAZON_ADS_OAUTH_SCOPE)}`,
        ),
      ),
    ).not.toThrow();
  });
});
