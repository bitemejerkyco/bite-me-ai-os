import { describe, expect, it } from "vitest";
import { buildPerformanceLearningSignals } from "@/features/marketing-director/performance-learning";

describe("performance-learning", () => {
  it("extracts winner and loser channels from snapshots", () => {
    const signals = buildPerformanceLearningSignals([
      {
        channel: "tiktok",
        impressions: 1000,
        engagements: 160,
        clicks: 70,
        revenue: 250,
        hook: "How-to",
        cta: "Shop now",
        postedHourUtc: 16,
      },
      {
        channel: "email",
        impressions: 1000,
        engagements: 20,
        clicks: 8,
        revenue: 10,
        hook: "Announcement",
        cta: "Learn more",
        postedHourUtc: 9,
      },
    ]);

    expect(signals.winners).toContain("tiktok");
    expect(signals.losers).toContain("email");
    expect(signals.bestPostingHoursUtc.length).toBeGreaterThan(0);
  });

  it("returns empty-safe structure without snapshots", () => {
    const signals = buildPerformanceLearningSignals([]);
    expect(signals.winners).toHaveLength(0);
    expect(signals.notes[0]).toContain("No performance snapshots");
  });
});
