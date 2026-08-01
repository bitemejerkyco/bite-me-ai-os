import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildDailyBrief } from "@/features/marketing-director/daily-brief";

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

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
    const words = wordCount(brief.executiveNarrative);
    expect(words).toBeGreaterThanOrEqual(80);
    expect(words).toBeLessThanOrEqual(150);
  });

  it("builds an executive narrative in target length with partial performance data", () => {
    const brief = buildDailyBrief({
      workspaceId: "ws-2",
      workspaceName: "Test Workspace",
      score: {
        workspaceId: "ws-2",
        score: 72,
        maximumScore: 100,
        status: "healthy",
        confidence: 0.74,
        confidenceReason: "Connected campaign and publishing activity is available.",
        scoreVersion: "marketing-score-v1",
        generatedAt: new Date().toISOString(),
        categories: [
          {
            key: "campaignActivity",
            label: "Campaign Activity",
            score: 14,
            maximumScore: 16,
            status: "healthy",
            explanation: "Campaign activity is consistent.",
            evidence: [],
            recommendedAction: "Sustain campaign pacing",
            confidence: 0.8,
          },
          {
            key: "contentReadiness",
            label: "Content Readiness",
            score: 6,
            maximumScore: 14,
            status: "needs_attention",
            explanation: "Approval queue is growing.",
            evidence: [],
            recommendedAction: "Reduce approval delays",
            confidence: 0.7,
          },
        ],
        weightedBreakdown: {
          brandFoundation: 10,
          contentConsistency: 7,
          contentReadiness: 6,
          channelConnections: 8,
          campaignActivity: 14,
          analyticsCoverage: 7,
          audienceEngagement: 6,
          paidMediaHealth: 5,
          emailHealth: 4,
          complianceReadiness: 5,
        },
      },
      scoreTrend: {
        available: true,
        direction: "up",
        delta: 4,
        previousScore: 68,
        currentScore: 72,
        previousGeneratedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        currentGeneratedAt: new Date().toISOString(),
      },
      dataCoverage: {
        workspaceId: "ws-2",
        sources: [],
        overallConfidence: 0.65,
        warning: null,
        generatedAt: new Date().toISOString(),
      },
      metrics: {
        activeCampaigns: 3,
        draftsAwaitingApproval: 5,
        failedScheduledPosts: 0,
        pendingScheduledPosts: 2,
        failedTikTokJobs: 0,
        scheduledPosts: 11,
        connectedChannels: 2,
        tiktokStatus: "connected",
        tiktokInboxPending: 1,
        approvedDrafts: 4,
        mediaAssetsCount: 20,
        failedVideoRenders: 0,
        integrationErrors: 0,
        hasLogo: true,
        hasBrandVoice: true,
        onboardingComplete: true,
        amazonAdsConnected: false,
        amazonRecommendationsReady: false,
        hasProductsTable: true,
        productsCount: 12,
        recentDrafts24h: 3,
        recentScheduledPosts24h: 4,
        recentAiEvents24h: 12,
        lastVisitAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        revenueLast30Days: 2800,
      },
    });

    const words = wordCount(brief.executiveNarrative);
    expect(words).toBeGreaterThanOrEqual(80);
    expect(words).toBeLessThanOrEqual(150);
  });
});
