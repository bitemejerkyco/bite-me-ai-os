import { describe, expect, it } from "vitest";
import { formatTrendIndicator } from "@/features/marketing-director/trends";

describe("marketing director trend indicators", () => {
  it("returns null when no prior snapshot exists", () => {
    const label = formatTrendIndicator({
      available: false,
      direction: "unknown",
      delta: 0,
      previousScore: null,
      currentScore: 65,
      previousGeneratedAt: null,
      currentGeneratedAt: "2026-08-01T10:00:00.000Z",
    });

    expect(label).toBeNull();
  });

  it("formats upward movement with arrow and period", () => {
    const label = formatTrendIndicator({
      available: true,
      direction: "up",
      delta: 3.2,
      previousScore: 61.8,
      currentScore: 65,
      previousGeneratedAt: "2026-07-31T10:00:00.000Z",
      currentGeneratedAt: "2026-08-01T10:00:00.000Z",
    });

    expect(label).toBe("▲ 3.2 since yesterday");
  });

  it("formats downward movement with arrow and fallback period", () => {
    const label = formatTrendIndicator({
      available: true,
      direction: "down",
      delta: -1.4,
      previousScore: 66.4,
      currentScore: 65,
      previousGeneratedAt: "2026-07-28T10:00:00.000Z",
      currentGeneratedAt: "2026-08-01T10:00:00.000Z",
    });

    expect(label).toBe("▼ 1.4 since last snapshot");
  });
});
