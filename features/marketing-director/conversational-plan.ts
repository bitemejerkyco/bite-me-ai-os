import type { MarketingDirectorDashboard } from "@/features/marketing-director/dashboard";
import type { MarketingModeSettings } from "@/features/marketing-director/modes";
import type { PriorityAction } from "@/features/marketing-director/daily-brief-rules";

export type MarketingDirectorRequestClass =
  | "SCORE_IMPROVEMENT"
  | "CAMPAIGN_PLANNING"
  | "CONTENT_PLANNING"
  | "CONTENT_APPROVAL"
  | "CHANNEL_ANALYSIS"
  | "AMAZON_GROWTH"
  | "INTEGRATION_SETUP"
  | "EXECUTIVE_SUMMARY"
  | "GENERAL_MARKETING_REQUEST";

export type PlanActionPriority = "critical" | "high" | "medium" | "low";

export type PlanExecutionStatus = "pending" | "approval_required" | "completed" | "failed";

export type PlanActionControl =
  | "Open"
  | "Review"
  | "Connect"
  | "View details"
  | "Create draft"
  | "Generate content plan"
  | "Prepare campaign brief"
  | "Prepare integration checklist"
  | "Review and approve"
  | "Approve scheduling"
  | "Approve publishing"
  | "Approve budget recommendation";

export type MarketingDirectorPlanAction = {
  id: string;
  title: string;
  description: string;
  priority: PlanActionPriority;
  target: string;
  requiresApproval: boolean;
  executionStatus: PlanExecutionStatus;
  supportingData: string;
  estimatedEffortMinutes: number | null;
  control: PlanActionControl;
};

export type MarketingDirectorStructuredPlan = {
  planId: string;
  requestSummary: string;
  requestClass: MarketingDirectorRequestClass;
  title: string;
  executiveSummary: string;
  objectives: string[];
  strategy: string[];
  weeklyPlan: Array<{ week: string; focus: string; channels: string[]; deliverables: string[] }>;
  tasks: Array<{ title: string; owner: string; dueWindow: string; priority: PlanActionPriority }>;
  calendar: Array<{ date: string; channel: string; asset: string; status: string }>;
  contentIdeas: Array<{ title: string; format: string; channel: string; angle: string }>;
  recommendations: string[];
  approvals: string[];
  confidence: {
    scorePercent: number;
    rationale: string;
  };
  currentSituation: string;
  whyItMatters: string;
  recommendedActions: MarketingDirectorPlanAction[];
  requiredApprovals: string[];
  expectedDataLimitations: string[];
  confidenceLevel: {
    scorePercent: number;
    label: "high" | "moderate" | "limited";
    reason: string;
  };
  nextBestAction: string;
  generatedAt: string;
};

function normalizePrompt(prompt: string): string {
  return (prompt ?? "").trim().toLowerCase();
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

export function classifyMarketingDirectorRequest(prompt: string): MarketingDirectorRequestClass {
  const value = normalizePrompt(prompt);

  if (includesAny(value, ["improve my marketing score", "marketing score", "score improvement"])) return "SCORE_IMPROVEMENT";
  if (includesAny(value, ["30-day campaign", "campaign", "launch campaign", "campaign brief"])) return "CAMPAIGN_PLANNING";
  if (includesAny(value, ["content plan", "content calendar", "create content", "content strategy"])) return "CONTENT_PLANNING";
  if (includesAny(value, ["review pending content", "pending approval", "approve drafts", "approval queue"])) return "CONTENT_APPROVAL";
  if (includesAny(value, ["analyze connected channel", "channel performance", "channel analysis", "performance analysis"])) return "CHANNEL_ANALYSIS";
  if (includesAny(value, ["amazon growth", "amazon advertising", "amazon ads", "roas", "acos", "ppc"])) return "AMAZON_GROWTH";
  if (includesAny(value, ["connect integration", "integrations", "connect tiktok", "connect email", "connect amazon"])) return "INTEGRATION_SETUP";
  if (includesAny(value, ["executive summary", "brief summary", "daily brief", "summary"])) return "EXECUTIVE_SUMMARY";

  return "GENERAL_MARKETING_REQUEST";
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function slug(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "action";
}

function parseConfidencePercent(dashboard: MarketingDirectorDashboard): number {
  const confidenceCard = dashboard.cards.find((card) => card.id === "ai_confidence");
  if (!confidenceCard) return Math.round(dashboard.brief.confidence * 100);
  const parsed = Number(String(confidenceCard.value).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed)) return Math.round(dashboard.brief.confidence * 100);
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function confidenceLabel(scorePercent: number): "high" | "moderate" | "limited" {
  if (scorePercent >= 75) return "high";
  if (scorePercent >= 45) return "moderate";
  return "limited";
}

function toPlanControl(action: PriorityAction): PlanActionControl {
  const lowerTitle = (action.title ?? "").toLowerCase();
  const lowerCta = (action.ctaLabel ?? "").toLowerCase();
  const lowerHref = (action.href ?? "").toLowerCase();

  if (includesAny(lowerTitle, ["approve", "approval"]) || includesAny(lowerCta, ["approve"])) return "Review and approve";
  if (includesAny(lowerTitle, ["schedule"]) || includesAny(lowerCta, ["schedule"])) return "Approve scheduling";
  if (includesAny(lowerTitle, ["publish"]) || includesAny(lowerCta, ["publish"])) return "Approve publishing";
  if (includesAny(lowerTitle, ["budget"]) || includesAny(lowerCta, ["budget"])) return "Approve budget recommendation";
  if (includesAny(lowerTitle, ["create content", "pipeline"])) return "Generate content plan";
  if (includesAny(lowerTitle, ["campaign"])) return "Prepare campaign brief";
  if (includesAny(lowerTitle, ["connect missing integrations", "connect integrations"])) return "Prepare integration checklist";
  if (lowerHref.includes("integrations")) return "Connect";
  if (lowerHref.includes("analytics")) return "View details";
  if (includesAny(lowerCta, ["review"])) return "Review";
  return "Open";
}

function estimatedEffort(priority: PlanActionPriority): number {
  if (priority === "critical") return 45;
  if (priority === "high") return 30;
  if (priority === "medium") return 20;
  return 15;
}

function buildCurrentSituation(dashboard: MarketingDirectorDashboard): string {
  const scoreCard = dashboard.cards.find((card) => card.id === "marketing_score");
  const healthCard = dashboard.cards.find((card) => card.id === "marketing_health");
  const activeCard = dashboard.cards.find((card) => card.id === "active_campaigns");
  const awaitingCard = dashboard.cards.find((card) => card.id === "content_awaiting_approval");
  const scheduledCard = dashboard.cards.find((card) => card.id === "scheduled_posts");
  const channelsCard = dashboard.cards.find((card) => card.id === "connected_channels");
  const confidenceCard = dashboard.cards.find((card) => card.id === "ai_confidence");

  return [
    `Marketing Score: ${scoreCard?.value || "Unavailable"}.`,
    `Marketing Health: ${healthCard?.value || "Unavailable"}.`,
    `Active campaigns: ${activeCard?.value || "0"}.`,
    `Content awaiting approval: ${awaitingCard?.value || "0"}.`,
    `Scheduled posts: ${scheduledCard?.value || "0"}.`,
    `Connected channels: ${channelsCard?.value || "0"}.`,
    `AI Confidence: ${confidenceCard?.value || `${Math.round(dashboard.brief.confidence * 100)}%`}.`,
    `Revenue availability: ${dashboard.brief.revenueAvailability === "available" ? "connected" : "unavailable"}.`,
  ].join(" ");
}

function buildWhyItMatters(dashboard: MarketingDirectorDashboard): string {
  const criticalCategories = dashboard.score.categories
    .filter((category) => category.status === "critical")
    .map((category) => category.label);

  const action = dashboard.brief.recommendedNextAction?.title || "Review top-priority action queue";
  const urgency = dashboard.brief.urgency.summary;

  if (criticalCategories.length > 0) {
    return `${urgency} Critical categories: ${criticalCategories.join(", ")}. Prioritizing "${action}" reduces near-term execution risk.`;
  }

  return `${urgency} Prioritizing "${action}" keeps campaign execution and approvals on track.`;
}

function expectedDataLimitations(dashboard: MarketingDirectorDashboard): string[] {
  const limitations: string[] = [];
  if (dashboard.brief.revenueAvailability === "unavailable") {
    limitations.push("Revenue tracking is unavailable from connected sources.");
  }
  for (const missing of dashboard.brief.missingIntegrations) {
    limitations.push(`${missing} is not fully connected.`);
  }

  if (limitations.length === 0) {
    limitations.push("No major data limitations detected in currently connected sources.");
  }

  return limitations.slice(0, 5);
}

function actionTarget(action: PriorityAction): string {
  return action.href || "internal:review";
}

export function isExecutionBlockedInAdvisor(action: MarketingDirectorPlanAction): boolean {
  return ["Approve publishing", "Approve budget recommendation", "Approve scheduling"].includes(action.control);
}

function mapPriority(value: PriorityAction["priority"]): PlanActionPriority {
  if (value === "critical" || value === "high" || value === "medium" || value === "low") return value;
  return "low";
}

export function buildStructuredMarketingPlan(input: {
  prompt: string;
  dashboard: MarketingDirectorDashboard;
  modeSettings: MarketingModeSettings;
  workspaceId: string;
}): MarketingDirectorStructuredPlan {
  const requestClass = classifyMarketingDirectorRequest(input.prompt);
  const generatedAt = new Date().toISOString();
  const planId = `pmplan_${hashText(`${input.workspaceId}|${requestClass}|${normalizePrompt(input.prompt)}|${generatedAt.slice(0, 13)}`)}`;
  const confidencePercent = parseConfidencePercent(input.dashboard);
  const confidence = {
    scorePercent: confidencePercent,
    label: confidenceLabel(confidencePercent),
    reason: input.dashboard.brief.confidenceReason,
  };

  const sourceActions = input.dashboard.brief.priorityActions.slice(0, 5);
  const recommendedActions: MarketingDirectorPlanAction[] = sourceActions.length > 0
    ? sourceActions.map((action, index) => {
        const priority = mapPriority(action.priority);
        const control = toPlanControl(action);
        return {
          id: `${planId}_${index + 1}_${slug(action.title)}`,
          title: action.title,
          description: action.description || action.impact,
          priority,
          target: actionTarget(action),
          requiresApproval: action.priority === "critical" || action.priority === "high" || action.priority === "medium",
          executionStatus: action.priority === "critical" || action.priority === "high" ? "approval_required" : "pending",
          supportingData: action.reason || action.supportingMetric || action.metricValue,
          estimatedEffortMinutes: estimatedEffort(priority),
          control,
        };
      })
    : [
        {
          id: `${planId}_1_review_integrations`,
          title: "Review integrations and data coverage",
          description: "Start by reviewing current integrations and any missing data sources.",
          priority: "medium",
          target: "/integrations",
          requiresApproval: true,
          executionStatus: "approval_required",
          supportingData: input.dashboard.brief.urgency.summary,
          estimatedEffortMinutes: 20,
          control: "Review",
        },
      ];

  const requiredApprovals = [
    input.modeSettings.approvalRequiredForContent ? "Content changes require approval." : null,
    input.modeSettings.approvalRequiredForScheduling ? "Scheduling changes require approval." : null,
    input.modeSettings.approvalRequiredForPublishing ? "Publishing actions require approval." : null,
    input.modeSettings.approvalRequiredForBudgetChanges ? "Budget recommendations require approval." : null,
  ].filter((item): item is string => Boolean(item));

  const nextBestAction = recommendedActions[0]?.target || "/";
  const topChannels = input.dashboard.channelHealth
    .filter((channel) => channel.connected)
    .map((channel) => channel.label)
    .slice(0, 3);
  const channels = topChannels.length > 0 ? topChannels : ["Owned channels"];

  const recommendations = [
    ...recommendedActions.slice(0, 4).map((action) => `${action.title}: ${action.description}`),
    `Data limitations to monitor: ${expectedDataLimitations(input.dashboard).join(" ")}`,
  ];

  const tasks = recommendedActions.slice(0, 5).map((action) => ({
    title: action.title,
    owner: "Marketing lead",
    dueWindow: action.priority === "critical" ? "24-48 hours" : action.priority === "high" ? "This week" : "Next 2 weeks",
    priority: action.priority,
  }));

  const weeklyPlan = [
    {
      week: "Week 1",
      focus: "Stabilize approvals and close urgent blockers",
      channels,
      deliverables: tasks.slice(0, 2).map((task) => task.title),
    },
    {
      week: "Week 2",
      focus: "Launch planned campaign assets with approval gates",
      channels,
      deliverables: tasks.slice(2, 4).map((task) => task.title),
    },
    {
      week: "Week 3",
      focus: "Optimize based on connected performance signals",
      channels,
      deliverables: ["Review performance insights", "Adjust content mix with approvals"],
    },
    {
      week: "Week 4",
      focus: "Consolidate wins and set next cycle priorities",
      channels,
      deliverables: ["Executive summary", "Next-cycle backlog"],
    },
  ];

  const calendar = tasks.slice(0, 4).map((task, index) => ({
    date: `Day ${index + 1}`,
    channel: channels[index % channels.length] || "Owned channels",
    asset: task.title,
    status: "approval_required",
  }));

  const contentIdeas = [
    {
      title: "Customer pain-point to solution explainer",
      format: "Short-form video",
      channel: channels[0] || "Owned channels",
      angle: "Problem to outcome with clear CTA",
    },
    {
      title: "Feature spotlight with use-case",
      format: "Carousel or thread",
      channel: channels[1] || channels[0] || "Owned channels",
      angle: "One feature, one measurable outcome",
    },
    {
      title: "Trust and proof moment",
      format: "Static post + caption",
      channel: channels[0] || "Owned channels",
      angle: "Credibility and next step",
    },
  ];

  return {
    planId,
    requestSummary: input.prompt.trim(),
    requestClass,
    title: `Marketing Director Plan: ${input.prompt.trim().slice(0, 80)}`,
    executiveSummary: buildWhyItMatters(input.dashboard),
    objectives: [
      "Improve score categories with the largest current gaps.",
      "Reduce approval and execution bottlenecks.",
      "Increase confidence from connected channel data.",
    ],
    strategy: [
      "Prioritize high-impact actions first while preserving approval safety.",
      "Sequence work into weekly execution blocks with clear ownership.",
      "Use connected signals for optimization and avoid assumptions where data is limited.",
    ],
    weeklyPlan,
    tasks,
    calendar,
    contentIdeas,
    recommendations,
    approvals: requiredApprovals,
    confidence: {
      scorePercent: confidence.scorePercent,
      rationale: confidence.reason,
    },
    currentSituation: buildCurrentSituation(input.dashboard),
    whyItMatters: buildWhyItMatters(input.dashboard),
    recommendedActions,
    requiredApprovals,
    expectedDataLimitations: expectedDataLimitations(input.dashboard),
    confidenceLevel: confidence,
    nextBestAction,
    generatedAt,
  };
}
