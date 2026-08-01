import { describe, expect, it } from "vitest";
import { buildPriorityActions } from "@/features/marketing-director/priority-actions";

describe("marketing director priority actions", () => {
  it("returns critical actions first", () => {
    const actions = buildPriorityActions({
      workspaceId: "ws-1",
      onboardingComplete: false,
      hasLogo: false,
      hasBrandVoice: false,
      tiktokStatus: "reconnect_required",
      tiktokInboxPending: 1,
      draftsAwaitingApproval: 2,
      failedScheduledPosts: 0,
      failedVideoRenders: 0,
      amazonAdsConnected: false,
      amazonRecommendationsReady: false,
      hasProductsTable: false,
      productsCount: null,
      mediaAssetsCount: 0,
      approvedDrafts: 0,
      upcomingScheduledPosts: 0,
      integrationErrors: 1,
      lowScoreCategories: [{ key: "contentConsistency", label: "Content Consistency", status: "critical" }],
    });

    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0]?.priority).toBe("critical");
  });

  it("deduplicates by action id", () => {
    const actions = buildPriorityActions({
      workspaceId: "ws-2",
      onboardingComplete: true,
      hasLogo: true,
      hasBrandVoice: true,
      tiktokStatus: "connected",
      tiktokInboxPending: 2,
      draftsAwaitingApproval: 0,
      failedScheduledPosts: 0,
      failedVideoRenders: 0,
      amazonAdsConnected: true,
      amazonRecommendationsReady: true,
      hasProductsTable: true,
      productsCount: 10,
      mediaAssetsCount: 2,
      approvedDrafts: 0,
      upcomingScheduledPosts: 2,
      integrationErrors: 0,
      lowScoreCategories: [],
    });

    const ids = actions.map((action) => action.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
