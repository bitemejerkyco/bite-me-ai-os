import { describe, expect, it } from "vitest";
import { isBriefRefreshThrottled } from "@/features/marketing-director/brief-refresh";

describe("marketing director brief refresh throttle", () => {
  it("throttles when refresh is too soon", () => {
    const now = Date.now();
    expect(
      isBriefRefreshThrottled({
        lastUpdatedAt: new Date(now - 10_000).toISOString(),
        now,
        minIntervalMs: 45_000,
      }),
    ).toBe(true);
  });

  it("allows refresh after cooldown", () => {
    const now = Date.now();
    expect(
      isBriefRefreshThrottled({
        lastUpdatedAt: new Date(now - 120_000).toISOString(),
        now,
        minIntervalMs: 45_000,
      }),
    ).toBe(false);
  });
});
