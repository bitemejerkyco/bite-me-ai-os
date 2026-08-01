import { describe, expect, it } from "vitest";
import { classifyIntegrationError, redactIntegrationSecrets } from "@/features/integrations/core/errors";
import { normalizeConnectionState } from "@/features/integrations/core/state";

describe("integration core errors", () => {
  it("redacts sensitive token fields", () => {
    const input = "access_token=abc123 refresh_token=xyz bearer qwerty";
    const redacted = redactIntegrationSecrets(input);
    expect(redacted).not.toContain("abc123");
    expect(redacted).not.toContain("xyz");
    expect(redacted).toContain("[REDACTED]");
  });

  it("classifies retryable rate limit errors", () => {
    const classified = classifyIntegrationError("RATE_LIMIT:Too many requests retry-after=120");
    expect(classified.retryable).toBe(true);
    expect(classified.rateLimited).toBe(true);
    expect(classified.retryAfterSeconds).toBe(120);
  });
});

describe("integration connection state", () => {
  it("normalizes supported states", () => {
    expect(normalizeConnectionState("CONNECTED")).toBe("connected");
    expect(normalizeConnectionState("RECONNECT_REQUIRED")).toBe("reconnect_required");
    expect(normalizeConnectionState("EXPIRED")).toBe("token_expired");
  });

  it("falls back unknown states to not_configured", () => {
    expect(normalizeConnectionState("NOT_A_STATE")).toBe("not_configured");
  });
});
