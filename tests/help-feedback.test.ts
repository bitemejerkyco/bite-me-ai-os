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
});
