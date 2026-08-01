export const MARKETING_SCORE_VERSION = "marketing-score-v1";

export const MARKETING_SCORE_WEIGHTS = {
  brandFoundation: 15,
  contentConsistency: 15,
  contentReadiness: 10,
  channelConnections: 10,
  campaignActivity: 10,
  analyticsCoverage: 10,
  audienceEngagement: 10,
  paidMediaHealth: 8,
  emailHealth: 7,
  complianceReadiness: 5,
} as const;

export const MARKETING_SCORE_MAXIMUM = 100;

export const MARKETING_CATEGORY_ORDER = [
  "brandFoundation",
  "contentConsistency",
  "contentReadiness",
  "channelConnections",
  "campaignActivity",
  "analyticsCoverage",
  "audienceEngagement",
  "paidMediaHealth",
  "emailHealth",
  "complianceReadiness",
] as const;

export type MarketingScoreCategoryKey = (typeof MARKETING_CATEGORY_ORDER)[number];

export type MarketingScoreStatus =
  | "excellent"
  | "healthy"
  | "needs_attention"
  | "critical"
  | "unavailable";

export type MarketingScoreCategoryResult = {
  key: MarketingScoreCategoryKey;
  label: string;
  score: number;
  maximumScore: number;
  status: MarketingScoreStatus;
  explanation: string;
  evidence: string[];
  recommendedAction: string;
  confidence: number;
};

export type MarketingChannelState = {
  enabled: boolean;
  connected: boolean;
  active: boolean;
  lastSyncedAt: string | null;
  message: string;
};

export type MarketingScoreInput = {
  workspaceId: string;
  generatedAt?: string;
  brand: {
    businessName: string | null;
    website: string | null;
    industry: string | null;
    primaryGoal: string | null;
    audience: string | null;
    voice: string | null;
  };
  drafts: {
    total: number;
    approved: number;
    archived: number;
    recent7Days: number;
    awaitingApproval: number;
  };
  campaigns: {
    total: number;
    active: number;
    recent30Days: number;
  };
  calendar: {
    scheduled: number;
    publishing: number;
    deliveredToInbox: number;
    failed: number;
    pendingApproval: number;
    publishedRecent30Days: number;
  };
  performance: {
    snapshots: number;
    impressions: number;
    engagements: number;
    clicks: number;
    conversions: number;
    spend: number;
    revenue: number;
    lastRecordedAt: string | null;
  };
  media: {
    total: number;
    video: number;
    logoTagged: number;
    lastUploadedAt: string | null;
  };
  aiUsage: {
    totalEvents30Days: number;
    failedEvents30Days: number;
    lastEventAt: string | null;
  };
  integrations: {
    tiktok: MarketingChannelState;
    amazonAds: MarketingChannelState;
    email: MarketingChannelState;
  };
  intentionallyDisabledChannels: string[];
};

export type MarketingScoreResult = {
  workspaceId: string;
  score: number;
  maximumScore: number;
  status: MarketingScoreStatus;
  confidence: number;
  confidenceReason: string;
  scoreVersion: string;
  generatedAt: string;
  categories: MarketingScoreCategoryResult[];
  weightedBreakdown: Record<MarketingScoreCategoryKey, number>;
};

export type MarketingOpportunity = {
  category: MarketingScoreCategoryKey;
  title: string;
  status: MarketingScoreStatus;
  scoreGap: number;
  recommendation: string;
  evidence: string[];
};

export type MarketingScoreTrend = {
  available: boolean;
  direction: "up" | "down" | "flat" | "unknown";
  delta: number;
  previousScore: number | null;
  currentScore: number;
  previousGeneratedAt: string | null;
  currentGeneratedAt: string;
};

const CATEGORY_LABELS: Record<MarketingScoreCategoryKey, string> = {
  brandFoundation: "Brand Foundation",
  contentConsistency: "Content Consistency",
  contentReadiness: "Content Readiness",
  channelConnections: "Channel Connections",
  campaignActivity: "Campaign Activity",
  analyticsCoverage: "Analytics Coverage",
  audienceEngagement: "Audience Engagement",
  paidMediaHealth: "Paid Media Health",
  emailHealth: "Email Health",
  complianceReadiness: "Compliance Readiness",
};

export function categoryLabel(key: MarketingScoreCategoryKey): string {
  return CATEGORY_LABELS[key];
}

export function clampScore(value: number, maximum: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > maximum) return maximum;
  return Math.round(value * 100) / 100;
}

export function statusFromRatio(ratio: number, available: boolean): MarketingScoreStatus {
  if (!available) return "unavailable";
  if (ratio >= 0.9) return "excellent";
  if (ratio >= 0.7) return "healthy";
  if (ratio >= 0.45) return "needs_attention";
  return "critical";
}

export function toCategoryResult(input: {
  key: MarketingScoreCategoryKey;
  score: number;
  maximumScore: number;
  explanation: string;
  evidence: string[];
  recommendedAction: string;
  confidence: number;
  available?: boolean;
}): MarketingScoreCategoryResult {
  const score = clampScore(input.score, input.maximumScore);
  const ratio = input.maximumScore > 0 ? score / input.maximumScore : 0;
  return {
    key: input.key,
    label: categoryLabel(input.key),
    score,
    maximumScore: input.maximumScore,
    status: statusFromRatio(ratio, input.available ?? true),
    explanation: input.explanation,
    evidence: input.evidence,
    recommendedAction: input.recommendedAction,
    confidence: Math.max(0, Math.min(1, input.confidence)),
  };
}

export function scoreHealthStatus(score: number): MarketingScoreStatus {
  if (score >= 85) return "excellent";
  if (score >= 70) return "healthy";
  if (score >= 45) return "needs_attention";
  return "critical";
}

export function summarizeConfidence(confidence: number): string {
  if (confidence >= 0.8) return "High confidence from broad, recent connected data.";
  if (confidence >= 0.55) return "Moderate confidence with partial connected data coverage.";
  if (confidence >= 0.3) return "Limited confidence due to sparse or stale data.";
  return "Low confidence because major data sources are missing or stale.";
}

export function marketingWeightTotal(): number {
  return Object.values(MARKETING_SCORE_WEIGHTS).reduce((sum, value) => sum + value, 0);
}
