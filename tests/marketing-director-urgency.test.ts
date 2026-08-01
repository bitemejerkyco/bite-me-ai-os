import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildDailyBrief } from "@/features/marketing-director/daily-brief";

describe("marketing director urgency consistency", () => {
  it("marks urgency and brief narrative when high-priority blockers exist", () => {
    const brief = buildDailyBrief({
      workspaceId: "ws-urgent",
      workspaceName: "Urgent Workspace",
      score: {
        workspaceId: "ws-urgent",
        score: 41,
        maximumScore: 100,
        status: "critical",
        confidence: 0.6,
        confidenceReason: "Partial confidence",
        scoreVersion: "marketing-score-v1",
        generatedAt: new Date().toISOString(),
        categories: [
          {
            key: "contentReadiness",
            label: "Content Readiness",
            score: 1,
            maximumScore: 10,
            status: "critical",
            explanation: "Approval queue is blocked",
            evidence: ["Approved drafts: 0", "Total drafts: 8"],
            recommendedAction: "Approve drafts",
            confidence: 0.8,
          },
        ],
        weightedBreakdown: {
          brandFoundation: 8,
          contentConsistency: 6,
          contentReadiness: 1,
          channelConnections: 5,
          campaignActivity: 5,
          analyticsCoverage: 4,
          audienceEngagement: 3,
          paidMediaHealth: 2,
          emailHealth: 2,
          complianceReadiness: 5,
        },
      },
      scoreTrend: {
        available: true,
        direction: "down",
        delta: -2.4,
        previousScore: 43.4,
        currentScore: 41,
        previousGeneratedAt: "2026-07-31T10:00:00.000Z",
        currentGeneratedAt: "2026-08-01T10:00:00.000Z",
      },
      dataCoverage: {
        workspaceId: "ws-urgent",
        sources: [
          {
            key: "amazon_ads",
            label: "Amazon Ads",
            connected: false,
            configured: false,
            lastSyncedAt: null,
            recordCount: 0,
            health: "limited",
            confidenceContribution: 0.6,
            message: "Not connected",
          },
        ],
        overallConfidence: 0.6,
        warning: "Limited data",
        generatedAt: new Date().toISOString(),
      },
      metrics: {
        activeCampaigns: 1,
        draftsAwaitingApproval: 8,
        failedScheduledPosts: 1,
        pendingScheduledPosts: 2,
        failedTikTokJobs: 0,
        scheduledPosts: 1,
        connectedChannels: 1,
        tiktokStatus: "connected",
        tiktokInboxPending: 0,
        approvedDrafts: 0,
        mediaAssetsCount: 2,
        failedVideoRenders: 0,
        integrationErrors: 0,
        hasLogo: true,
        hasBrandVoice: true,
        onboardingComplete: true,
        amazonAdsConnected: false,
        amazonRecommendationsReady: false,
        hasProductsTable: false,
        productsCount: null,
        recentDrafts24h: 3,
        recentScheduledPosts24h: 1,
        recentAiEvents24h: 2,
        lastVisitAt: null,
        revenueLast30Days: null,
      },
    });

    expect(brief.urgency.hasUrgentWork).toBe(true);
    expect(["critical", "high"]).toContain(brief.urgency.level);
    expect(brief.executiveNarrative).toContain("Highest-priority action");
    expect(brief.needsAttention.some((line) => line.toLowerCase().includes("approve"))).toBe(true);
  });
});
