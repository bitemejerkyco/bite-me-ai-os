import { describe, expect, it } from "vitest";
import { calculateContentScore } from "@/features/core/content-score";
import type {
  PerformanceSnapshot,
  ScheduledPost,
} from "@/features/core/local-os";

const post: ScheduledPost = {
  id: "11111111-1111-4111-8111-111111111111",
  entryType: "POST",
  channel: "TikTok",
  title: "Trail post",
  content: "Ready to ride.",
  scheduledFor: "2026-07-30T16:00:00.000Z",
  timezone: "America/Los_Angeles",
  status: "PUBLISHED",
};

function snapshot(
  values: Partial<PerformanceSnapshot> = {},
): PerformanceSnapshot {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    scheduledPostId: post.id,
    source: "PROVIDER",
    impressions: 10_000,
    reach: 8_000,
    engagements: 600,
    clicks: 400,
    conversions: 20,
    revenue: 500,
    spend: 0,
    currency: "USD",
    recordedAt: "2026-07-31T16:00:00.000Z",
    ...values,
  };
}

describe("content score", () => {
  it("grades a strong organic post and identifies strengths", () => {
    const result = calculateContentScore(post, snapshot());
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.grade).toBe("A");
    expect(result.confidence).toBe("HIGH");
    expect(result.strengths).toContain("Strong engagement");
  });

  it("scores paid-ad efficiency and marks small samples low confidence", () => {
    const result = calculateContentScore(
      { ...post, entryType: "AD" },
      snapshot({
        impressions: 200,
        reach: 180,
        engagements: 3,
        clicks: 2,
        conversions: 0,
        revenue: 20,
        spend: 100,
      }),
    );
    expect(result.score).toBeLessThan(55);
    expect(result.grade).toBe("D");
    expect(result.confidence).toBe("LOW");
  });
});
