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
      pendingScheduledPosts: 2,
      integrationErrors: 1,
      activeCampaigns: 1,
      failedTikTokJobs: 1,
      missingIntegrations: ["TikTok", "Revenue tracking"],
      revenueAvailable: false,
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
      pendingScheduledPosts: 0,
      integrationErrors: 0,
      activeCampaigns: 1,
      failedTikTokJobs: 0,
      missingIntegrations: [],
      revenueAvailable: true,
      lowScoreCategories: [],
    });

    const ids = actions.map((action) => action.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("hides content creation action when approved or scheduled content exists", () => {
    const actions = buildPriorityActions({
      workspaceId: "ws-3",
      onboardingComplete: true,
      hasLogo: true,
      hasBrandVoice: true,
      tiktokStatus: "connected",
      tiktokInboxPending: 0,
      draftsAwaitingApproval: 0,
      failedScheduledPosts: 0,
      failedVideoRenders: 0,
      amazonAdsConnected: true,
      amazonRecommendationsReady: false,
      hasProductsTable: true,
      productsCount: 2,
      mediaAssetsCount: 4,
      approvedDrafts: 1,
      upcomingScheduledPosts: 2,
      pendingScheduledPosts: 0,
      integrationErrors: 0,
      activeCampaigns: 0,
      failedTikTokJobs: 0,
      missingIntegrations: [],
      revenueAvailable: true,
      lowScoreCategories: [],
    });

    expect(actions.some((action) => action.id === "create-content-pipeline")).toBe(false);
  });

  it("maps approval backlog action to content approval queue with non-empty CTA fields", () => {
    const actions = buildPriorityActions({
      workspaceId: "ws-4",
      onboardingComplete: true,
      hasLogo: true,
      hasBrandVoice: true,
      tiktokStatus: "connected",
      tiktokInboxPending: 0,
      draftsAwaitingApproval: 8,
      failedScheduledPosts: 0,
      failedVideoRenders: 0,
      amazonAdsConnected: true,
      amazonRecommendationsReady: false,
      hasProductsTable: true,
      productsCount: 5,
      mediaAssetsCount: 2,
      approvedDrafts: 0,
      upcomingScheduledPosts: 0,
      pendingScheduledPosts: 0,
      integrationErrors: 0,
      activeCampaigns: 0,
      failedTikTokJobs: 0,
      missingIntegrations: [],
      revenueAvailable: true,
      lowScoreCategories: [],
    });

    const approvalAction = actions.find((action) => action.id === "approve-content-drafts");
    expect(approvalAction).toBeTruthy();
    expect(approvalAction?.href).toBe("/media?tab=CONTENT_DRAFTS");
    expect(approvalAction?.ctaLabel.trim().length).toBeGreaterThan(0);
    expect(approvalAction?.supportingMetric).toContain("awaiting approval");
  });
});
