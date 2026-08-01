import { describe, expect, it } from "vitest";
import { recommendPublishingSchedule } from "@/features/marketing-director/ai-scheduling-engine";

describe("ai-scheduling-engine", () => {
  it("returns deterministic recommendations per channel", () => {
    const schedule = recommendPublishingSchedule({
      existingSlots: [],
      engagementHistory: [
        { channel: "tiktok", hourUtc: 16, engagementScore: 0.9 },
        { channel: "instagram", hourUtc: 14, engagementScore: 0.8 },
      ],
      preferredChannels: ["tiktok", "instagram"],
      startDateIso: "2026-08-01T00:00:00.000Z",
      horizonDays: 7,
    });

    expect(schedule).toHaveLength(2);
    expect(schedule[0]?.channel).toBe("tiktok");
    expect(schedule[0]?.score).toBeGreaterThan(0.4);
  });

  it("avoids direct slot collisions", () => {
    const schedule = recommendPublishingSchedule({
      existingSlots: [{ scheduledFor: "2026-08-01T16:00:00.000Z", channel: "tiktok" }],
      engagementHistory: [{ channel: "tiktok", hourUtc: 16, engagementScore: 0.95 }],
      preferredChannels: ["tiktok"],
      startDateIso: "2026-08-01T00:00:00.000Z",
      horizonDays: 3,
    });

    expect(schedule[0]?.collision).toBe(true);
    expect(schedule[0]?.scheduledFor).not.toBe("2026-08-01T16:00:00.000Z");
  });
});
