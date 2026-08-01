import { describe, expect, it } from "vitest";
import {
  buildAutonomousRecommendations,
  buildExecutiveOpportunityRisk,
} from "@/features/marketing-director/autonomous-intelligence";

describe("autonomous marketing director intelligence", () => {
  const baseInput = {
    workspaceId: "ws-1",
    brief: {
      workspaceId: "ws-1",
      generatedAt: "2026-08-01T08:00:00.000Z",
      executiveNarrative: "Narrative",
      confidence: 0.72,
      confidenceReason: "Connected data",
      dataQualityWarning: null,
      dataCoverageSummary: "72% confidence",
      scoreDeltaLabel: "Score is down by 5 points.",
      revenueAvailability: "available" as const,
      bestPerformanceSignal: "Instagram engagement increased 24%.",
      missingIntegrations: [],
      sinceLastVisit: [],
      needsAttention: ["Approval queue is growing"],
      performingWell: ["Instagram engagement increased 24%"],
      underperforming: [],
      recommendedNextAction: null,
      urgency: {
        level: "high" as const,
        label: "High",
        summary: "High urgency",
        factors: [],
        hasUrgentWork: true,
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
    score: {
      workspaceId: "ws-1",
      score: 61,
      maximumScore: 100,
      status: "needs_attention" as const,
      confidence: 0.7,
      confidenceReason: "Partial",
      scoreVersion: "v1",
      generatedAt: "2026-08-01T08:00:00.000Z",
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
      available: true,
      direction: "down" as const,
      delta: -5,
      previousScore: 66,
      currentScore: 61,
      previousGeneratedAt: "2026-07-31T08:00:00.000Z",
      currentGeneratedAt: "2026-08-01T08:00:00.000Z",
    },
    memorySignals: [
      {
        key: "approval_pattern" as const,
        insight: "User typically approves content before scheduling.",
        confidence: 0.86,
        source: "command_activity",
        lastObservedAt: "2026-08-01T08:00:00.000Z",
      },
    ],
    metrics: {
      activeCampaigns: 2,
      scheduledPosts: 0,
      draftsAwaitingApproval: 4,
      connectedChannels: 1,
      recentScheduledPosts24h: 0,
      revenueLast30Days: 2100,
      impressionsLast30Days: 50000,
      clicksLast30Days: 300,
      engagementsLast30Days: 800,
      spendLast30Days: 1000,
    },
  };

  it("generates proactive recommendations with required executive fields", () => {
    const recommendations = buildAutonomousRecommendations(baseInput);

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]?.businessImpact).toBeTruthy();
    expect(recommendations[0]?.expectedOutcome).toBeTruthy();
    expect(recommendations[0]?.nextWorkflow).toBeTruthy();
    expect(recommendations[0]?.confidence).toBeGreaterThan(0);
    expect(recommendations.some((item) => item.crossChannelPlan.length > 0)).toBe(true);
  });

  it("derives executive opportunity and risk summaries", () => {
    const summary = buildExecutiveOpportunityRisk(baseInput);
    expect(summary.biggestOpportunity).toContain("Instagram engagement");
    expect(summary.biggestRisk).toContain("Approval queue");
  });
});
