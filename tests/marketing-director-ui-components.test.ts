import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CommandCenter from "@/components/marketing-director/CommandCenter";
import MarketingScoreCard from "@/components/marketing-director/MarketingScoreCard";
import PriorityActions from "@/components/marketing-director/PriorityActions";
import type { DailyBrief } from "@/features/marketing-director/daily-brief-rules";

describe("marketing director dashboard component polish", () => {
  it("hides blank reason and source labels in priority actions", () => {
    const action: DailyBrief["priorityActions"][number] = {
      id: "a-1",
      priority: "high",
      priorityScore: 100,
      title: "Approve content drafts",
      impact: "Publishing is blocked until drafts are approved.",
      description: "",
      metricLabel: "",
      metricValue: "",
      supportingMetric: "8 drafts awaiting approval",
      ctaLabel: "Review drafts",
      source: "",
      reason: "",
      status: "open",
      href: "/content-library?status=awaiting-approval",
      createdAt: "2026-08-01T10:00:00.000Z",
      dueAt: null,
      workspaceId: "ws-1",
    };

    const html = renderToStaticMarkup(
      createElement(PriorityActions, {
        actions: [action],
        urgency: {
          level: "high",
          label: "High urgency",
          summary: "High urgency: 8 items awaiting approval.",
          factors: ["8 items awaiting approval"],
          hasUrgentWork: true,
        },
      }),
    );

    expect(html).toContain("8 drafts awaiting approval");
    expect(html).toContain("Review drafts");
    expect(html).not.toContain("Reason:</span>");
    expect(html).not.toContain("Source:</span>");
  });

  it("renders command center heading, suggestion chips, and advisor safety helper text", () => {
    const html = renderToStaticMarkup(createElement(CommandCenter, { modeLabel: "Advisor", canViewTechnicalDetails: false }));

    expect(html).toContain("Ask your AI Marketing Director anything");
    expect(html).toContain("Build my September campaign");
    expect(html).toContain("Increase Amazon sales");
    expect(html).toContain("PostMotive will build the plan, identify approvals, and prepare the next steps");
    expect(html).toContain("Generate proposal");
  });

  it("renders marketing score breakdown inside a collapsed details panel", () => {
    const html = renderToStaticMarkup(
      createElement(MarketingScoreCard, {
        score: {
          workspaceId: "ws-1",
          score: 65,
          maximumScore: 100,
          status: "needs_attention",
          confidence: 0.6,
          confidenceReason: "Partial confidence",
          scoreVersion: "marketing-score-v1",
          generatedAt: "2026-08-01T10:00:00.000Z",
          categories: [
            {
              key: "brandFoundation",
              label: "Brand Foundation",
              score: 12,
              maximumScore: 15,
              status: "healthy",
              explanation: "Configured",
              evidence: [],
              recommendedAction: "None",
              confidence: 0.9,
            },
          ],
          weightedBreakdown: {
            brandFoundation: 12,
            contentConsistency: 8,
            contentReadiness: 6,
            channelConnections: 6,
            campaignActivity: 7,
            analyticsCoverage: 7,
            audienceEngagement: 6,
            paidMediaHealth: 5,
            emailHealth: 4,
            complianceReadiness: 4,
          },
        },
        trend: {
          available: false,
          direction: "unknown",
          delta: 0,
          previousScore: null,
          currentScore: 65,
          previousGeneratedAt: null,
          currentGeneratedAt: "2026-08-01T10:00:00.000Z",
        },
        collapsible: true,
      }),
    );

    expect(html).toContain("<details");
    expect(html).toContain("Marketing Score category breakdown");
    expect(html).toContain("Baseline snapshot will appear after more activity is recorded.");
    expect(html).toContain("href=\"/onboarding\"");
  });

  it("retains focus-visible classes for clickable cards and buttons", () => {
    const action: DailyBrief["priorityActions"][number] = {
      id: "a-2",
      priority: "medium",
      priorityScore: 60,
      title: "Review campaigns",
      impact: "Keep execution aligned",
      description: "",
      metricLabel: "Active campaigns",
      metricValue: "2",
      supportingMetric: "2 active campaigns",
      ctaLabel: "Open campaigns",
      source: "campaigns",
      reason: "Campaigns exist",
      status: "open",
      href: "/marketing/campaigns",
      createdAt: "2026-08-01T10:00:00.000Z",
      dueAt: null,
      workspaceId: "ws-1",
    };

    const html = renderToStaticMarkup(
      createElement(PriorityActions, {
        actions: [action],
        urgency: {
          level: "medium",
          label: "Moderate urgency",
          summary: "Moderate urgency",
          factors: [],
          hasUrgentWork: false,
        },
      }),
    );

    expect(html).toContain("focus-visible:ring-violet-500");
  });
});
