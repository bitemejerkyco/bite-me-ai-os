import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DailyBriefPanel from "@/components/marketing-director/DailyBriefPanel";
import type { DailyBrief } from "@/features/marketing-director/daily-brief-rules";

vi.mock("@/components/marketing-director/AIThinkingProgress", () => ({
  default: () => null,
}));

function createBrief(overrides: Partial<DailyBrief> = {}): DailyBrief {
  return {
    workspaceId: "ws-1",
    generatedAt: "2026-08-02T10:00:00.000Z",
    executiveNarrative: "Campaign momentum is stable with a clear opportunity in approvals.",
    confidence: 0.66,
    confidenceReason: "Connected channels provide moderate confidence.",
    dataQualityWarning: null,
    dataCoverageSummary: "66% confidence across 6 evaluated data sources.",
    scoreDeltaLabel: "Marketing Score unchanged from prior snapshot.",
    revenueAvailability: "unavailable",
    bestPerformanceSignal: "Approval queue reduction trend is emerging.",
    missingIntegrations: ["Product Catalog"],
    sinceLastVisit: [
      "2 new draft(s) created in the last 24 hours.",
      "1 scheduled post update(s) in the last 24 hours.",
      "0 AI usage event(s) in the last 24 hours.",
    ],
    needsAttention: ["Approval backlog remains high"],
    performingWell: ["At least one campaign is active."],
    underperforming: ["Analytics Coverage: incomplete"],
    recommendedNextAction: {
      id: "action-1",
      priority: "high",
      priorityScore: 95,
      title: "Approve queued content before noon",
      impact: "Publishing velocity is constrained",
      description: "",
      metricLabel: "Awaiting approval",
      metricValue: "7",
      supportingMetric: "7 drafts waiting",
      ctaLabel: "Open approvals",
      source: "approvals",
      reason: "Backlog pressure",
      status: "open",
      href: "/content-library?status=awaiting-approval",
      createdAt: "2026-08-02T09:00:00.000Z",
      dueAt: null,
      workspaceId: "ws-1",
    },
    urgency: {
      level: "high",
      label: "High urgency",
      summary: "High urgency due to approval backlog.",
      factors: ["7 items awaiting approval"],
      hasUrgentWork: true,
    },
    metrics: [
      {
        id: "marketing-score",
        label: "Marketing Score",
        value: "72.0 / 100",
        trend: "up",
        note: "steady confidence",
      },
      {
        id: "active-campaigns",
        label: "Active campaigns",
        value: "3",
        trend: "flat",
        note: "Real campaign records",
      },
      {
        id: "approval-queue",
        label: "Awaiting approval",
        value: "7",
        trend: "up",
        note: "Draft + schedule approval queue",
      },
      {
        id: "revenue-impact",
        label: "Revenue impact",
        value: "Insufficient connected revenue data",
        trend: "unknown",
        note: "No reliable conversion revenue source",
      },
    ],
    priorityActions: [],
    recommendations: [],
    autonomousRecommendations: [],
    morningBrief: {
      overnightChanges: [],
      wins: [],
      risks: [],
      urgentActions: ["Complete product setup before launching next campaign."],
      opportunities: [],
      marketingScoreChanges: [],
      campaignPerformance: [],
      aiRecommendations: [],
      estimatedBusinessImpact: "Improved campaign precision expected after setup.",
    },
    ...overrides,
  };
}

describe("DailyBriefPanel executive brief cohesion", () => {
  it("renders core executive brief sections and compact metric labels", () => {
    const html = renderToStaticMarkup(createElement(DailyBriefPanel, {
      brief: createBrief(),
      greeting: "Good morning",
      firstName: "Alex",
    }));

    expect(html).toContain("Executive Brief");
    expect(html).toContain("A concise summary of what matters most right now.");
    expect(html).toContain("Marketing Score");
    expect(html).toContain("Active Campaigns");
    expect(html).toContain("Awaiting Approval");
    expect(html).toContain("Scheduled Content");
    expect(html).toContain("Top Priority");
    expect(html).toContain("Needs Attention");
    expect(html).toContain("Since Last Visit");
    expect(html).toContain("AI Guidance");
  });

  it("avoids deprecated fallback phrases in rendered output", () => {
    const html = renderToStaticMarkup(createElement(DailyBriefPanel, {
      brief: createBrief({
        executiveNarrative: "Coverage summary unavailable. No prior snapshot. No strong performance signal.",
      }),
      greeting: "Good morning",
      firstName: "Alex",
    }));

    expect(html).not.toContain("Coverage summary unavailable");
    expect(html).not.toContain("Revenue impact unavailable");
    expect(html).not.toContain("No prior snapshot");
    expect(html).not.toContain("No strong performance signal");
    expect(html).toContain("Your immediate priority is");
  });

  it("renders fallback timeline message when visit deltas are empty", () => {
    const html = renderToStaticMarkup(createElement(DailyBriefPanel, {
      brief: createBrief({
        sinceLastVisit: [
          "0 new draft(s) created in the last 24 hours.",
          "0 scheduled post update(s) in the last 24 hours.",
          "0 AI usage event(s) in the last 24 hours.",
        ],
      }),
      greeting: "Good morning",
      firstName: "Alex",
    }));

    expect(html).toContain("No meaningful changes since your last visit.");
    expect(html).toContain("PostMotive will summarize new drafts, approvals, publishing activity, and integration updates here.");
  });

  it("shows action-oriented CTAs for priority, attention, and guidance", () => {
    const html = renderToStaticMarkup(createElement(DailyBriefPanel, {
      brief: createBrief(),
      greeting: "Good morning",
      firstName: "Alex",
    }));

    expect(html).toContain("Open approvals");
    expect(html).toContain("Complete Product Setup");
    expect(html).toContain("View Full Brief");
    expect(html).toContain("Refresh");
  });

  it("exposes accessible section labels for executive brief blocks", () => {
    const html = renderToStaticMarkup(createElement(DailyBriefPanel, {
      brief: createBrief(),
      greeting: "Good morning",
      firstName: "Alex",
    }));

    expect(html).toContain("aria-label=\"Executive Brief\"");
    expect(html).toContain("aria-label=\"Executive Brief key metrics\"");
    expect(html).toContain("aria-label=\"Top Priority\"");
    expect(html).toContain("aria-label=\"Needs Attention\"");
    expect(html).toContain("aria-label=\"Since Last Visit\"");
    expect(html).toContain("aria-label=\"AI Guidance\"");
  });
});
