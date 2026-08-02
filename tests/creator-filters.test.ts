import { describe, expect, it } from "vitest";
import { buildCreatorDemoData } from "@/features/creators/demo-data";
import { filterCreators } from "@/features/creators/filter";

describe("creator filters", () => {
  it("filters by platform and engagement floor", () => {
    const demo = buildCreatorDemoData("ws_1", "user_1");
    const results = filterCreators(demo.creators, {
      platform: "TikTok",
      minEngagement: 0.07,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.platforms.some((platform) => platform.platform === "TikTok"))).toBe(true);
    expect(results.every((item) => item.engagementRate >= 0.07)).toBe(true);
  });

  it("supports safety and match score filters", () => {
    const demo = buildCreatorDemoData("ws_1", "user_1");
    const results = filterCreators(demo.creators, {
      safety: "SAFE",
      minMatch: 88,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.brandSafetyStatus === "SAFE" && item.matchScore >= 88)).toBe(true);
  });
});
