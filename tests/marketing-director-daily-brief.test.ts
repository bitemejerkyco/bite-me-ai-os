import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildDailyBrief } from "@/features/marketing-director/daily-brief";

describe("marketing director daily brief", () => {
  it("marks revenue as unavailable when connected revenue is missing", () => {
    const brief = buildDailyBrief({
      workspaceId: "ws-1",
      workspaceName: "Test Workspace",
      score: {
        workspaceId: "ws-1",
        score: 60,
        maximumScore: 100,
        status: "needs_attention",
        confidence: 0.6,
        confidenceReason: "Partial data",
        scoreVersion: "marketing-score-v1",
        generatedAt: new Date().toISOString(),
        categories: [
          {
            key: "brandFoundation",
            label: "Brand Foundation",
            score: 10,
            maximumScore: 15,
            status: "needs_attention",
            explanation: "Needs more profile detail",
            evidence: [],
            recommendedAction: "Complete setup",
            confidence: 0.8,
          },
        ],
        weightedBreakdown: {
          brandFoundation: 10,
          contentConsistency: 5,
          contentReadiness: 5,
          channelConnections: 5,
          campaignActivity: 5,
          analyticsCoverage: 5,
          audienceEngagement: 5,
          paidMediaHealth: 5,
          emailHealth: 5,
          complianceReadiness: 5,
        },
      },
      scoreTrend: {
        available: false,
        direction: "unknown",
        delta: 0,
        previousScore: null,
        currentScore: 60,
        previousGeneratedAt: null,
        currentGeneratedAt: new Date().toISOString(),
      },
      dataCoverage: {
        workspaceId: "ws-1",
        sources: [],
        overallConfidence: 0.4,
        warning: "Limited data",
        generatedAt: new Date().toISOString(),
      },
      metrics: {
        activeCampaigns: 0,
        draftsAwaitingApproval: 0,
        failedScheduledPosts: 0,
        pendingScheduledPosts: 0,
        failedTikTokJobs: 0,
        scheduledPosts: 0,
        connectedChannels: 0,
        tiktokStatus: "disconnected",
        tiktokInboxPending: 0,
        approvedDrafts: 0,
        mediaAssetsCount: 0,
        failedVideoRenders: 0,
        integrationErrors: 0,
        hasLogo: false,
        hasBrandVoice: false,
        onboardingComplete: false,
        amazonAdsConnected: false,
        amazonRecommendationsReady: false,
        hasProductsTable: false,
        productsCount: null,
        recentDrafts24h: 0,
        recentScheduledPosts24h: 0,
        recentAiEvents24h: 0,
        lastVisitAt: null,
        revenueLast30Days: null,
      },
    });

    expect(brief.revenueAvailability).toBe("unavailable");
    const revenueMetric = brief.metrics.find((metric) => metric.id === "revenue-impact");
    expect(revenueMetric?.value).toContain("Insufficient connected revenue data");
  });
});
