export type PriorityLevel = "critical" | "high" | "medium" | "low" | "completed";

export type DailyBriefMetric = {
  id: string;
  label: string;
  value: string;
  trend: "up" | "down" | "flat" | "unknown";
  note: string;
};

export type BriefUrgency = {
  level: "none" | "medium" | "high" | "critical";
  label: string;
  summary: string;
  factors: string[];
  hasUrgentWork: boolean;
};

export type RecommendationEvidence = {
  label: string;
  value: string;
  source: string;
  recordedAt: string | null;
};

export type MarketingRecommendation = {
  id: string;
  title: string;
  summary: string;
  reason: string;
  expectedImpact: "high potential" | "moderate potential" | "foundational improvement";
  confidence: number;
  confidenceReason: string;
  evidence: RecommendationEvidence[];
  actionType: "navigate" | "review" | "connect" | "approve";
  actionLabel: string;
  actionHref: string;
  requiresApproval: boolean;
  createdAt: string;
};

export type PriorityAction = {
  id: string;
  priority: PriorityLevel;
  priorityScore: number;
  title: string;
  impact: string;
  description: string;
  metricLabel: string;
  metricValue: string;
  supportingMetric: string;
  ctaLabel: string;
  source: string;
  reason: string;
  status: "open" | "completed";
  href: string;
  createdAt: string;
  dueAt: string | null;
  workspaceId: string;
};

export type DailyBrief = {
  workspaceId: string;
  generatedAt: string;
  executiveNarrative: string;
  confidence: number;
  confidenceReason: string;
  dataQualityWarning: string | null;
  dataCoverageSummary: string;
  scoreDeltaLabel: string;
  revenueAvailability: "available" | "unavailable";
  bestPerformanceSignal: string;
  missingIntegrations: string[];
  sinceLastVisit: string[];
  needsAttention: string[];
  performingWell: string[];
  underperforming: string[];
  recommendedNextAction: PriorityAction | null;
  urgency: BriefUrgency;
  metrics: DailyBriefMetric[];
  priorityActions: PriorityAction[];
  recommendations: MarketingRecommendation[];
};

export function priorityRank(priority: PriorityLevel): number {
  switch (priority) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    case "low":
      return 3;
    case "completed":
      return 4;
    default:
      return 5;
  }
}

export function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
