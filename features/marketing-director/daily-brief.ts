import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildPriorityActions } from "@/features/marketing-director/priority-actions";
import { recommendationActionForCategory } from "@/features/marketing-director/score-category-routes";
import { calculateMarketingUrgency } from "@/features/marketing-director/urgency";
import {
  normalizeConfidence,
  type AutonomousExecutiveRecommendation,
  type DailyBrief,
  type MarketingRecommendation,
  type RecommendationEvidence,
} from "@/features/marketing-director/daily-brief-rules";
import { type DataCoverageModel } from "@/features/marketing-director/data-coverage";
import { type MarketingScoreResult, type MarketingScoreTrend } from "@/features/marketing-director/marketing-score-rules";
import { getTopMarketingOpportunities } from "@/features/marketing-director/marketing-score";

export type DailyBriefInput = {
  workspaceId: string;
  workspaceName: string;
  score: MarketingScoreResult;
  scoreTrend: MarketingScoreTrend;
  dataCoverage: DataCoverageModel;
  metrics: {
    activeCampaigns: number;
    draftsAwaitingApproval: number;
    failedScheduledPosts: number;
    pendingScheduledPosts: number;
    failedTikTokJobs: number;
    scheduledPosts: number;
    connectedChannels: number;
    tiktokStatus: "connected" | "reconnect_required" | "disconnected";
    tiktokInboxPending: number;
    approvedDrafts: number;
    mediaAssetsCount: number;
    failedVideoRenders: number;
    integrationErrors: number;
    hasLogo: boolean;
    hasBrandVoice: boolean;
    onboardingComplete: boolean;
    amazonAdsConnected: boolean;
    amazonRecommendationsReady: boolean;
    hasProductsTable: boolean;
    productsCount: number | null;
    recentDrafts24h: number;
    recentScheduledPosts24h: number;
    recentAiEvents24h: number;
    lastVisitAt: string | null;
    revenueLast30Days: number | null;
  };
};

function recommendationEvidence(label: string, value: string, source: string, recordedAt: string | null): RecommendationEvidence {
  return { label, value, source, recordedAt };
}

function scoreDeltaLabel(trend: MarketingScoreTrend): string {
  if (!trend.available) return "No prior Marketing Score snapshot is available yet.";
  if (trend.direction === "up") return `Marketing Score is up by ${trend.delta.toFixed(1)} points vs prior snapshot.`;
  if (trend.direction === "down") return `Marketing Score is down by ${Math.abs(trend.delta).toFixed(1)} points vs prior snapshot.`;
  return "Marketing Score is unchanged vs the prior snapshot.";
}

function bestPerformanceSignal(input: DailyBriefInput): string {
  if (input.metrics.revenueLast30Days && input.metrics.revenueLast30Days > 0) {
    return `Connected revenue in the last 30 days: ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(input.metrics.revenueLast30Days)}.`;
  }
  if (input.metrics.activeCampaigns > 0) {
    return `${input.metrics.activeCampaigns} active campaign(s) are currently running.`;
  }
  if (input.metrics.scheduledPosts > 0) {
    return `${input.metrics.scheduledPosts} scheduled post(s) are in the pipeline.`;
  }
  return "No strong performance signal is available yet from connected analytics sources.";
}

function buildRecommendations(input: DailyBriefInput): MarketingRecommendation[] {
  const generatedAt = new Date().toISOString();
  const recommendations: MarketingRecommendation[] = [];
  const opportunities = getTopMarketingOpportunities(input.score);

  for (const opportunity of opportunities.slice(0, 3)) {
    const action = recommendationActionForCategory(opportunity.category);
    recommendations.push({
      id: `opportunity-${opportunity.category}`,
      title: `Improve ${opportunity.title}`,
      summary: opportunity.recommendation,
      reason: `${opportunity.title} has a score gap of ${opportunity.scoreGap.toFixed(2)} points.`,
      expectedImpact: opportunity.status === "critical" ? "high potential" : "foundational improvement",
      confidence: normalizeConfidence(input.score.confidence),
      confidenceReason: input.score.confidenceReason,
      evidence: opportunity.evidence.map((evidence, index) =>
        recommendationEvidence(
          `Evidence ${index + 1}`,
          evidence,
          "marketing_score",
          input.score.generatedAt,
        ),
      ),
      actionType: "navigate",
      actionLabel: action.label,
      actionHref: action.href,
      requiresApproval: true,
      createdAt: generatedAt,
    });
  }

  if (!input.metrics.onboardingComplete) {
    recommendations.push({
      id: "recommendation-onboarding",
      title: "Complete business setup for higher-quality guidance",
      summary: "PostMotive recommendations improve when business setup includes goals, audience, and brand voice.",
      reason: "Onboarding is incomplete and reduces context available to recommendation engines.",
      expectedImpact: "foundational improvement",
      confidence: 0.9,
      confidenceReason: "Direct workspace profile fields are missing.",
      evidence: [
        recommendationEvidence("Onboarding status", "Incomplete", "workspaces", generatedAt),
      ],
      actionType: "navigate",
      actionLabel: "Complete setup",
      actionHref: "/onboarding",
      requiresApproval: false,
      createdAt: generatedAt,
    });
  }

  if (input.metrics.tiktokStatus === "reconnect_required") {
    recommendations.push({
      id: "recommendation-tiktok-reconnect",
      title: "Reconnect TikTok to unblock publishing",
      summary: "TikTok token refresh failed and upload workflows are currently blocked.",
      reason: "The TikTok integration health is reconnect_required.",
      expectedImpact: "high potential",
      confidence: 0.95,
      confidenceReason: "Derived from live integration status.",
      evidence: [
        recommendationEvidence("TikTok status", "reconnect_required", "tiktok_connections", generatedAt),
      ],
      actionType: "connect",
      actionLabel: "Reconnect TikTok",
      actionHref: "/settings/integrations/tiktok",
      requiresApproval: true,
      createdAt: generatedAt,
    });
  }

  return recommendations.slice(0, 4);
}

function strongestSignal(input: DailyBriefInput): string {
  const positive = input.score.categories
    .slice()
    .sort((left, right) => (right.score / right.maximumScore) - (left.score / left.maximumScore))
    .find((category) => category.status === "excellent" || category.status === "healthy");

  if (positive) {
    return positive.label;
  }

  if (input.metrics.activeCampaigns > 0) {
    return `${input.metrics.activeCampaigns} active campaign${input.metrics.activeCampaigns === 1 ? "" : "s"}`;
  }

  return "Brand setup context";
}

function largestWeakness(input: DailyBriefInput): string {
  const weakest = input.score.categories
    .slice()
    .sort((left, right) => (left.score / left.maximumScore) - (right.score / right.maximumScore))
    .find((category) => category.status === "critical" || category.status === "needs_attention" || category.status === "unavailable");

  if (!weakest) {
    return "no critical weakness";
  }

  if (weakest.key === "contentReadiness" && input.metrics.draftsAwaitingApproval > 0) {
    return `Content Readiness (${input.metrics.draftsAwaitingApproval} draft${input.metrics.draftsAwaitingApproval === 1 ? "" : "s"} awaiting approval)`;
  }

  return weakest.label;
}

function unavailableDataSummary(input: DailyBriefInput): string {
  const unavailable: string[] = [];
  if (input.metrics.tiktokStatus !== "connected") unavailable.push("TikTok performance continuity");
  if (!input.metrics.amazonAdsConnected) unavailable.push("Amazon Ads");
  if (input.metrics.revenueLast30Days === null) unavailable.push("revenue tracking");
  if (input.dataCoverage.sources.some((source) => source.key === "email_provider" && source.health !== "healthy")) {
    unavailable.push("email provider data");
  }

  if (unavailable.length === 0) return "core data sources are connected";
  return unavailable.join(", ");
}

function operationalImpactFromAction(action: DailyBrief["recommendedNextAction"]): string {
  if (!action) return "Execution risk is currently moderate based on connected data.";
  return action.impact;
}

function safeList(values: string[], fallback: string): string {
  if (values.length === 0) return fallback;
  return values.join(", ");
}

function buildExecutiveNarrative(input: {
  strongest: string;
  weakness: string;
  topActionLabel: string;
  unavailableData: string;
  impact: string;
  scoreValue: number;
  scoreMax: number;
  confidencePercent: number;
  revenueAvailability: "available" | "unavailable";
  revenueLabel: string;
  urgencySummary: string;
  needsAttention: string[];
  performingWell: string[];
}): string {
  const weaknessSentence = input.weakness === "no critical weakness"
    ? "No critical score category is currently flagged, so momentum can come from disciplined execution."
    : `Largest weakness: ${input.weakness}.`;

  return [
    `Today, Marketing Score is ${input.scoreValue.toFixed(1)} of ${input.scoreMax}, with ${input.confidencePercent}% data confidence across connected sources.`,
    `Strongest signal: ${input.strongest}.`,
    weaknessSentence,
    `Highest-priority action: ${input.topActionLabel}, because it addresses the most immediate execution risk in the current queue.`,
    `Urgency context: ${input.urgencySummary}`,
    `Performance strength to protect: ${safeList(input.performingWell.slice(0, 2), "No verified performance strength is available yet from connected records")}.`,
    `Immediate risks: ${safeList(input.needsAttention.slice(0, 2), "No critical operational blocker is currently flagged")}.`,
    `Data limitation focus: ${input.unavailableData}.`,
    input.revenueAvailability === "available"
      ? `Connected revenue signal in the last 30 days is ${input.revenueLabel}, which should guide pacing and prioritization decisions.`
      : "Revenue impact remains unavailable from connected sources, so financial prioritization should be treated as directional until coverage improves.",
    `Expected operational impact if the top priority is completed today: ${input.impact}`,
  ].join(" ");
}

function buildMorningBrief(input: {
  scoreDeltaLabel: string;
  performingWell: string[];
  needsAttention: string[];
  opportunities: string[];
  recentDrafts24h: number;
  recentScheduledPosts24h: number;
  recentAiEvents24h: number;
  recommendedNextActionTitle: string | null;
  bestPerformanceSignal: string;
  revenueLabel: string;
  revenueAvailable: boolean;
}): DailyBrief["morningBrief"] {
  return {
    overnightChanges: [
      `${input.recentDrafts24h} new draft(s) were created in the last 24 hours.`,
      `${input.recentScheduledPosts24h} scheduled-post update(s) were recorded in the last 24 hours.`,
      `${input.recentAiEvents24h} AI event(s) were recorded overnight.`,
    ],
    wins: input.performingWell.length > 0 ? input.performingWell.slice(0, 3) : ["No confirmed wins were recorded from connected sources yet."],
    risks: input.needsAttention.length > 0 ? input.needsAttention.slice(0, 3) : ["No immediate critical risks are currently flagged."],
    urgentActions: input.recommendedNextActionTitle ? [input.recommendedNextActionTitle] : ["Review top priority actions and confirm the next safe execution step."],
    opportunities: input.opportunities.length > 0 ? input.opportunities.slice(0, 3) : ["Repurpose strongest available content across connected channels."],
    marketingScoreChanges: [input.scoreDeltaLabel],
    campaignPerformance: [
      input.bestPerformanceSignal,
      input.revenueAvailable
        ? `Connected revenue signal: ${input.revenueLabel}.`
        : "Revenue signal is unavailable and should be treated as directional.",
    ],
    aiRecommendations: [
      "Prioritize highest-ROI recommendation first.",
      "Preserve approval gates before scheduling or publishing.",
      "Reuse top-performing assets across multiple connected channels.",
    ],
    estimatedBusinessImpact: input.revenueAvailable
      ? "Expected impact: protect short-term revenue momentum while increasing execution consistency."
      : "Expected impact: improve marketing execution readiness and confidence coverage in the next cycle.",
  };
}

export function buildDailyBrief(input: DailyBriefInput): DailyBrief {
  const generatedAt = new Date().toISOString();
  const priorityActions = buildPriorityActions({
    workspaceId: input.workspaceId,
    onboardingComplete: input.metrics.onboardingComplete,
    hasLogo: input.metrics.hasLogo,
    hasBrandVoice: input.metrics.hasBrandVoice,
    tiktokStatus: input.metrics.tiktokStatus,
    tiktokInboxPending: input.metrics.tiktokInboxPending,
    draftsAwaitingApproval: input.metrics.draftsAwaitingApproval,
    failedScheduledPosts: input.metrics.failedScheduledPosts,
    failedVideoRenders: input.metrics.failedVideoRenders,
    amazonAdsConnected: input.metrics.amazonAdsConnected,
    amazonRecommendationsReady: input.metrics.amazonRecommendationsReady,
    hasProductsTable: input.metrics.hasProductsTable,
    productsCount: input.metrics.productsCount,
    mediaAssetsCount: input.metrics.mediaAssetsCount,
    approvedDrafts: input.metrics.approvedDrafts,
    upcomingScheduledPosts: input.metrics.scheduledPosts,
    pendingScheduledPosts: input.metrics.pendingScheduledPosts,
    integrationErrors: input.metrics.integrationErrors,
    activeCampaigns: input.metrics.activeCampaigns,
    failedTikTokJobs: input.metrics.failedTikTokJobs,
    missingIntegrations: input.dataCoverage.sources
      .filter((source) => source.health === "missing" || source.health === "limited")
      .map((source) => source.label),
    revenueAvailable: input.metrics.revenueLast30Days !== null,
    lowScoreCategories: input.score.categories
      .filter((category) => category.status === "critical" || category.status === "needs_attention")
      .map((category) => ({ key: category.key, label: category.label, status: category.status })),
  });

  const recommendations = buildRecommendations(input);
  const autonomousRecommendations: AutonomousExecutiveRecommendation[] = [];

  const urgency = calculateMarketingUrgency({
    criticalScoreCategories: input.score.categories.filter((category) => category.status === "critical").length,
    failedPublishingJobs: input.metrics.failedScheduledPosts + input.metrics.failedTikTokJobs,
    approvalBacklog: input.metrics.draftsAwaitingApproval,
    missingRequiredIntegrations: input.dataCoverage.sources.filter((source) =>
      ["amazon_ads", "email_provider", "social_analytics", "revenue_tracking"].includes(source.key) &&
      (source.health === "missing" || source.health === "limited"),
    ).length,
    scheduledWorkAtRisk: input.metrics.pendingScheduledPosts + input.metrics.failedScheduledPosts,
    highPriorityActions: priorityActions.filter((action) => action.priority === "critical" || action.priority === "high").length,
  });

  const revenueLabel =
    input.metrics.revenueLast30Days === null
      ? "Insufficient connected revenue data"
      : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(input.metrics.revenueLast30Days);

  const metrics = [
    {
      id: "marketing-score",
      label: "Marketing Score",
      value: `${input.score.score.toFixed(1)} / ${input.score.maximumScore}`,
      trend: "unknown" as const,
      note: input.score.status.replaceAll("_", " "),
    },
    {
      id: "active-campaigns",
      label: "Active campaigns",
      value: String(input.metrics.activeCampaigns),
      trend: input.metrics.activeCampaigns > 0 ? "up" as const : "flat" as const,
      note: "Real campaign records",
    },
    {
      id: "approval-queue",
      label: "Awaiting approval",
      value: String(input.metrics.draftsAwaitingApproval),
      trend: input.metrics.draftsAwaitingApproval > 0 ? "up" as const : "flat" as const,
      note: "Draft + schedule approval queue",
    },
    {
      id: "revenue-impact",
      label: "Revenue impact",
      value: revenueLabel,
      trend: "unknown" as const,
      note: input.metrics.revenueLast30Days === null ? "No reliable conversion revenue source" : "Connected conversion revenue",
    },
  ];

  const sinceLastVisit = [
    `${input.metrics.recentDrafts24h} new draft(s) created in the last 24 hours.`,
    `${input.metrics.recentScheduledPosts24h} scheduled post update(s) in the last 24 hours.`,
    `${input.metrics.recentAiEvents24h} AI usage event(s) in the last 24 hours.`,
  ];

  const needsAttention = priorityActions
    .filter((action) => action.priority === "critical" || action.priority === "high")
    .slice(0, 3)
    .map((action) => action.title);

  if (needsAttention.length === 0 && urgency.level !== "none") {
    needsAttention.push(urgency.summary);
  }

  const performingWell = [
    input.metrics.activeCampaigns > 0
      ? "At least one campaign is active."
      : "Campaign activation has not started yet.",
    input.metrics.connectedChannels > 0
      ? `${input.metrics.connectedChannels} channel(s) are connected.`
      : "No active channels are connected.",
  ];

  const underperforming = input.score.categories
    .filter((category) => category.status === "critical" || category.status === "needs_attention")
    .slice(0, 3)
    .map((category) => `${category.label}: ${category.explanation}`);

  const recommendedNextAction = priorityActions[0] || null;

  const strongest = strongestSignal(input);
  const weakness = largestWeakness(input);
  const unavailableData = unavailableDataSummary(input);
  const topActionLabel = recommendedNextAction ? recommendedNextAction.title : "review connected performance signals";
  const confidencePercent = Math.round(normalizeConfidence((input.score.confidence + input.dataCoverage.overallConfidence) / 2) * 100);

  const executiveNarrative = buildExecutiveNarrative({
    strongest,
    weakness,
    topActionLabel,
    unavailableData,
    impact: operationalImpactFromAction(recommendedNextAction),
    scoreValue: input.score.score,
    scoreMax: input.score.maximumScore,
    confidencePercent,
    revenueAvailability: input.metrics.revenueLast30Days === null ? "unavailable" : "available",
    revenueLabel,
    urgencySummary: urgency.summary,
    needsAttention,
    performingWell,
  });

  const morningBrief = buildMorningBrief({
    scoreDeltaLabel: scoreDeltaLabel(input.scoreTrend),
    performingWell,
    needsAttention,
    opportunities: recommendations.map((item) => item.title),
    recentDrafts24h: input.metrics.recentDrafts24h,
    recentScheduledPosts24h: input.metrics.recentScheduledPosts24h,
    recentAiEvents24h: input.metrics.recentAiEvents24h,
    recommendedNextActionTitle: recommendedNextAction?.title || null,
    bestPerformanceSignal: bestPerformanceSignal(input),
    revenueLabel,
    revenueAvailable: input.metrics.revenueLast30Days !== null,
  });

  return {
    workspaceId: input.workspaceId,
    generatedAt,
    executiveNarrative,
    confidence: normalizeConfidence((input.score.confidence + input.dataCoverage.overallConfidence) / 2),
    confidenceReason: input.dataCoverage.warning
      ? "Confidence is reduced by missing connected data sources."
      : input.score.confidenceReason,
    dataQualityWarning: input.dataCoverage.warning,
    dataCoverageSummary: `${Math.round(input.dataCoverage.overallConfidence * 100)}% confidence across ${input.dataCoverage.sources.length} evaluated data sources.`,
    scoreDeltaLabel: scoreDeltaLabel(input.scoreTrend),
    revenueAvailability: input.metrics.revenueLast30Days === null ? "unavailable" : "available",
    bestPerformanceSignal: bestPerformanceSignal(input),
    missingIntegrations: input.dataCoverage.sources
      .filter((source) => source.health === "missing" || source.health === "limited")
      .map((source) => source.label),
    sinceLastVisit,
    needsAttention,
    performingWell,
    underperforming,
    recommendedNextAction,
    urgency: {
      level: urgency.level,
      label: urgency.label,
      summary: urgency.summary,
      factors: urgency.factors,
      hasUrgentWork: urgency.hasUrgentWork,
    },
    metrics,
    priorityActions,
    recommendations,
    autonomousRecommendations,
    morningBrief,
  };
}

export async function saveDailyBriefSnapshot(brief: DailyBrief): Promise<void> {
  const admin = createAdminClient();
  await admin.from("marketing_director_briefs").upsert({
    workspace_id: brief.workspaceId,
    brief_date: brief.generatedAt.slice(0, 10),
    metrics: brief.metrics,
    priority_actions: brief.priorityActions,
    recommendations: brief.recommendations,
    confidence: brief.confidence,
    data_coverage: {
      generatedAt: brief.generatedAt,
      warning: brief.dataQualityWarning,
      confidenceReason: brief.confidenceReason,
      scoreDeltaLabel: brief.scoreDeltaLabel,
      dataCoverageSummary: brief.dataCoverageSummary,
      revenueAvailability: brief.revenueAvailability,
      bestPerformanceSignal: brief.bestPerformanceSignal,
      missingIntegrations: brief.missingIntegrations,
      sinceLastVisit: brief.sinceLastVisit,
      needsAttention: brief.needsAttention,
      performingWell: brief.performingWell,
      underperforming: brief.underperforming,
      recommendedNextAction: brief.recommendedNextAction,
      executiveNarrative: brief.executiveNarrative,
      urgency: brief.urgency,
      morningBrief: brief.morningBrief,
      autonomousRecommendations: brief.autonomousRecommendations,
    },
  } as never, { onConflict: "workspace_id,brief_date" });
}
