import { describe, expect, it } from "vitest";
import { redactFeedbackDescription } from "@/features/help/feedback";

describe("feedback redaction", () => {
  it("redacts obvious secret-like tokens", () => {
    const result = redactFeedbackDescription("bearer abc123 sk_live_secret pk_test_public");
    expect(result).toContain("[redacted-token]");
    expect(result).toContain("[redacted-key]");
    expect(result).not.toContain("sk_live_secret");
    expect(result).not.toContain("pk_test_public");
  });

  it("redacts api_key, token, and password query values", () => {
    const result = redactFeedbackDescription("https://example.test?api_key=my-key&token=my-token&password=my-pass");
    expect(result).toContain("api_key=[redacted]");
    expect(result).toContain("token=[redacted]");
    expect(result).toContain("password=[redacted]");
    expect(result).not.toContain("my-key");
    expect(result).not.toContain("my-token");
    expect(result).not.toContain("my-pass");
  });
});
