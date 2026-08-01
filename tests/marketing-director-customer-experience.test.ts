import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MarketingDirectorDashboardView from "@/components/marketing-director/MarketingDirectorDashboard";
import RecommendationActionCard from "@/components/marketing-director/RecommendationActionCard";
import { buildDefaultRecommendationEntitlements, resolveRecommendationActions } from "@/features/marketing-director/recommendation-workflows";
import type { MarketingDirectorPlanAction } from "@/features/marketing-director/conversational-plan";

function action(overrides: Partial<MarketingDirectorPlanAction> = {}): MarketingDirectorPlanAction {
  return {
    id: "rec-1",
    title: "Add products to your catalog",
    description: "Your product catalog is empty.",
    priority: "high",
    target: "/products",
    requiresApproval: true,
    executionStatus: "approval_required",
    supportingData: "0 active products.",
    estimatedEffortMinutes: 20,
    control: "Review",
    ...overrides,
  };
}

describe("marketing director customer-safe experience", () => {
  it("customer view hides internal route and admin view can see technical details", () => {
    const runtime = {
      recommendationId: "rec-1",
      recommendationType: "PRODUCT_SETUP",
      workflowStatus: "NOT_STARTED",
      actions: [
        {
          id: "rec-1_open_campaign",
          kind: "OPEN_CAMPAIGN",
          label: "Add Products",
          href: "/products",
          requiresApproval: false,
          disabled: false,
          primary: true,
        },
      ],
      impact: { itemsReady: 0 },
      evidence: { reason: "No products exist in the connected catalog.", supportingMetric: "0 active products.", missingDependency: "Product-specific campaigns are unavailable." },
      progress: [],
      draftId: null,
      scheduledPostId: null,
    } as const;

    const customerHtml = renderToStaticMarkup(
      createElement(RecommendationActionCard, {
        action: action(),
        runtime,
        canViewTechnicalDetails: false,
        pendingGenerate: false,
        pendingAction: false,
        onGenerate: () => undefined,
        onRegenerate: () => undefined,
        onApprove: () => undefined,
        onReject: () => undefined,
        onDismiss: () => undefined,
        onDefer: () => undefined,
        onPublishNow: () => undefined,
        onOpenActionHref: () => undefined,
      }),
    );

    expect(customerHtml).not.toContain("/products");
    expect(customerHtml).not.toContain("Technical details");

    const adminHtml = renderToStaticMarkup(
      createElement(RecommendationActionCard, {
        action: action(),
        runtime,
        canViewTechnicalDetails: true,
        pendingGenerate: false,
        pendingAction: false,
        onGenerate: () => undefined,
        onRegenerate: () => undefined,
        onApprove: () => undefined,
        onReject: () => undefined,
        onDismiss: () => undefined,
        onDefer: () => undefined,
        onPublishNow: () => undefined,
        onOpenActionHref: () => undefined,
      }),
    );

    expect(adminHtml).toContain("Technical details");
    expect(adminHtml).toContain("/products");
  });

  it("product, integration, and media recommendations do not expose generate content actions", () => {
    const entitlements = buildDefaultRecommendationEntitlements();

    const productActions = resolveRecommendationActions({
      recommendation: { recommendation: action({ title: "Add products to your catalog", target: "/products" }), route: "/products" },
      workflowStatus: "NOT_STARTED",
      operatingMode: "copilot",
      entitlements,
    });
    const integrationActions = resolveRecommendationActions({
      recommendation: { recommendation: action({ title: "Connect Amazon Ads", target: "/settings/integrations/amazon-ads" }), route: "/settings/integrations/amazon-ads" },
      workflowStatus: "NOT_STARTED",
      operatingMode: "copilot",
      entitlements,
    });
    const mediaActions = resolveRecommendationActions({
      recommendation: { recommendation: action({ title: "Upload Logo", target: "/media" }), route: "/media" },
      workflowStatus: "NOT_STARTED",
      operatingMode: "copilot",
      entitlements,
    });

    expect(productActions.some((item) => item.kind === "GENERATE_CONTENT")).toBe(false);
    expect(integrationActions.some((item) => item.kind === "GENERATE_CONTENT")).toBe(false);
    expect(mediaActions.some((item) => item.kind === "GENERATE_CONTENT")).toBe(false);
  });

  it("renders a first-time welcome state and truthful AI summary for limited workspaces", () => {
    const html = renderToStaticMarkup(
      createElement(MarketingDirectorDashboardView, {
        canViewTechnicalDetails: false,
        dashboard: {
          greeting: "Good afternoon",
          firstName: "Keith",
          workspaceName: "PostMotive",
          dateLabel: "Monday, August 1, 2026",
          modeSettings: {
            operatingMode: "advisor",
            autonomyLevel: 3,
            autopilotMessage: "Autopilot remains restricted.",
          },
          brief: {
            executiveNarrative: "There is not enough setup to move quickly yet.",
            generatedAt: "2026-08-01T10:00:00.000Z",
            metrics: [],
            dataCoverageSummary: "40% confidence across current workspace records.",
            urgency: { summary: "Medium urgency", level: "medium", label: "Medium", factors: [], hasUrgentWork: false },
            sinceLastVisit: [],
            morningBrief: { overnightChanges: [], wins: [], risks: [], urgentActions: [], opportunities: [], marketingScoreChanges: [], campaignPerformance: [], aiRecommendations: [], estimatedBusinessImpact: "No deterministic business impact available yet." },
            scoreDeltaLabel: "No prior snapshot available",
            bestPerformanceSignal: "No strong signal yet",
            recommendations: [],
            priorityActions: [],
            confidence: 0.4,
            confidenceReason: "Limited connected data",
            dataQualityWarning: "Limited data",
            revenueAvailability: "unavailable",
            missingIntegrations: ["Amazon Ads"],
            needsAttention: [],
            performingWell: [],
            underperforming: [],
            recommendedNextAction: { title: "Review pending drafts" },
            autonomousRecommendations: [],
            workspaceId: "ws-1",
          },
          dataCoverage: {
            overallConfidence: 0.4,
            warning: "Limited data",
            generatedAt: "2026-08-01T10:00:00.000Z",
            workspaceId: "ws-1",
            sources: [
              { key: "workspace_profile", label: "Workspace profile", connected: true, configured: false, lastSyncedAt: null, recordCount: 0, health: "limited", confidenceContribution: 0.6, message: "Incomplete" },
              { key: "products", label: "Products", connected: false, configured: false, lastSyncedAt: null, recordCount: 0, health: "missing", confidenceContribution: 0, message: "Missing" },
            ],
          },
          cards: [],
          biggestOpportunity: "Finish setup to unlock stronger recommendations.",
          biggestRisk: "Missing setup is limiting execution.",
          autonomyLevel: 3,
          approvalSummary: { pending: 8, approved: 0, rejected: 0, editRequested: 0 },
          publishingQueue: { queued: 6, preparing: 0, publishing: 0, published: 0, retry: 0, failed: 0, cancelled: 0 },
          pendingNotifications: 0,
          score: { score: 42, maximumScore: 100, status: "warning", confidence: 0.4, confidenceReason: "Limited data", scoreVersion: "v1", generatedAt: "2026-08-01T10:00:00.000Z", workspaceId: "ws-1", categories: [], weightedBreakdown: {} },
          scoreTrend: { available: false, direction: "unknown", delta: 0, previousScore: null, currentScore: 42, previousGeneratedAt: null, currentGeneratedAt: "2026-08-01T10:00:00.000Z" },
          channelHealth: [
            { key: "tiktok", label: "TikTok", connected: true, health: "healthy", message: "Connected", lastSyncedAt: null },
            { key: "amazon_ads", label: "Amazon Ads", connected: false, health: "missing", message: "Not connected", lastSyncedAt: null },
          ],
          forecastSummary: [],
          departments: [],
          timeline: [],
          autonomousRecommendations: [],
          aiHealth: { acceptanceRate: "0.0%", executionSuccessRate: "0.0%", publishingSuccessRate: "0.0%", forecastAccuracyRate: "0.0%", status: "warning" },
          workflowSummary: { total: 0, inProgress: 0, blocked: 0, awaitingApproval: 0, publishing: 0, completed: 0, failed: 0, cancelled: 0 },
          memorySignals: [],
        },
      } as never),
    );

    expect(html).toContain("Welcome to PostMotive");
    expect(html).toContain("PostMotive found:");
    expect(html).toContain("Amazon Ads not connected");
    expect(html).toContain("Product catalog empty");
    expect(html).toContain("Review pending drafts");
  });
});
