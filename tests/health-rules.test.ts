import { describe, expect, it } from "vitest";
import {
  sanitizeHealthMetadata,
  summarizeOverallHealth,
  type ServiceHealthCheck,
} from "@/features/admin/health-rules";

describe("health checks", () => {
  it("marks unavailable integrations as not configured when no signal exists", () => {
    const checks: ServiceHealthCheck[] = [
      {
        key: "openai",
        displayName: "OpenAI",
        status: "not_configured",
        message: "Not configured.",
        checkedAt: new Date().toISOString(),
        latencyMs: null,
        metadata: {},
        source: "configuration",
      },
    ];
    expect(summarizeOverallHealth(checks)).toBe("not_configured");
  });

  it("prefers critical and warning states over healthy checks", () => {
    const checks: ServiceHealthCheck[] = [
      {
        key: "database",
        displayName: "Database",
        status: "healthy",
        message: "ok",
        checkedAt: new Date().toISOString(),
        latencyMs: 20,
        metadata: {},
        source: "supabase",
      },
      {
        key: "openai",
        displayName: "OpenAI",
        status: "warning",
        message: "timeout",
        checkedAt: new Date().toISOString(),
        latencyMs: null,
        metadata: {},
        source: "openai",
      },
    ];
    expect(summarizeOverallHealth(checks)).toBe("warning");
  });

  it("sanitizes secret-looking metadata", () => {
    expect(
      sanitizeHealthMetadata({ apiKey: "secret", nested: { accessToken: "value" } }),
    ).toEqual({ apiKey: "[REDACTED]", nested: { accessToken: "[REDACTED]" } });
  });
});