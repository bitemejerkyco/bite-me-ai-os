import type {
  MarketingDirectorPlanAction,
  MarketingDirectorStructuredPlan,
} from "@/features/marketing-director/conversational-plan";
import type { MarketingDirectorMode } from "@/features/marketing-director/mode-locks";

export type RecommendationActionKind =
  | "GENERATE_CONTENT"
  | "VIEW_DRAFT"
  | "EDIT_DRAFT"
  | "REGENERATE_CONTENT"
  | "APPROVE_DRAFT"
  | "REJECT_DRAFT"
  | "SCHEDULE_CONTENT"
  | "RESCHEDULE_CONTENT"
  | "PUBLISH_NOW"
  | "VIEW_ANALYTICS"
  | "DUPLICATE_CONTENT"
  | "CREATE_FOLLOW_UP"
  | "CONNECT_INTEGRATION"
  | "UPLOAD_ASSET"
  | "OPEN_SCORE_BREAKDOWN"
  | "OPEN_APPROVAL_QUEUE"
  | "OPEN_CALENDAR"
  | "OPEN_CAMPAIGN"
  | "LEARN_MORE"
  | "DISMISS"
  | "DEFER";

export type RecommendationActionModel = {
  id: string;
  kind: RecommendationActionKind;
  label: string;
  href?: string;
  apiTarget?: string;
  requiresApproval: boolean;
  disabled: boolean;
  disabledReason?: string;
  primary: boolean;
};

export type RecommendationType =
  | "CONTENT_GENERATION"
  | "CONTENT_APPROVAL"
  | "CONTENT_APPROVAL_BACKLOG"
  | "CONTENT_SCHEDULING"
  | "CONTENT_PUBLISHING"
  | "CONTENT_ANALYTICS"
  | "INTEGRATION_CONNECTION"
  | "MEDIA_UPLOAD"
  | "SCORE_IMPROVEMENT"
  | "CAMPAIGN_REVIEW"
  | "COMPLIANCE_REVIEW"
  | "PRODUCT_SETUP"
  | "GENERAL_RECOMMENDATION";

export type RecommendationWorkflowStatus =
  | "NOT_STARTED"
  | "GENERATING"
  | "DRAFT_CREATED"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "FAILED"
  | "DISMISSED"
  | "DEFERRED";

export type RecommendationWorkflowStageState =
  | "complete"
  | "current"
  | "upcoming"
  | "blocked"
  | "failed";

export type RecommendationWorkflowStage = {
  id: "strategy" | "content" | "approval" | "scheduling" | "publishing" | "analytics";
  label: "Strategy" | "Content" | "Approval" | "Scheduling" | "Publishing" | "Analytics";
  state: RecommendationWorkflowStageState;
};

export type RecommendationImpact = {
  scoreImpact?: number;
  affectedCategory?: string;
  blockedItems?: number;
  itemsReady?: number;
  confidence?: number;
  timeSensitivity?: "urgent" | "soon" | "normal";
};

export type RecommendationEvidence = {
  source?: string;
  reason?: string;
  supportingMetric?: string;
  missingDependency?: string;
  affectedScoreCategory?: string;
  relevantCount?: number;
};

export type RecommendationContext = {
  recommendation: MarketingDirectorPlanAction;
  route?: string;
  source?: string;
  taskMetadata?: Record<string, unknown>;
};

export type RecommendationEntitlements = {
  canGenerateContent: boolean;
  canSchedule: boolean;
  canPublish: boolean;
  canUseAdvancedAnalytics: boolean;
  canConnectIntegrations: boolean;
};

export type ResolveRecommendationActionsInput = {
  recommendation: RecommendationContext;
  workflowStatus: RecommendationWorkflowStatus;
  draftId?: string | null;
  approvalStatus?: string | null;
  scheduledPostId?: string | null;
  publishStatus?: string | null;
  integrationStatus?: "connected" | "missing" | "stale" | "limited" | null;
  operatingMode: MarketingDirectorMode;
  entitlements: RecommendationEntitlements;
};

export type RecommendationRuntimeState = {
  recommendationId: string;
  recommendationType: RecommendationType;
  workflowStatus: RecommendationWorkflowStatus;
  actions: RecommendationActionModel[];
  impact: RecommendationImpact | null;
  evidence: RecommendationEvidence;
  progress: RecommendationWorkflowStage[];
  draftId?: string | null;
  scheduledPostId?: string | null;
};

export type RecommendationTransitionValidationInput = {
  actionKind: RecommendationActionKind;
  allowedActions: RecommendationActionModel[];
  operatingMode: MarketingDirectorMode;
  workflowStatus: RecommendationWorkflowStatus;
  draftId?: string | null;
  scheduledPostId?: string | null;
};

export type RecommendationTransitionValidationResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "INVALID_WORKFLOW_TRANSITION"
        | "APPROVAL_REQUIRED"
        | "ACTION_NOT_ALLOWED"
        | "MISSING_TARGET_RECORD"
        | "INTEGRATION_NOT_AVAILABLE"
        | "MODE_RESTRICTED"
        | "ENTITLEMENT_REQUIRED";
      message: string;
    };

function toLower(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

export function classifyRecommendationType(input: RecommendationContext): RecommendationType {
  const metadataType = toLower(input.taskMetadata?.recommendationType);
  const allowed: RecommendationType[] = [
    "CONTENT_GENERATION",
    "CONTENT_APPROVAL",
    "CONTENT_APPROVAL_BACKLOG",
    "CONTENT_SCHEDULING",
    "CONTENT_PUBLISHING",
    "CONTENT_ANALYTICS",
    "INTEGRATION_CONNECTION",
    "MEDIA_UPLOAD",
    "SCORE_IMPROVEMENT",
    "CAMPAIGN_REVIEW",
    "COMPLIANCE_REVIEW",
    "PRODUCT_SETUP",
    "GENERAL_RECOMMENDATION",
  ];
  if (allowed.includes(metadataType.toUpperCase() as RecommendationType)) {
    return metadataType.toUpperCase() as RecommendationType;
  }

  const id = toLower(input.recommendation.id);
  const title = toLower(input.recommendation.title);
  const source = toLower(input.source || input.recommendation.supportingData);
  const route = toLower(input.route || input.recommendation.target);
  const control = toLower(input.recommendation.control);

  if (includesAny(id, ["connect", "integration"]) || includesAny(title, ["connect", "integration"]) || route.includes("/integrations")) {
    return "INTEGRATION_CONNECTION";
  }
  if (includesAny(id, ["upload", "logo", "asset"]) || includesAny(title, ["upload", "logo", "asset"]) || route.includes("/media")) {
    return "MEDIA_UPLOAD";
  }
  if (includesAny(id, ["score"]) || includesAny(title, ["score", "readiness"]) || route.includes("/analytics/marketing-score")) {
    return "SCORE_IMPROVEMENT";
  }
  if (includesAny(id, ["product", "catalog", "asin"]) || includesAny(title, ["product", "catalog", "listing", "asin"])) {
    return "PRODUCT_SETUP";
  }
  if (includesAny(id, ["approval"]) || includesAny(title, ["approve", "approval", "review drafts"]) || route.includes("awaiting-approval")) {
    return "CONTENT_APPROVAL";
  }
  if (includesAny(id, ["schedule"]) || includesAny(title, ["schedule", "calendar"]) || route.includes("/calendar")) {
    return "CONTENT_SCHEDULING";
  }
  if (includesAny(id, ["publish"]) || includesAny(title, ["publish", "live"])) {
    return "CONTENT_PUBLISHING";
  }
  if (includesAny(id, ["analytics", "insights"]) || includesAny(title, ["analytics", "insights", "performance"])) {
    return "CONTENT_ANALYTICS";
  }
  if (includesAny(id, ["campaign"]) || includesAny(title, ["campaign"]) || route.includes("/marketing/campaigns")) {
    return "CAMPAIGN_REVIEW";
  }
  if (includesAny(id, ["compliance"]) || includesAny(title, ["compliance", "policy", "legal"])) {
    return "COMPLIANCE_REVIEW";
  }
  if (includesAny(control, ["generate content", "create draft", "generate content plan"])) {
    return "CONTENT_GENERATION";
  }

  if (includesAny(source, ["approval queue", "awaiting approval"])) {
    return "CONTENT_APPROVAL_BACKLOG";
  }

  return "GENERAL_RECOMMENDATION";
}

export function deriveWorkflowStatus(input: {
  metadataStatus?: RecommendationWorkflowStatus | null;
  draftStatus?: string | null;
  approvalStatus?: string | null;
  scheduledStatus?: string | null;
  publishStatus?: string | null;
  hasDraft: boolean;
  failed?: boolean;
}): RecommendationWorkflowStatus {
  if (input.metadataStatus === "DISMISSED") return "DISMISSED";
  if (input.metadataStatus === "DEFERRED") return "DEFERRED";
  if (input.failed || toLower(input.draftStatus) === "failed" || toLower(input.scheduledStatus) === "failed") {
    return "FAILED";
  }

  const publish = toLower(input.publishStatus || input.scheduledStatus);
  if (publish === "published") return "PUBLISHED";

  const scheduled = toLower(input.scheduledStatus);
  if (scheduled === "scheduled" || scheduled === "publishing" || scheduled === "delivered_to_inbox") {
    return "SCHEDULED";
  }

  const approval = toLower(input.approvalStatus);
  if (approval === "approved" || toLower(input.draftStatus) === "approved") return "APPROVED";
  if (approval === "review" || approval === "awaiting_approval" || approval === "pending_approval") return "AWAITING_APPROVAL";

  if (input.metadataStatus === "GENERATING") return "GENERATING";
  if (input.hasDraft) return "DRAFT_CREATED";
  return "NOT_STARTED";
}

function buildAction(input: {
  recommendationId: string;
  kind: RecommendationActionKind;
  label: string;
  href?: string;
  apiTarget?: string;
  requiresApproval?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  primary?: boolean;
}): RecommendationActionModel {
  return {
    id: `${input.recommendationId}_${input.kind.toLowerCase()}`,
    kind: input.kind,
    label: input.label,
    href: input.href,
    apiTarget: input.apiTarget,
    requiresApproval: Boolean(input.requiresApproval),
    disabled: Boolean(input.disabled),
    disabledReason: input.disabledReason,
    primary: Boolean(input.primary),
  };
}

export function resolveRecommendationActions(input: ResolveRecommendationActionsInput): RecommendationActionModel[] {
  const recommendationType = classifyRecommendationType(input.recommendation);
  const recommendationId = input.recommendation.recommendation.id;
  const actions: RecommendationActionModel[] = [];

  const canPublishNow =
    input.operatingMode !== "advisor"
    && input.entitlements.canPublish
    && input.workflowStatus === "SCHEDULED"
    && Boolean(input.scheduledPostId);

  const canSchedule =
    input.entitlements.canSchedule
    && (input.workflowStatus === "APPROVED" || input.workflowStatus === "AWAITING_APPROVAL" || input.workflowStatus === "DRAFT_CREATED");

  const addDismissAndDefer = () => {
    actions.push(
      buildAction({
        recommendationId,
        kind: "DISMISS",
        label: "Dismiss",
        apiTarget: "/api/marketing-director/recommendations/action",
      }),
    );
    actions.push(
      buildAction({
        recommendationId,
        kind: "DEFER",
        label: "Defer",
        apiTarget: "/api/marketing-director/recommendations/action",
      }),
    );
  };

  switch (recommendationType) {
    case "CONTENT_GENERATION": {
      if (input.workflowStatus === "NOT_STARTED" || input.workflowStatus === "FAILED") {
        actions.push(
          buildAction({
            recommendationId,
            kind: "GENERATE_CONTENT",
            label: "Generate Content",
            apiTarget: "/api/marketing-director/generate-content",
            primary: true,
            disabled: !input.entitlements.canGenerateContent,
            disabledReason: !input.entitlements.canGenerateContent ? "Content generation entitlement is unavailable." : undefined,
          }),
        );
      } else {
        actions.push(
          buildAction({
            recommendationId,
            kind: "VIEW_DRAFT",
            label: "View Draft",
            href: input.draftId ? `/media?tab=CONTENT_DRAFTS&draft=${input.draftId}` : "/media?tab=CONTENT_DRAFTS",
            primary: true,
            disabled: !input.draftId,
            disabledReason: !input.draftId ? "Draft not available yet." : undefined,
          }),
          buildAction({
            recommendationId,
            kind: "EDIT_DRAFT",
            label: "Edit",
            href: input.draftId ? `/media?tab=CONTENT_DRAFTS&draft=${input.draftId}&edit=true` : "/media?tab=CONTENT_DRAFTS",
            disabled: !input.draftId,
            disabledReason: !input.draftId ? "Draft not available yet." : undefined,
          }),
          buildAction({
            recommendationId,
            kind: "REGENERATE_CONTENT",
            label: "Regenerate",
            apiTarget: "/api/marketing-director/generate-content",
          }),
          buildAction({
            recommendationId,
            kind: "APPROVE_DRAFT",
            label: "Approve",
            apiTarget: "/api/marketing-director/command/approve",
            requiresApproval: true,
            disabled: !input.draftId,
            disabledReason: !input.draftId ? "Draft not available yet." : undefined,
          }),
        );
      }
      addDismissAndDefer();
      break;
    }
    case "CONTENT_APPROVAL": {
      if (input.workflowStatus === "APPROVED") {
        actions.push(
          buildAction({
            recommendationId,
            kind: "SCHEDULE_CONTENT",
            label: "Schedule",
            href: input.draftId ? `/calendar?draft=${input.draftId}` : "/calendar",
            primary: true,
            disabled: !canSchedule,
            disabledReason: !canSchedule ? "Scheduling is not available for current mode or entitlement." : undefined,
          }),
        );
      } else {
        actions.push(
          buildAction({
            recommendationId,
            kind: "VIEW_DRAFT",
            label: "View Draft",
            href: input.draftId ? `/media?tab=CONTENT_DRAFTS&draft=${input.draftId}` : "/media?tab=CONTENT_DRAFTS",
            primary: true,
          }),
          buildAction({
            recommendationId,
            kind: "APPROVE_DRAFT",
            label: "Approve",
            apiTarget: "/api/marketing-director/command/approve",
            requiresApproval: true,
            disabled: !input.draftId,
            disabledReason: !input.draftId ? "Draft not available." : undefined,
          }),
          buildAction({
            recommendationId,
            kind: "REJECT_DRAFT",
            label: "Reject",
            apiTarget: "/api/marketing-director/command/reject",
            requiresApproval: true,
            disabled: !input.draftId,
            disabledReason: !input.draftId ? "Draft not available." : undefined,
          }),
        );
      }
      addDismissAndDefer();
      break;
    }
    case "CONTENT_APPROVAL_BACKLOG": {
      actions.push(
        buildAction({
          recommendationId,
          kind: "OPEN_APPROVAL_QUEUE",
          label: "Review Drafts",
          href: "/approvals",
          primary: true,
        }),
        buildAction({
          recommendationId,
          kind: "VIEW_DRAFT",
          label: "Open Content Library",
          href: "/media?tab=CONTENT_DRAFTS",
        }),
      );
      addDismissAndDefer();
      break;
    }
    case "CONTENT_SCHEDULING": {
      if (input.workflowStatus === "SCHEDULED") {
        actions.push(
          buildAction({
            recommendationId,
            kind: "RESCHEDULE_CONTENT",
            label: "Reschedule",
            href: input.scheduledPostId ? `/calendar?post=${input.scheduledPostId}` : "/calendar",
            primary: true,
          }),
          buildAction({
            recommendationId,
            kind: "PUBLISH_NOW",
            label: "Publish Now",
            apiTarget: "/api/marketing-director/recommendations/action",
            requiresApproval: true,
            disabled: !canPublishNow,
            disabledReason:
              input.operatingMode === "advisor"
                ? "Advisor mode cannot publish automatically."
                : !input.entitlements.canPublish
                  ? "Publish entitlement is not available."
                  : !input.scheduledPostId
                    ? "Scheduled post is missing."
                    : undefined,
          }),
        );
      } else {
        actions.push(
          buildAction({
            recommendationId,
            kind: "SCHEDULE_CONTENT",
            label: "Schedule",
            href: input.draftId ? `/calendar?draft=${input.draftId}` : "/calendar",
            primary: true,
            disabled: !canSchedule,
            disabledReason: !canSchedule ? "Scheduling is not available for current state." : undefined,
          }),
        );
      }
      addDismissAndDefer();
      break;
    }
    case "CONTENT_PUBLISHING": {
      actions.push(
        buildAction({
          recommendationId,
          kind: "VIEW_ANALYTICS",
          label: "View Analytics",
          href: "/analytics/marketing-health",
          primary: true,
        }),
        buildAction({
          recommendationId,
          kind: "DUPLICATE_CONTENT",
          label: "Duplicate",
          href: input.draftId ? `/media?tab=CONTENT_DRAFTS&draft=${input.draftId}&duplicate=true` : "/media?tab=CONTENT_DRAFTS",
        }),
        buildAction({
          recommendationId,
          kind: "CREATE_FOLLOW_UP",
          label: "Create Follow-up",
          apiTarget: "/api/marketing-director/generate-content",
        }),
      );
      addDismissAndDefer();
      break;
    }
    case "INTEGRATION_CONNECTION": {
      actions.push(
        buildAction({
          recommendationId,
          kind: "CONNECT_INTEGRATION",
          label: "Connect integration",
          href: input.recommendation.route || "/integrations",
          primary: true,
          disabled: input.integrationStatus === "connected" || !input.entitlements.canConnectIntegrations,
          disabledReason:
            input.integrationStatus === "connected"
              ? "Integration is already connected."
              : !input.entitlements.canConnectIntegrations
                ? "Integration entitlement is unavailable."
                : undefined,
        }),
        buildAction({
          recommendationId,
          kind: "LEARN_MORE",
          label: "Learn More",
          href: "/integrations",
        }),
      );
      addDismissAndDefer();
      break;
    }
    case "MEDIA_UPLOAD": {
      actions.push(
        buildAction({
          recommendationId,
          kind: "UPLOAD_ASSET",
          label: includesAny(toLower(input.recommendation.recommendation.title), ["logo"]) ? "Upload Logo" : "Upload Asset",
          href: "/media",
          primary: true,
        }),
        buildAction({
          recommendationId,
          kind: "LEARN_MORE",
          label: "Open Media Library",
          href: "/media",
        }),
      );
      addDismissAndDefer();
      break;
    }
    case "SCORE_IMPROVEMENT": {
      actions.push(
        buildAction({
          recommendationId,
          kind: "OPEN_SCORE_BREAKDOWN",
          label: "Show Breakdown",
          href: "/analytics/marketing-score",
          primary: true,
        }),
        buildAction({
          recommendationId,
          kind: "OPEN_CAMPAIGN",
          label: "Open Highest-Priority Fix",
          href: input.recommendation.route || input.recommendation.recommendation.target || "/",
        }),
      );
      addDismissAndDefer();
      break;
    }
    case "PRODUCT_SETUP": {
      actions.push(
        buildAction({
          recommendationId,
          kind: "OPEN_CAMPAIGN",
          label: "Add Products",
          href: "/products",
          primary: true,
        }),
        buildAction({
          recommendationId,
          kind: "LEARN_MORE",
          label: "Open Product Catalog",
          href: "/products",
        }),
      );
      addDismissAndDefer();
      break;
    }
    case "CAMPAIGN_REVIEW": {
      actions.push(
        buildAction({
          recommendationId,
          kind: "OPEN_CAMPAIGN",
          label: "Open Campaign",
          href: "/marketing/campaigns",
          primary: true,
        }),
      );
      addDismissAndDefer();
      break;
    }
    case "CONTENT_ANALYTICS": {
      actions.push(
        buildAction({
          recommendationId,
          kind: "VIEW_ANALYTICS",
          label: "View Analytics",
          href: "/analytics/marketing-health",
          primary: true,
          disabled: !input.entitlements.canUseAdvancedAnalytics,
          disabledReason: !input.entitlements.canUseAdvancedAnalytics ? "Advanced analytics entitlement is unavailable." : undefined,
        }),
      );
      addDismissAndDefer();
      break;
    }
    case "COMPLIANCE_REVIEW": {
      actions.push(
        buildAction({
          recommendationId,
          kind: "LEARN_MORE",
          label: "Review Compliance",
          href: "/settings/marketing-director",
          primary: true,
        }),
      );
      addDismissAndDefer();
      break;
    }
    case "GENERAL_RECOMMENDATION":
    default: {
      actions.push(
        buildAction({
          recommendationId,
          kind: "LEARN_MORE",
          label: "Open",
          href: input.recommendation.route || input.recommendation.recommendation.target || "/",
          primary: true,
        }),
      );
      addDismissAndDefer();
      break;
    }
  }

  return actions;
}

export function buildWorkflowProgress(input: {
  recommendationType: RecommendationType;
  workflowStatus: RecommendationWorkflowStatus;
}): RecommendationWorkflowStage[] {
  const contentTypes: RecommendationType[] = [
    "CONTENT_GENERATION",
    "CONTENT_APPROVAL",
    "CONTENT_APPROVAL_BACKLOG",
    "CONTENT_SCHEDULING",
    "CONTENT_PUBLISHING",
    "CONTENT_ANALYTICS",
  ];

  if (!contentTypes.includes(input.recommendationType)) {
    return [];
  }

  const stages: RecommendationWorkflowStage[] = [
    { id: "strategy", label: "Strategy", state: "upcoming" },
    { id: "content", label: "Content", state: "upcoming" },
    { id: "approval", label: "Approval", state: "upcoming" },
    { id: "scheduling", label: "Scheduling", state: "upcoming" },
    { id: "publishing", label: "Publishing", state: "upcoming" },
    { id: "analytics", label: "Analytics", state: "upcoming" },
  ];

  const markCompleteThrough = (stageId: RecommendationWorkflowStage["id"]) => {
    const targetIndex = stages.findIndex((stage) => stage.id === stageId);
    for (let index = 0; index <= targetIndex; index += 1) {
      stages[index].state = "complete";
    }
    if (targetIndex + 1 < stages.length) {
      stages[targetIndex + 1].state = "current";
    }
  };

  switch (input.workflowStatus) {
    case "NOT_STARTED":
      stages[0].state = "current";
      break;
    case "GENERATING":
      stages[0].state = "complete";
      stages[1].state = "current";
      break;
    case "DRAFT_CREATED":
      markCompleteThrough("content");
      break;
    case "AWAITING_APPROVAL":
      stages[0].state = "complete";
      stages[1].state = "complete";
      stages[2].state = "current";
      break;
    case "APPROVED":
      stages[0].state = "complete";
      stages[1].state = "complete";
      stages[2].state = "complete";
      stages[3].state = "current";
      break;
    case "SCHEDULED":
      stages[0].state = "complete";
      stages[1].state = "complete";
      stages[2].state = "complete";
      stages[3].state = "complete";
      stages[4].state = "current";
      break;
    case "PUBLISHED":
      stages[0].state = "complete";
      stages[1].state = "complete";
      stages[2].state = "complete";
      stages[3].state = "complete";
      stages[4].state = "complete";
      stages[5].state = "current";
      break;
    case "FAILED":
      stages[0].state = "complete";
      stages[1].state = "failed";
      break;
    case "DISMISSED":
      stages[0].state = "blocked";
      break;
    case "DEFERRED":
      stages[0].state = "blocked";
      break;
    default:
      stages[0].state = "current";
      break;
  }

  return stages;
}

export function buildPriorityBadge(priority: string): {
  label: "Critical" | "High" | "Medium" | "Low";
  icon: "▲" | "◆" | "■" | "●";
} {
  const value = toLower(priority);
  if (value === "critical") return { label: "Critical", icon: "▲" };
  if (value === "high") return { label: "High", icon: "◆" };
  if (value === "medium") return { label: "Medium", icon: "■" };
  return { label: "Low", icon: "●" };
}

export function buildDeterministicImpact(input: {
  recommendationType: RecommendationType;
  supportingData?: string;
  confidencePercent?: number;
  scoreCategory?: string;
}): RecommendationImpact | null {
  const supportingData = String(input.supportingData || "");
  const countMatch = supportingData.match(/(\d+)/);
  const count = countMatch ? Number(countMatch[1]) : undefined;

  const impact: RecommendationImpact = {};

  if (count !== undefined && Number.isFinite(count)) {
    if (includesAny(toLower(supportingData), ["awaiting", "blocked", "pending"])) {
      impact.blockedItems = count;
    } else {
      impact.itemsReady = count;
    }
  }

  if (input.scoreCategory) {
    impact.affectedCategory = input.scoreCategory;
  }

  if (typeof input.confidencePercent === "number" && Number.isFinite(input.confidencePercent)) {
    impact.confidence = Math.max(0, Math.min(100, Math.round(input.confidencePercent)));
  }

  if (impact.blockedItems !== undefined && impact.blockedItems > 5) {
    impact.timeSensitivity = "urgent";
  } else if (impact.blockedItems !== undefined || impact.itemsReady !== undefined) {
    impact.timeSensitivity = "soon";
  }

  if (
    impact.scoreImpact === undefined
    && impact.affectedCategory === undefined
    && impact.blockedItems === undefined
    && impact.itemsReady === undefined
    && impact.confidence === undefined
    && impact.timeSensitivity === undefined
  ) {
    return null;
  }

  return impact;
}

export function validateRecommendationTransition(
  input: RecommendationTransitionValidationInput,
): RecommendationTransitionValidationResult {
  const allowed = input.allowedActions.find((item) => item.kind === input.actionKind);
  if (!allowed) {
    return {
      ok: false,
      code: "ACTION_NOT_ALLOWED",
      message: "Action is not available for this recommendation.",
    };
  }

  if (allowed.disabled) {
    if (toLower(allowed.disabledReason).includes("entitlement")) {
      return {
        ok: false,
        code: "ENTITLEMENT_REQUIRED",
        message: allowed.disabledReason || "Entitlement is required.",
      };
    }

    if (toLower(allowed.disabledReason).includes("advisor mode") || toLower(allowed.disabledReason).includes("publish")) {
      return {
        ok: false,
        code: "MODE_RESTRICTED",
        message: allowed.disabledReason || "Action is restricted in this operating mode.",
      };
    }

    return {
      ok: false,
      code: "INVALID_WORKFLOW_TRANSITION",
      message: allowed.disabledReason || "Action is not valid for current workflow state.",
    };
  }

  if ((input.actionKind === "APPROVE_DRAFT" || input.actionKind === "REJECT_DRAFT") && !input.draftId) {
    return {
      ok: false,
      code: "MISSING_TARGET_RECORD",
      message: "Draft record is required for this action.",
    };
  }

  if ((input.actionKind === "SCHEDULE_CONTENT" || input.actionKind === "RESCHEDULE_CONTENT") && !input.draftId) {
    return {
      ok: false,
      code: "MISSING_TARGET_RECORD",
      message: "Draft record is required before scheduling.",
    };
  }

  if (input.actionKind === "PUBLISH_NOW") {
    if (input.operatingMode === "advisor") {
      return {
        ok: false,
        code: "MODE_RESTRICTED",
        message: "Advisor mode cannot publish automatically.",
      };
    }
    if (input.workflowStatus !== "SCHEDULED") {
      return {
        ok: false,
        code: "APPROVAL_REQUIRED",
        message: "Content must be approved and scheduled before publish.",
      };
    }
    if (!input.scheduledPostId) {
      return {
        ok: false,
        code: "MISSING_TARGET_RECORD",
        message: "Scheduled post record is required for publish.",
      };
    }
  }

  return { ok: true };
}

export function buildRecommendationRuntime(input: {
  recommendation: MarketingDirectorPlanAction;
  route?: string;
  source?: string;
  taskMetadata?: Record<string, unknown>;
  metadataWorkflowStatus?: RecommendationWorkflowStatus | null;
  draftId?: string | null;
  draftStatus?: string | null;
  approvalStatus?: string | null;
  scheduledPostId?: string | null;
  scheduledStatus?: string | null;
  publishStatus?: string | null;
  integrationStatus?: "connected" | "missing" | "stale" | "limited" | null;
  operatingMode: MarketingDirectorMode;
  entitlements: RecommendationEntitlements;
  confidencePercent?: number;
}): RecommendationRuntimeState {
  const recommendationType = classifyRecommendationType({
    recommendation: input.recommendation,
    route: input.route,
    source: input.source,
    taskMetadata: input.taskMetadata,
  });

  const workflowStatus = deriveWorkflowStatus({
    metadataStatus: input.metadataWorkflowStatus,
    draftStatus: input.draftStatus,
    approvalStatus: input.approvalStatus,
    scheduledStatus: input.scheduledStatus,
    publishStatus: input.publishStatus,
    hasDraft: Boolean(input.draftId),
    failed: input.recommendation.executionStatus === "failed",
  });

  const actions = resolveRecommendationActions({
    recommendation: {
      recommendation: input.recommendation,
      route: input.route,
      source: input.source,
      taskMetadata: input.taskMetadata,
    },
    workflowStatus,
    draftId: input.draftId,
    approvalStatus: input.approvalStatus,
    scheduledPostId: input.scheduledPostId,
    publishStatus: input.publishStatus,
    integrationStatus: input.integrationStatus,
    operatingMode: input.operatingMode,
    entitlements: input.entitlements,
  });

  const evidence: RecommendationEvidence = {
    source: input.source,
    reason: input.recommendation.description || undefined,
    supportingMetric: input.recommendation.supportingData || undefined,
    missingDependency:
      recommendationType === "INTEGRATION_CONNECTION" && input.integrationStatus !== "connected"
        ? "Integration is not connected."
        : undefined,
    affectedScoreCategory:
      recommendationType === "SCORE_IMPROVEMENT"
        ? "Marketing Score"
        : undefined,
    relevantCount: (() => {
      const match = String(input.recommendation.supportingData || "").match(/(\d+)/);
      if (!match) return undefined;
      const count = Number(match[1]);
      return Number.isFinite(count) ? count : undefined;
    })(),
  };

  const impact = buildDeterministicImpact({
    recommendationType,
    supportingData: input.recommendation.supportingData,
    confidencePercent: input.confidencePercent,
    scoreCategory: evidence.affectedScoreCategory,
  });

  const progress = buildWorkflowProgress({ recommendationType, workflowStatus });

  return {
    recommendationId: input.recommendation.id,
    recommendationType,
    workflowStatus,
    actions,
    impact,
    evidence,
    progress,
    draftId: input.draftId,
    scheduledPostId: input.scheduledPostId,
  };
}

export function buildDefaultRecommendationEntitlements(): RecommendationEntitlements {
  return {
    canGenerateContent: true,
    canSchedule: true,
    canPublish: false,
    canUseAdvancedAnalytics: true,
    canConnectIntegrations: true,
  };
}

export function recommendationStateFromMetadata(input: {
  commandMetadata: unknown;
  actionId: string;
}): { workflowStatus?: RecommendationWorkflowStatus; deferredUntil?: string; dismissedAt?: string } {
  if (!input.commandMetadata || typeof input.commandMetadata !== "object") {
    return {};
  }

  const metadata = input.commandMetadata as Record<string, unknown>;
  const state = metadata.recommendationState;
  if (!state || typeof state !== "object") return {};

  const byAction = (state as Record<string, unknown>)[input.actionId];
  if (!byAction || typeof byAction !== "object") return {};

  const item = byAction as Record<string, unknown>;
  const status = String(item.workflowStatus || "") as RecommendationWorkflowStatus;

  return {
    workflowStatus: status || undefined,
    deferredUntil: typeof item.deferredUntil === "string" ? item.deferredUntil : undefined,
    dismissedAt: typeof item.dismissedAt === "string" ? item.dismissedAt : undefined,
  };
}

export function writeRecommendationStateToMetadata(input: {
  commandMetadata: unknown;
  actionId: string;
  workflowStatus: RecommendationWorkflowStatus;
  deferredUntil?: string | null;
  dismissedAt?: string | null;
}): Record<string, unknown> {
  const metadata = input.commandMetadata && typeof input.commandMetadata === "object"
    ? { ...(input.commandMetadata as Record<string, unknown>) }
    : {};

  const recommendationState = metadata.recommendationState && typeof metadata.recommendationState === "object"
    ? { ...(metadata.recommendationState as Record<string, unknown>) }
    : {};

  recommendationState[input.actionId] = {
    workflowStatus: input.workflowStatus,
    deferredUntil: input.deferredUntil || null,
    dismissedAt: input.dismissedAt || null,
    updatedAt: new Date().toISOString(),
  };

  metadata.recommendationState = recommendationState;
  return metadata;
}

export function parsePlanById(input: {
  commandRows: Array<{ proposal: unknown; metadata: unknown; id: string; prompt: string }>;
  planId: string;
}): { commandId: string; plan: MarketingDirectorStructuredPlan; metadata: unknown; prompt: string } | null {
  for (const row of input.commandRows) {
    if (!row.proposal || typeof row.proposal !== "object") continue;
    const candidate = row.proposal as Record<string, unknown>;
    if (String(candidate.planId || "") !== input.planId) continue;
    if (!Array.isArray(candidate.recommendedActions)) continue;
    return {
      commandId: row.id,
      plan: candidate as unknown as MarketingDirectorStructuredPlan,
      metadata: row.metadata,
      prompt: row.prompt,
    };
  }

  return null;
}
