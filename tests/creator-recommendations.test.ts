import { describe, expect, it } from "vitest";
import { buildCreatorDemoData } from "@/features/creators/demo-data";
import { buildCreatorRecommendations, CREATOR_RECOMMENDATION_LABEL } from "@/features/creators/recommendations";

describe("creator recommendations", () => {
  it("returns deterministic recommendations with bounded confidence", () => {
    const demo = buildCreatorDemoData("ws_1", "user_1");
    const results = buildCreatorRecommendations({
      context: {
        brandProfile: "Snack brand",
        industry: "Food and beverage",
        productsOrServices: ["jerky", "protein snack"],
        campaignGoal: "Awareness and conversion",
        targetAudience: "active adults and gym audience",
        location: "United States",
        connectedPlatforms: ["TikTok", "Instagram"],
      },
      creators: demo.creators,
      limit: 5,
    });

    expect(results.length).toBe(5);
    expect(results[0]?.matchScore).toBeGreaterThanOrEqual(results[1]?.matchScore || 0);
    expect(results.every((item) => item.confidence >= 0.2 && item.confidence <= 0.95)).toBe(true);
  });

  it("includes the required beta demo recommendation label", () => {
    expect(CREATOR_RECOMMENDATION_LABEL).toContain("demo creator profiles");
    expect(CREATOR_RECOMMENDATION_LABEL).toContain("workspace settings");
  });
});
