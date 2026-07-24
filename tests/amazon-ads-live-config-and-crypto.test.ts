import { describe, expect, it } from "vitest";
import {
  assertAmazonAdsLiveConnectionEnabled,
  getAmazonAdsLiveFeatureEnabled,
  getMissingAmazonAdsConfigKeys,
} from "@/features/marketing/providers/amazon-ads/live/config";
import {
  decryptRefreshToken,
  encryptRefreshToken,
  redactSecrets,
} from "@/features/marketing/providers/amazon-ads/live/token-crypto";

describe("Amazon Ads live config and crypto guards", () => {
  it("defaults live feature flag to disabled and fails closed for missing config", () => {
    expect(getAmazonAdsLiveFeatureEnabled({})).toBe(false);
    expect(getMissingAmazonAdsConfigKeys({})).toEqual([
      "AMAZON_ADS_CLIENT_ID",
      "AMAZON_ADS_CLIENT_SECRET",
      "AMAZON_ADS_REDIRECT_URI",
      "AMAZON_ADS_TOKEN_ENCRYPTION_KEY",
    ]);
    expect(() => assertAmazonAdsLiveConnectionEnabled({})).toThrow("FEATURE_DISABLED");
  });

  it("rejects enabled live mode when required values are missing", () => {
    expect(() =>
      assertAmazonAdsLiveConnectionEnabled({
        AMAZON_ADS_LIVE_READ_ENABLED: "true",
        AMAZON_ADS_CLIENT_ID: "client",
      }),
    ).toThrow("CONFIG_MISSING");
  });

  it("supports token encryption/decryption and redacts sensitive fields", () => {
    const key = Buffer.from("12345678901234567890123456789012", "utf8").toString("base64");
    const encrypted = encryptRefreshToken("refresh-token-value", key);
    const decrypted = decryptRefreshToken(encrypted, key);
    expect(decrypted).toBe("refresh-token-value");

    const redacted = redactSecrets(
      "access_token=abc123 refresh_token=xyz789 client_secret=secret authorization_code=code",
    );
    expect(redacted).not.toContain("abc123");
    expect(redacted).not.toContain("xyz789");
    expect(redacted).not.toContain("client_secret=secret");
    expect(redacted).not.toContain("authorization_code=code");
    expect(redacted).toContain("client_secret=[REDACTED]");
    expect(redacted).toContain("authorization_code=[REDACTED]");
    expect(redacted).toContain("[REDACTED]");
  });
});
