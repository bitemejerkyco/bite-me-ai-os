import { describe, expect, it } from "vitest";
import {
  SCORE_CATEGORY_DESTINATIONS,
  recommendationActionForCategory,
} from "@/features/marketing-director/score-category-routes";

describe("marketing director score category routes", () => {
  it("maps category keys to expected operational routes", () => {
    expect(SCORE_CATEGORY_DESTINATIONS.brandFoundation).toBe("/onboarding");
    expect(SCORE_CATEGORY_DESTINATIONS.contentConsistency).toBe("/media?tab=CONTENT_DRAFTS");
    expect(SCORE_CATEGORY_DESTINATIONS.contentReadiness).toBe("/media?tab=CONTENT_DRAFTS");
    expect(SCORE_CATEGORY_DESTINATIONS.channelConnections).toBe("/integrations");
    expect(SCORE_CATEGORY_DESTINATIONS.campaignActivity).toBe("/marketing/campaigns");
    expect(SCORE_CATEGORY_DESTINATIONS.analyticsCoverage).toBe("/analytics");
    expect(SCORE_CATEGORY_DESTINATIONS.audienceEngagement).toBe("/analytics");
    expect(SCORE_CATEGORY_DESTINATIONS.paidMediaHealth).toBe("/integrations");
    expect(SCORE_CATEGORY_DESTINATIONS.emailHealth).toBe("/integrations");
    expect(SCORE_CATEGORY_DESTINATIONS.complianceReadiness).toBe("/settings");
  });

  it("returns specific recommendation CTA mappings", () => {
    expect(recommendationActionForCategory("analyticsCoverage")).toEqual({
      label: "Connect analytics",
      href: "/integrations",
    });
    expect(recommendationActionForCategory("contentReadiness")).toEqual({
      label: "Review drafts",
      href: "/media?tab=CONTENT_DRAFTS",
    });
    expect(recommendationActionForCategory("paidMediaHealth")).toEqual({
      label: "Open integrations",
      href: "/integrations",
    });
  });
});
