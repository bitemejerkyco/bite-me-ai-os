import { describe, expect, it } from "vitest";
import {
  buildDefaultRecommendationEntitlements,
  buildRecommendationRuntime,
  classifyRecommendationType,
  resolveRecommendationActions,
  validateRecommendationTransition,
} from "@/features/marketing-director/recommendation-workflows";
import type { MarketingDirectorPlanAction } from "@/features/marketing-director/conversational-plan";

function action(overrides: Partial<MarketingDirectorPlanAction> = {}): MarketingDirectorPlanAction {
  return {
    id: "task-1",
    title: "Create content pipeline",
    description: "Create content for launch",
    priority: "high",
    target: "/media?tab=CONTENT_DRAFTS",
    requiresApproval: true,
    executionStatus: "approval_required",
    supportingData: "6 drafts awaiting approval",
    estimatedEffortMinutes: 20,
    control: "Generate content plan",
    ...overrides,
  };
}

describe("marketing director recommendation workflows", () => {
  it("classifies recommendation type deterministically", () => {
    const kind = classifyRecommendationType({
      recommendation: action({ title: "Connect integrations for Amazon" }),
      route: "/integrations",
      source: "integration coverage gap",
    });

    expect(kind).toBe("INTEGRATION_CONNECTION");
  });

  it("does not include publish-now action for draft-created state", () => {
    const actions = resolveRecommendationActions({
      recommendation: {
        recommendation: action(),
      },
      workflowStatus: "DRAFT_CREATED",
      draftId: "draft-1",
      operatingMode: "copilot",
      entitlements: {
        ...buildDefaultRecommendationEntitlements(),
        canPublish: true,
      },
    });

    expect(actions.some((item) => item.kind === "PUBLISH_NOW")).toBe(false);
  });

  it("blocks publish-now in advisor mode with mode restricted error", () => {
    const runtime = buildRecommendationRuntime({
      recommendation: action({
        title: "Schedule and publish",
        control: "Approve publishing",
      }),
      operatingMode: "advisor",
      entitlements: {
        ...buildDefaultRecommendationEntitlements(),
        canPublish: true,
      },
      draftId: "draft-1",
      scheduledPostId: "post-1",
      scheduledStatus: "SCHEDULED",
      publishStatus: "SCHEDULED",
    });

    const result = validateRecommendationTransition({
      actionKind: "PUBLISH_NOW",
      allowedActions: runtime.actions,
      operatingMode: "advisor",
      workflowStatus: runtime.workflowStatus,
      draftId: runtime.draftId,
      scheduledPostId: runtime.scheduledPostId,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("ACTION_NOT_ALLOWED");
  });

  it("returns entitlement required when generation entitlement is disabled", () => {
    const actions = resolveRecommendationActions({
      recommendation: {
        recommendation: action({ executionStatus: "pending" }),
      },
      workflowStatus: "NOT_STARTED",
      operatingMode: "copilot",
      entitlements: {
        ...buildDefaultRecommendationEntitlements(),
        canGenerateContent: false,
      },
    });

    const result = validateRecommendationTransition({
      actionKind: "GENERATE_CONTENT",
      allowedActions: actions,
      operatingMode: "copilot",
      workflowStatus: "NOT_STARTED",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("ACTION_NOT_ALLOWED");
  });
});
