import { describe, expect, it } from "vitest";
import { buildMetricDrilldown } from "@/features/marketing-director/drilldowns";
import type { MarketingDirectorDashboard } from "@/features/marketing-director/dashboard";

function dashboardFixture(): MarketingDirectorDashboard {
  return {
    workspaceId: "ws-1",
    workspaceName: "Workspace",
    firstName: "Keith",
    dateLabel: "Friday",
    greeting: "Good afternoon",
    modeSettings: {
      operatingMode: "advisor",
      lockModeChanges: false,
      allowAutopilotExecution: false,
      requiresHumanApproval: true,
      autopilotMessage: "Advisor mode",
      updatedAt: "2026-08-01T10:00:00.000Z",
    },
    capabilities: {
      canGenerateProposals: true,
      canExecuteWithoutApproval: false,
      canScheduleContent: false,
      canPublishContent: false,
      canSpendBudget: false,
      lockedByAdmin: false,
      modeLabel: "Advisor",
    },
    cards: [
      {
        id: "ai_confidence",
        label: "AI Confidence",
        value: "65%",
        status: "warning",
        trendDirection: "unknown",
        trendLabel: null,
        detail: "Connected: TikTok",
        href: "/analytics/ai-confidence",
      },
    ],
    score: {
      workspaceId: "ws-1",
      score: 65,
      maximumScore: 100,
      status: "needs_attention",
      confidence: 0.65,
      confidenceReason: "Partial confidence",
      scoreVersion: "marketing-score-v1",
      generatedAt: "2026-08-01T10:00:00.000Z",
      categories: [],
      weightedBreakdown: {
        brandFoundation: 0,
        contentConsistency: 0,
        contentReadiness: 0,
        channelConnections: 0,
        campaignActivity: 0,
        analyticsCoverage: 0,
        audienceEngagement: 0,
        paidMediaHealth: 0,
        emailHealth: 0,
        complianceReadiness: 0,
      },
    },
    scoreTrend: {
      available: false,
      direction: "unknown",
      delta: 0,
      previousScore: null,
      currentScore: 65,
      previousGeneratedAt: null,
      currentGeneratedAt: "2026-08-01T10:00:00.000Z",
    },
    brief: {
      workspaceId: "ws-1",
      generatedAt: "2026-08-01T10:00:00.000Z",
      executiveNarrative: "Narrative",
      confidence: 0.6,
      confidenceReason: "Limited",
      dataQualityWarning: null,
      dataCoverageSummary: "summary",
      scoreDeltaLabel: "No prior snapshot",
      revenueAvailability: "unavailable",
      bestPerformanceSignal: "signal",
      missingIntegrations: [],
      sinceLastVisit: [],
      needsAttention: [],
      performingWell: [],
      underperforming: [],
      recommendedNextAction: null,
      urgency: {
        level: "none",
        label: "Stable",
        summary: "Stable",
        factors: [],
        hasUrgentWork: false,
      },
      metrics: [],
      priorityActions: [],
      recommendations: [],
      autonomousRecommendations: [],
      morningBrief: {
        overnightChanges: [],
        wins: [],
        risks: [],
        urgentActions: [],
        opportunities: [],
        marketingScoreChanges: [],
        campaignPerformance: [],
        aiRecommendations: [],
        estimatedBusinessImpact: "",
      },
    },
    dataCoverage: {
      workspaceId: "ws-1",
      overallConfidence: 0.65,
      warning: "Limited",
      generatedAt: "2026-08-01T10:00:00.000Z",
      sources: [
        {
          key: "tiktok",
          label: "TikTok",
          connected: true,
          configured: true,
          lastSyncedAt: "2026-08-01T09:00:00.000Z",
          recordCount: 1,
          health: "healthy",
          confidenceContribution: 1,
          message: "Connected",
        },
        {
          key: "amazon_ads",
          label: "Amazon Ads",
          connected: false,
          configured: false,
          lastSyncedAt: null,
          recordCount: 0,
          health: "missing",
          confidenceContribution: 0,
          message: "Missing",
        },
        {
          key: "social_analytics",
          label: "Social analytics",
          connected: true,
          configured: true,
          lastSyncedAt: "2026-07-01T09:00:00.000Z",
          recordCount: 1,
          health: "stale",
          confidenceContribution: 0.35,
          message: "Stale",
        },
        {
          key: "revenue_tracking",
          label: "Revenue tracking",
          connected: false,
          configured: false,
          lastSyncedAt: null,
          recordCount: 0,
          health: "missing",
          confidenceContribution: 0,
          message: "Missing",
        },
      ],
    },
    channelHealth: [],
    recentActivity: [],
  };
}

describe("marketing director ai confidence drilldown", () => {
  it("explains connected, missing, stale, and unavailable revenue factors", () => {
    const detail = buildMetricDrilldown(dashboardFixture(), "ai_confidence");

    expect(detail.explanation).toContain("connected sources");
    expect(detail.explanation).toContain("Missing or limited sources");
    expect(detail.explanation).toContain("Stale sources");
    expect(detail.explanation).toContain("Revenue or performance contribution remains incomplete");
  });
});
