import { describe, expect, it } from "vitest";
import {
  createAdminAuditEvent,
  sanitizeAuditValue,
} from "@/features/admin/audit-rules";

describe("admin audit sanitization", () => {
  it("redacts sensitive values before writing audit payloads", () => {
    const sanitized = sanitizeAuditValue({
      apiKey: "secret-value",
      password: "hunter2",
      nested: {
        accessToken: "token-value",
      },
      safe: "ok",
    });
    expect(sanitized).toEqual({
      apiKey: "[REDACTED]",
      password: "[REDACTED]",
      nested: {
        accessToken: "[REDACTED]",
      },
      safe: "ok",
    });
  });

  it("creates sanitized audit events", () => {
    const event = createAdminAuditEvent({
      actorUserId: "user-1",
      targetAccountId: "account-1",
      action: "billing_exemption_changed",
      resourceType: "account",
      previousValue: { authorization: "Bearer secret" },
      newValue: { billing_exempt: true },
      reason: "Customer is under enterprise contract.",
    });
    expect(event.previous_value).toEqual({ authorization: "[REDACTED]" });
    expect(event.new_value).toEqual({ billing_exempt: true });
  });
});