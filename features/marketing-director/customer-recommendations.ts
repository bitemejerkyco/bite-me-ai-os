import type { MarketingRecommendation } from "@/features/marketing-director/daily-brief-rules";
import type {
  RecommendationActionModel,
  RecommendationRuntimeState,
} from "@/features/marketing-director/recommendation-workflows";
import type { MarketingDirectorPlanAction } from "@/features/marketing-director/conversational-plan";

type CustomerAction = {
  id: string;
  label: string;
  href?: string;
  kind: RecommendationActionModel["kind"];
  disabled: boolean;
  disabledReason?: string;
  primary: boolean;
};

export type CustomerRecommendationCard = {
  title: string;
  summary: string;
  whyItMatters?: string;
  currentState?: string;
  recommendedNextStep?: string;
  primaryAction: CustomerAction | null;
  secondaryActions: CustomerAction[];
  workflow?: RecommendationRuntimeState["progress"];
  impact?: string[];
  evidence?: Array<{ label: string; value: string }>;
  blocker?: string;
  requiredApproval?: string;
  technicalDetails?: Array<{ label: string; value: string }>;
};

function nonEmpty(value: unknown): string | null {
  const text = String(value || "").trim();
  return text ? text : null;
}

function humanizeWorkflowStatus(value: string): string {
  return value.replaceAll("_", " ").toLowerCase();
}

function labelForAction(action: RecommendationActionModel, actionTitle: string): string {
  if (action.kind === "CONNECT_INTEGRATION") {
    if (/amazon/i.test(actionTitle)) return "Connect Amazon Ads";
    if (/tiktok/i.test(actionTitle)) return "Connect TikTok";
    return "Connect channel";
  }
  if (action.kind === "UPLOAD_ASSET") {
    return /logo/i.test(actionTitle) ? "Upload Logo" : "Open Media Library";
  }
  if (action.kind === "OPEN_CAMPAIGN" && /product/i.test(actionTitle)) {
    return "Open Product Catalog";
  }
  if (action.kind === "SCHEDULE_CONTENT" && /approve/i.test(action.label.toLowerCase())) {
    return "Approve & Schedule";
  }
  if (action.kind === "APPROVE_DRAFT") {
    if (/schedule/i.test(actionTitle)) return "Approve & Schedule";
    if (/setup/i.test(actionTitle) || /product/i.test(actionTitle)) return "Approve & Continue Setup";
    return "Approve & Continue";
  }
  if (action.kind === "VIEW_ANALYTICS") return "View Analytics";
  if (action.kind === "OPEN_APPROVAL_QUEUE") return "Review Drafts";
  if (action.kind === "OPEN_SCORE_BREAKDOWN") return "Improve Marketing Score";
  return action.label;
}

function customerSafeActions(
  actions: RecommendationActionModel[],
  actionTitle: string,
): { primaryAction: CustomerAction | null; secondaryActions: CustomerAction[] } {
  const mapped = actions.map((action) => ({
    id: action.id,
    label: labelForAction(action, actionTitle),
    href: action.href,
    kind: action.kind,
    disabled: action.disabled,
    disabledReason: action.disabledReason,
    primary: action.primary,
  }));

  const primaryAction = mapped.find((action) => action.primary) || mapped[0] || null;
  const secondaryActions = mapped.filter((action) => !primaryAction || action.id !== primaryAction.id);
  return { primaryAction, secondaryActions };
}

function impactLines(runtime: RecommendationRuntimeState): string[] {
  const lines: string[] = [];
  if (typeof runtime.impact?.blockedItems === "number") {
    lines.push(`${runtime.impact.blockedItems} item${runtime.impact.blockedItems === 1 ? "" : "s"} waiting`);
  }
  if (typeof runtime.impact?.itemsReady === "number") {
    lines.push(`${runtime.impact.itemsReady} item${runtime.impact.itemsReady === 1 ? "" : "s"} ready`);
  }
  if (typeof runtime.impact?.confidence === "number") {
    lines.push(`${runtime.impact.confidence}% deterministic confidence`);
  }
  if (runtime.impact?.affectedCategory) {
    lines.push(`${runtime.impact.affectedCategory} is affected`);
  }
  return lines.filter(Boolean);
}

function currentStateFromRuntime(runtime: RecommendationRuntimeState): string | null {
  if (runtime.workflowStatus === "NOT_STARTED") return "Not started yet.";
  if (runtime.workflowStatus === "AWAITING_APPROVAL") return "Waiting on approval before the workflow can continue.";
  if (runtime.workflowStatus === "SCHEDULED") return "Scheduled and ready for publishing steps.";
  if (runtime.workflowStatus === "FAILED") return "Blocked by a failed step that needs review.";
  return `Currently ${humanizeWorkflowStatus(runtime.workflowStatus)}.`;
}

function blockerFromRuntime(runtime: RecommendationRuntimeState): string | null {
  return nonEmpty(runtime.actions.find((action) => action.disabled && action.primary)?.disabledReason)
    || nonEmpty(runtime.actions.find((action) => action.disabledReason)?.disabledReason)
    || null;
}

function businessWhyItMatters(runtime: RecommendationRuntimeState, action: MarketingDirectorPlanAction): string | null {
  if (runtime.recommendationType === "PRODUCT_SETUP") {
    return "Adding products allows PostMotive to build product campaigns, recommend promotions, and generate product-specific content.";
  }
  if (runtime.recommendationType === "INTEGRATION_CONNECTION") {
    return "Connecting this channel unlocks more reliable recommendations, better performance visibility, and the workflows tied to that provider.";
  }
  if (runtime.recommendationType === "MEDIA_UPLOAD") {
    return /logo/i.test(action.title)
      ? "Adding a logo helps PostMotive create more recognizable brand content and improves the workspace setup foundation."
      : "Uploading brand assets helps PostMotive create stronger, more relevant marketing content faster.";
  }
  if (runtime.recommendationType === "CONTENT_APPROVAL" || runtime.recommendationType === "CONTENT_APPROVAL_BACKLOG") {
    return "Approvals are blocking the move from draft work into scheduling and publishing.";
  }
  if (runtime.recommendationType === "CONTENT_SCHEDULING") {
    return "Scheduling keeps content moving from approved drafts into an actual publishing cadence.";
  }
  if (runtime.recommendationType === "CONTENT_PUBLISHING") {
    return "Publishing and follow-up analytics are what turn prepared content into real learnings and business results.";
  }
  if (runtime.recommendationType === "SCORE_IMPROVEMENT") {
    return "Improving this area helps Marketing Score and AI guidance stay more trustworthy and actionable.";
  }
  return nonEmpty(action.supportingData);
}

export function buildCustomerRecommendationCard(input: {
  action: MarketingDirectorPlanAction;
  runtime: RecommendationRuntimeState;
  canViewTechnicalDetails: boolean;
  generatedDraftTitle?: string;
}): CustomerRecommendationCard {
  const { primaryAction, secondaryActions } = customerSafeActions(input.runtime.actions, input.action.title);
  const evidence = [
    input.runtime.evidence.reason ? { label: "Detected", value: input.runtime.evidence.reason } : null,
    input.runtime.evidence.supportingMetric ? { label: "Detected", value: input.runtime.evidence.supportingMetric } : null,
    input.runtime.evidence.missingDependency ? { label: "Effect", value: input.runtime.evidence.missingDependency } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item?.value));

  const technicalDetails = input.canViewTechnicalDetails
    ? [
        { label: "Recommendation ID", value: input.runtime.recommendationId },
        { label: "Internal type", value: input.runtime.recommendationType.replaceAll("_", " ") },
        { label: "Internal target", value: input.action.target },
        { label: "Workflow state", value: input.runtime.workflowStatus },
        input.runtime.evidence.source ? { label: "Source", value: input.runtime.evidence.source } : null,
      ].filter((item): item is { label: string; value: string } => Boolean(item?.value))
    : [];

  return {
    title: input.action.title,
    summary: input.action.description,
    whyItMatters: businessWhyItMatters(input.runtime, input.action) || undefined,
    currentState: currentStateFromRuntime(input.runtime) || undefined,
    recommendedNextStep: primaryAction?.label,
    primaryAction,
    secondaryActions,
    workflow: input.runtime.progress.length > 0 ? input.runtime.progress : undefined,
    impact: impactLines(input.runtime).length > 0 ? impactLines(input.runtime) : undefined,
    evidence: evidence.length > 0 ? evidence : undefined,
    blocker: blockerFromRuntime(input.runtime) || undefined,
    requiredApproval: input.action.requiresApproval ? "Approval is required before this recommendation can fully continue." : undefined,
    technicalDetails: technicalDetails.length > 0 ? technicalDetails : undefined,
  };
}

export function buildCustomerBriefRecommendation(recommendation: MarketingRecommendation): {
  title: string;
  summary: string;
  whyItMatters?: string;
  impactLabel?: string;
  evidence?: Array<{ label: string; value: string }>;
  showConfidence: boolean;
} {
  const evidence = recommendation.evidence
    .filter((item) => nonEmpty(item.label) && nonEmpty(item.value))
    .slice(0, 3)
    .map((item) => ({ label: item.label, value: item.value }));

  return {
    title: recommendation.title,
    summary: recommendation.summary,
    whyItMatters: nonEmpty(recommendation.reason) || undefined,
    impactLabel: recommendation.expectedImpact,
    evidence: evidence.length > 0 ? evidence : undefined,
    showConfidence: recommendation.confidence >= 0.65,
  };
}
