import { describe, expect, it } from "vitest";
import { logger } from "@/lib/logger";

describe("logger redaction", () => {
  it("redacts nested sensitive fields and bearer token strings", () => {
    const redacted = logger.redact({
      password: "secret123",
      nested: {
        apiKey: "abc",
        authHeader: "Bearer some-token",
      },
      plain: "ok",
    });

    expect(redacted).toEqual({
      password: "[REDACTED]",
      nested: {
        apiKey: "[REDACTED]",
        authHeader: "[REDACTED]",
      },
      plain: "ok",
    });
  });
});
