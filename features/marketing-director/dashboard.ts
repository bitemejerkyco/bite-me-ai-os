import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { EXECUTIVE_CARD_DESTINATIONS, type ExecutiveMetricCardId } from "@/features/marketing-director/card-routes";
import { buildDataCoverageModel, detectProductsTable, type DataCoverageModel } from "@/features/marketing-director/data-coverage";
import {
  buildDailyBrief,
  saveDailyBriefSnapshot,
  type DailyBriefInput,
} from "@/features/marketing-director/daily-brief";
import { restoreDailyBriefFromSnapshot, type StoredBriefRow } from "@/features/marketing-director/daily-brief-snapshot";
import type { DailyBrief } from "@/features/marketing-director/daily-brief-rules";
import {
  buildAutonomousRecommendations,
  buildExecutiveOpportunityRisk,
  type AutonomousRecommendation,
} from "@/features/marketing-director/autonomous-intelligence";
import {
  loadMarketingMemorySignals,
  upsertMarketingMemorySignals,
  type MarketingMemorySignal,
} from "@/features/marketing-director/marketing-memory";
import { getMarketingModeSettings, modeCapabilities, type MarketingModeSettings } from "@/features/marketing-director/modes";
import {
  getMarketingScoreForWorkspace,
  getScoreTrend,
} from "@/features/marketing-director/marketing-score";
import { formatTrendIndicator } from "@/features/marketing-director/trends";
import {
  buildMeasuredOrEstimatedLabel,
  loadExecutionOperationalSnapshot,
  refreshAiHealthMetrics,
  type PublishingQueueSummary,
  type WorkflowSummary,
  type ApprovalSummary,
} from "@/features/marketing-director/execution-engine";
import { buildDepartmentStatus, type DepartmentStatus } from "@/features/marketing-director/departments";
import {
  type MarketingScoreResult,
  type MarketingScoreTrend,
} from "@/features/marketing-director/marketing-score-rules";

type CampaignRow = { status: string | null; updated_at: string | null };
type DraftRow = { status: string | null; created_at: string | null };
type ScheduledPostRow = {
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  scheduled_for: string | null;
};
type TikTokConnectionRow = {
  status: string | null;
  updated_at: string | null;
  refreshed_at: string | null;
};
type TikTokJobRow = { status: string | null; created_at: string | null; updated_at: string | null };
type PerformanceRow = {
  revenue: number | null;
  spend: number | null;
  recorded_at: string | null;
  impressions: number | null;
  engagements: number | null;
  clicks: number | null;
};
type MediaRow = {
  mime_type: string | null;
  file_name: string | null;
  tags: string[] | null;
  created_at: string | null;
};
type AiUsageRow = { status: string | null; created_at: string | null };
type VideoTransactionRow = { kind: string | null; created_at: string | null };
type LastBriefRow = { created_at: string | null };
type ForecastRow = {
  forecast_type: string | null;
  measured_value: number | null;
  estimated_value: number | null;
  confidence: number | null;
  note: string | null;
  measured: boolean | null;
  created_at: string | null;
};
type ExecutionEventRow = {
  id: string;
  event_type: string | null;
  status: string | null;
  message: string | null;
  actor_user_id: string | null;
  agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};
type NotificationRow = { status: string | null; created_at: string | null };

export type ExecutiveMetricCard = {
  id: ExecutiveMetricCardId;
  label: string;
  value: string;
  status: "healthy" | "warning" | "critical" | "unavailable";
  trendDirection: "up" | "down" | "flat" | "unknown";
  trendLabel: string | null;
  detail: string;
  aiExplanation?: string;
  recommendedAction?: string;
  confidence?: number;
  href: string;
};

export type ChannelHealthItem = {
  key: string;
  label: string;
  connected: boolean;
  health: "healthy" | "limited" | "missing" | "stale";
  message: string;
  lastSyncedAt: string | null;
};

export type RecentActivityItem = {
  id: string;
  type: string;
  label: string;
  createdAt: string;
  href: string;
};

export type MarketingDirectorDashboard = {
  workspaceId: string;
  workspaceName: string;
  firstName: string;
  dateLabel: string;
  greeting: string;
  modeSettings: MarketingModeSettings;
  capabilities: ReturnType<typeof modeCapabilities>;
  cards: ExecutiveMetricCard[];
  score: MarketingScoreResult;
  scoreTrend: MarketingScoreTrend;
  brief: DailyBrief;
  autonomousRecommendations?: AutonomousRecommendation[];
  biggestOpportunity?: string;
  biggestRisk?: string;
  memorySignals?: MarketingMemorySignal[];
  dataCoverage: DataCoverageModel;
  channelHealth: ChannelHealthItem[];
  recentActivity: RecentActivityItem[];
  autonomyLevel?: number;
  workflowSummary?: WorkflowSummary;
  approvalSummary?: ApprovalSummary;
  publishingQueue?: PublishingQueueSummary;
  forecastSummary?: Array<{
    type: string;
    label: string;
    confidence: number;
    note: string;
  }>;
  timeline?: Array<{
    id: string;
    timestamp: string;
    type: string;
    status: string;
    message: string;
    actor: string;
  }>;
  aiHealth?: {
    status: "healthy" | "warning" | "critical";
    acceptanceRate: string;
    executionSuccessRate: string;
    publishingSuccessRate: string;
    forecastAccuracyRate: string;
  };
  pendingNotifications?: number;
  departments?: DepartmentStatus[];
};

function metricHref(id: ExecutiveMetricCard["id"]): string {
  return EXECUTIVE_CARD_DESTINATIONS[id];
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function greetingForDate(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function statusForHealth(value: number): ExecutiveMetricCard["status"] {
  if (value >= 80) return "healthy";
  if (value >= 55) return "warning";
  return "critical";
}

function aiConfidenceDetail(input: DataCoverageModel): string {
  const connected = input.sources.filter((source) => source.health === "healthy").map((source) => source.label);
  const stale = input.sources.filter((source) => source.health === "stale").map((source) => source.label);
  const missing = input.sources
    .filter((source) => source.health === "missing" || source.health === "limited")
    .map((source) => source.label);

  const parts: string[] = [];
  if (connected.length > 0) parts.push(`Connected: ${connected.slice(0, 3).join(", ")}.`);
  if (stale.length > 0) parts.push(`Stale: ${stale.slice(0, 3).join(", ")}.`);
  if (missing.length > 0) parts.push(`Missing or limited: ${missing.slice(0, 4).join(", ")}.`);

  return parts.join(" ") || "Confidence reflects connected and recent data coverage.";
}

function sumPerformance(values: PerformanceRow[], key: "impressions" | "engagements" | "clicks"): number {
  return values.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

export async function loadMarketingDirectorDashboard(input: {
  workspaceId: string;
  firstName: string;
  workspaceName: string;
  refreshBrief?: boolean;
}): Promise<MarketingDirectorDashboard> {
  const admin = createAdminClient();

  const [
    score,
    scoreTrend,
    modeSettings,
    campaignsResult,
    draftsResult,
    scheduledPostsResult,
    tiktokResult,
    tiktokJobsResult,
    performanceResult,
    mediaResult,
    aiUsageResult,
    videoTransactionsResult,
    lastBriefResult,
    briefForTodayResult,
    forecastsResult,
    executionEventsResult,
    notificationsResult,
  ] = await Promise.all([
    getMarketingScoreForWorkspace(input.workspaceId),
    getScoreTrend(input.workspaceId),
    getMarketingModeSettings(input.workspaceId),
    admin.from("campaigns").select("status,updated_at").eq("workspace_id", input.workspaceId),
    admin.from("content_drafts").select("status,created_at").eq("workspace_id", input.workspaceId),
    admin.from("scheduled_posts").select("status,created_at,updated_at,scheduled_for").eq("workspace_id", input.workspaceId),
    admin
      .from("tiktok_connections")
      .select("status,updated_at,refreshed_at")
      .eq("workspace_id", input.workspaceId)
      .maybeSingle(),
    admin
      .from("tiktok_publish_jobs")
      .select("status,created_at,updated_at")
      .eq("workspace_id", input.workspaceId),
    admin
      .from("content_performance_snapshots")
      .select("revenue,spend,recorded_at,impressions,engagements,clicks")
      .eq("workspace_id", input.workspaceId),
    admin
      .from("media_assets")
      .select("mime_type,file_name,tags,created_at")
      .eq("workspace_id", input.workspaceId),
    admin
      .from("ai_usage_events")
      .select("status,created_at")
      .eq("account_id", input.workspaceId),
    admin
      .from("video_credit_transactions")
      .select("kind,created_at")
      .eq("workspace_id", input.workspaceId),
    admin
      .from("marketing_director_briefs")
      .select("created_at")
      .eq("workspace_id", input.workspaceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("marketing_director_briefs")
      .select("workspace_id,metrics,priority_actions,recommendations,confidence,data_coverage,created_at,updated_at")
      .eq("workspace_id", input.workspaceId)
      .eq("brief_date", todayDateKey())
      .maybeSingle(),
    admin
      .from("marketing_forecasts")
      .select("forecast_type,measured_value,estimated_value,confidence,note,measured,created_at")
      .eq("workspace_id", input.workspaceId)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("marketing_execution_events")
      .select("id,event_type,status,message,actor_user_id,agent,metadata,created_at")
      .eq("workspace_id", input.workspaceId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("marketing_notifications")
      .select("status,created_at")
      .eq("workspace_id", input.workspaceId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  if (campaignsResult.error) throw new Error(`DASHBOARD_CAMPAIGNS_FAILED:${campaignsResult.error.message}`);
  if (draftsResult.error) throw new Error(`DASHBOARD_DRAFTS_FAILED:${draftsResult.error.message}`);
  if (scheduledPostsResult.error) throw new Error(`DASHBOARD_POSTS_FAILED:${scheduledPostsResult.error.message}`);
  if (tiktokJobsResult.error) throw new Error(`DASHBOARD_TIKTOK_JOBS_FAILED:${tiktokJobsResult.error.message}`);
  if (performanceResult.error) throw new Error(`DASHBOARD_PERFORMANCE_FAILED:${performanceResult.error.message}`);
  if (mediaResult.error) throw new Error(`DASHBOARD_MEDIA_FAILED:${mediaResult.error.message}`);
  if (aiUsageResult.error) throw new Error(`DASHBOARD_AI_USAGE_FAILED:${aiUsageResult.error.message}`);
  if (videoTransactionsResult.error) throw new Error(`DASHBOARD_VIDEO_TRANSACTIONS_FAILED:${videoTransactionsResult.error.message}`);
  if (briefForTodayResult.error) throw new Error(`DASHBOARD_BRIEF_FAILED:${briefForTodayResult.error.message}`);
  if (forecastsResult.error) throw new Error(`DASHBOARD_FORECASTS_FAILED:${forecastsResult.error.message}`);
  if (executionEventsResult.error) throw new Error(`DASHBOARD_EVENTS_FAILED:${executionEventsResult.error.message}`);
  if (notificationsResult.error) throw new Error(`DASHBOARD_NOTIFICATIONS_FAILED:${notificationsResult.error.message}`);

  const campaigns = (campaignsResult.data as CampaignRow[] | null) || [];
  const drafts = (draftsResult.data as DraftRow[] | null) || [];
  const posts = (scheduledPostsResult.data as ScheduledPostRow[] | null) || [];
  const tiktokConnection = (tiktokResult.data as TikTokConnectionRow | null) || null;
  const tiktokJobs = (tiktokJobsResult.data as TikTokJobRow[] | null) || [];
  const performance = (performanceResult.data as PerformanceRow[] | null) || [];
  const media = (mediaResult.data as MediaRow[] | null) || [];
  const aiUsage = (aiUsageResult.data as AiUsageRow[] | null) || [];
  const videoTransactions = (videoTransactionsResult.data as VideoTransactionRow[] | null) || [];
  const forecasts = (forecastsResult.data as ForecastRow[] | null) || [];
  const executionEvents = (executionEventsResult.data as ExecutionEventRow[] | null) || [];
  const notifications = (notificationsResult.data as NotificationRow[] | null) || [];

  const operationalSnapshot = await loadExecutionOperationalSnapshot(input.workspaceId);
  const aiHealthMetrics = await refreshAiHealthMetrics({ workspaceId: input.workspaceId });

  const lastBrief = (lastBriefResult.data as LastBriefRow | null) || null;

  const revenueValues = performance
    .map((row) => Number(row.revenue || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const spendValues = performance
    .map((row) => Number(row.spend || 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  const revenueLast30Days = performance
    .filter((row) => Date.now() - new Date(String(row.recorded_at)).getTime() <= 30 * 24 * 60 * 60 * 1000)
    .reduce((sum, row) => sum + Number(row.revenue || 0), 0);

  const spendLast30Days = performance
    .filter((row) => Date.now() - new Date(String(row.recorded_at)).getTime() <= 30 * 24 * 60 * 60 * 1000)
    .reduce((sum, row) => sum + Number(row.spend || 0), 0);

  const clicksLast30Days = sumPerformance(
    performance.filter((row) => Date.now() - new Date(String(row.recorded_at)).getTime() <= 30 * 24 * 60 * 60 * 1000),
    "clicks",
  );
  const engagementsLast30Days = sumPerformance(
    performance.filter((row) => Date.now() - new Date(String(row.recorded_at)).getTime() <= 30 * 24 * 60 * 60 * 1000),
    "engagements",
  );
  const impressionsLast30Days = sumPerformance(
    performance.filter((row) => Date.now() - new Date(String(row.recorded_at)).getTime() <= 30 * 24 * 60 * 60 * 1000),
    "impressions",
  );

  const revenueAvailable = revenueValues.length > 0;
  const revenueLabel = revenueAvailable
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(revenueLast30Days)
    : "Insufficient connected revenue data";

  const hasProductsTable = await detectProductsTable();
  const productsCount = hasProductsTable
    ? ((await admin
        .from("products")
        .select("id", { count: "exact", head: true })
        .limit(1)).count || 0)
    : null;

  const tiktokConnected = Boolean(tiktokConnection && tiktokConnection.status === "CONNECTED");
  const tiktokStatus = tiktokConnected
    ? "connected"
    : tiktokConnection?.status === "RECONNECT_REQUIRED"
      ? "reconnect_required"
      : "disconnected";

  const dataCoverage = buildDataCoverageModel({
    workspaceId: input.workspaceId,
    workspaceProfileComplete: score.categories.find((item) => item.key === "brandFoundation")?.score ===
      score.categories.find((item) => item.key === "brandFoundation")?.maximumScore,
    hasProductsTable,
    productsCount,
    mediaCount: media.length,
    contentDraftCount: drafts.length,
    scheduledPostsCount: posts.length,
    tiktokConnected,
    tiktokLastSyncedAt: tiktokConnection?.refreshed_at || tiktokConnection?.updated_at || null,
    amazonAdsConnected: false,
    amazonAdsMessage: "Amazon Ads connection persistence is not available in the current schema.",
    emailConnected: false,
    emailMessage: "Email provider integration is not configured.",
    performanceSnapshotCount: performance.length,
    performanceLastRecordedAt: performance.map((row) => String(row.recorded_at)).sort().at(-1) || null,
    revenueRecordsCount: revenueValues.length,
    aiUsageCount: aiUsage.length,
    aiUsageLastAt: aiUsage.map((row) => String(row.created_at)).sort().at(-1) || null,
    videoTransactionsCount: videoTransactions.length,
    videoTransactionsLastAt: videoTransactions.map((row) => String(row.created_at)).sort().at(-1) || null,
  });

  const confidenceScore = Math.round(dataCoverage.overallConfidence * 100);

  const activeCampaigns = campaigns.filter((row) => row.status === "ACTIVE").length;
  const awaitingApproval =
    drafts.filter((row) => row.status === "DRAFT").length +
    posts.filter((row) => row.status === "PENDING_APPROVAL").length;
  const scheduledPosts = posts.filter((row) => ["SCHEDULED", "PUBLISHING", "DELIVERED_TO_INBOX"].includes(String(row.status))).length;
  const connectedChannels = [tiktokConnected, false, false].filter(Boolean).length;

  const brandFoundation = score.categories.find((item) => item.key === "brandFoundation");
  const briefInput: DailyBriefInput = {
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    score,
    scoreTrend,
    dataCoverage,
    metrics: {
      activeCampaigns,
      draftsAwaitingApproval: awaitingApproval,
      failedScheduledPosts: posts.filter((row) => row.status === "FAILED").length,
      pendingScheduledPosts: posts.filter((row) => row.status === "PENDING_APPROVAL" || row.status === "PUBLISHING").length,
      failedTikTokJobs: tiktokJobs.filter((row) => row.status === "failed").length,
      scheduledPosts,
      connectedChannels,
      tiktokStatus,
      tiktokInboxPending: tiktokJobs.filter((row) => row.status === "inbox_delivered").length,
      approvedDrafts: drafts.filter((row) => row.status === "APPROVED").length,
      mediaAssetsCount: media.length,
      failedVideoRenders: aiUsage.filter((row) => row.status === "FAILED").length,
      integrationErrors: [tiktokStatus === "reconnect_required" ? 1 : 0].reduce((sum, value) => sum + value, 0),
      hasLogo: media.some((row) => {
        const tags = Array.isArray(row.tags) ? row.tags : [];
        return tags.includes("logo") || String(row.file_name || "").toLowerCase().includes("logo");
      }),
      hasBrandVoice: brandFoundation?.score ? brandFoundation.score >= 10 : false,
      onboardingComplete: brandFoundation?.status === "excellent" || brandFoundation?.status === "healthy",
      amazonAdsConnected: false,
      amazonRecommendationsReady: false,
      hasProductsTable,
      productsCount,
      recentDrafts24h: drafts.filter((row) => Date.now() - new Date(String(row.created_at)).getTime() <= 24 * 60 * 60 * 1000).length,
      recentScheduledPosts24h: posts.filter((row) => Date.now() - new Date(String(row.updated_at)).getTime() <= 24 * 60 * 60 * 1000).length,
      recentAiEvents24h: aiUsage.filter((row) => Date.now() - new Date(String(row.created_at)).getTime() <= 24 * 60 * 60 * 1000).length,
      lastVisitAt: lastBrief?.created_at || null,
      revenueLast30Days: revenueAvailable ? revenueLast30Days : null,
    },
  };

  const existingBrief = briefForTodayResult.data
    ? restoreDailyBriefFromSnapshot(briefForTodayResult.data as StoredBriefRow)
    : null;
  const shouldRefreshBrief = input.refreshBrief === true || !existingBrief;
  const brief = shouldRefreshBrief ? buildDailyBrief(briefInput) : existingBrief;

  if (!brief) {
    throw new Error("DASHBOARD_BRIEF_INVALID:Unable to restore existing daily brief.");
  }

  const memorySignals = await loadMarketingMemorySignals(input.workspaceId);
  if (memorySignals.length > 0) {
    await upsertMarketingMemorySignals(input.workspaceId, memorySignals);
  }

  const opportunityRisk = buildExecutiveOpportunityRisk({
    workspaceId: input.workspaceId,
    brief,
    score,
    scoreTrend,
    memorySignals,
    metrics: {
      activeCampaigns,
      scheduledPosts,
      draftsAwaitingApproval: awaitingApproval,
      connectedChannels,
      recentScheduledPosts24h: briefInput.metrics.recentScheduledPosts24h,
      revenueLast30Days: briefInput.metrics.revenueLast30Days,
      impressionsLast30Days,
      clicksLast30Days,
      engagementsLast30Days,
      spendLast30Days,
    },
  });

  const autonomousRecommendations = buildAutonomousRecommendations({
    workspaceId: input.workspaceId,
    brief,
    score,
    scoreTrend,
    memorySignals,
    metrics: {
      activeCampaigns,
      scheduledPosts,
      draftsAwaitingApproval: awaitingApproval,
      connectedChannels,
      recentScheduledPosts24h: briefInput.metrics.recentScheduledPosts24h,
      revenueLast30Days: briefInput.metrics.revenueLast30Days,
      impressionsLast30Days,
      clicksLast30Days,
      engagementsLast30Days,
      spendLast30Days,
    },
  });

  const leadGeneration = clicksLast30Days;
  const conversionRate = clicksLast30Days > 0 && revenueLast30Days > 0
    ? Math.min(100, (revenueLast30Days / Math.max(clicksLast30Days, 1)) * 0.8)
    : 0;
  const roas = spendLast30Days > 0 ? revenueLast30Days / spendLast30Days : 0;
  const estimatedConversions = Math.max(1, Math.round(clicksLast30Days * 0.02));
  const cac = spendLast30Days > 0 ? spendLast30Days / estimatedConversions : 0;
  const ltv = estimatedConversions > 0 ? revenueLast30Days / estimatedConversions : 0;

  const recentPerformance = performance.filter((row) => Date.now() - new Date(String(row.recorded_at)).getTime() <= 14 * 24 * 60 * 60 * 1000);
  const priorPerformance = performance.filter((row) => {
    const age = Date.now() - new Date(String(row.recorded_at)).getTime();
    return age > 14 * 24 * 60 * 60 * 1000 && age <= 28 * 24 * 60 * 60 * 1000;
  });

  const recentEngagement = sumPerformance(recentPerformance, "engagements");
  const priorEngagement = sumPerformance(priorPerformance, "engagements");
  const recentPaid = recentPerformance.reduce((sum, row) => sum + Number(row.spend || 0), 0);
  const priorPaid = priorPerformance.reduce((sum, row) => sum + Number(row.spend || 0), 0);
  const organicGrowth = priorEngagement > 0 ? ((recentEngagement - priorEngagement) / priorEngagement) * 100 : 0;
  const paidGrowth = priorPaid > 0 ? ((recentPaid - priorPaid) / priorPaid) * 100 : 0;

  const enrichedBrief: DailyBrief = {
    ...brief,
    autonomousRecommendations,
    morningBrief: {
      ...brief.morningBrief,
      opportunities: autonomousRecommendations.slice(0, 3).map((item) => item.title),
      aiRecommendations: autonomousRecommendations.slice(0, 3).map((item) => item.nextWorkflow),
      estimatedBusinessImpact: autonomousRecommendations[0]?.businessImpact || brief.morningBrief.estimatedBusinessImpact,
    },
  };

  if (shouldRefreshBrief) {
    await saveDailyBriefSnapshot(enrichedBrief);
  }

  const marketingScoreTrendLabel = formatTrendIndicator(scoreTrend);

  const cards: ExecutiveMetricCard[] = [
    {
      id: "marketing_score",
      label: "Marketing Score",
      value: `${score.score.toFixed(1)} / ${score.maximumScore}`,
      status: statusForHealth(score.score),
      trendDirection: scoreTrend.direction,
      trendLabel: marketingScoreTrendLabel,
      detail: `Version ${score.scoreVersion}`,
      aiExplanation: `Marketing Score aggregates weighted readiness and performance categories with ${confidenceScore}% confidence coverage.`,
      recommendedAction: enrichedBrief.recommendedNextAction?.title || "Review top score opportunity",
      confidence: score.confidence,
      href: metricHref("marketing_score"),
    },
    {
      id: "marketing_health",
      label: "Marketing Health",
      value: brief.urgency.label,
      status: brief.urgency.level === "critical"
        ? "critical"
        : brief.urgency.level === "high"
          ? "warning"
          : statusForHealth(score.score),
      trendDirection: scoreTrend.direction,
      trendLabel: marketingScoreTrendLabel,
      detail: enrichedBrief.urgency.summary,
      aiExplanation: "Marketing Health reflects urgency, queue pressure, integration quality, and score risk signals.",
      recommendedAction: enrichedBrief.recommendedNextAction?.title || "Address highest urgency factor",
      confidence: enrichedBrief.confidence,
      href: metricHref("marketing_health"),
    },
    {
      id: "revenue_impact",
      label: "Revenue Impact",
      value: revenueLabel,
      status: revenueAvailable ? "healthy" : "unavailable",
      trendDirection: "unknown",
      trendLabel: null,
      detail: revenueAvailable
        ? spendValues.length > 0
          ? "Connected conversion revenue from performance snapshots"
          : "Revenue exists but spend data is limited"
        : "Insufficient connected revenue data",
      aiExplanation: "Revenue impact uses connected performance snapshots from the last 30 days.",
      recommendedAction: revenueAvailable ? "Scale the strongest revenue-driving campaign" : "Connect additional conversion tracking sources",
      confidence: revenueAvailable ? 0.72 : 0.35,
      href: metricHref("revenue_impact"),
    },
    {
      id: "lead_generation",
      label: "Lead Generation",
      value: String(leadGeneration),
      status: leadGeneration > 0 ? "healthy" : "warning",
      trendDirection: leadGeneration > 0 ? "up" : "flat",
      trendLabel: "Estimated from connected click signals",
      detail: "Proxy lead volume from connected engagement and click activity",
      aiExplanation: "Lead generation is estimated from click-through behavior where explicit lead objects are unavailable.",
      recommendedAction: "Repurpose top asset into lead-capture variants across channels",
      confidence: leadGeneration > 0 ? 0.6 : 0.4,
      href: metricHref("lead_generation"),
    },
    {
      id: "conversion_rate",
      label: "Conversion Rate",
      value: formatPercent(conversionRate),
      status: conversionRate >= 2.5 ? "healthy" : conversionRate >= 1.2 ? "warning" : "critical",
      trendDirection: conversionRate >= 2.5 ? "up" : conversionRate >= 1.2 ? "flat" : "down",
      trendLabel: "Directional estimate",
      detail: "Modeled from connected click and revenue signals",
      aiExplanation: "Conversion rate is directional when explicit conversion events are partially connected.",
      recommendedAction: "Improve high-intent page and message alignment",
      confidence: conversionRate > 0 ? 0.55 : 0.35,
      href: metricHref("conversion_rate"),
    },
    {
      id: "roas",
      label: "ROAS",
      value: roas > 0 ? `${roas.toFixed(2)}x` : "Insufficient spend data",
      status: roas >= 2 ? "healthy" : roas >= 1 ? "warning" : "critical",
      trendDirection: roas >= 2 ? "up" : roas >= 1 ? "flat" : "down",
      trendLabel: "Revenue / spend",
      detail: "Return on ad spend from connected snapshots",
      aiExplanation: "ROAS compares connected revenue and spend across the same observation window.",
      recommendedAction: "Shift budget toward top-converting creatives",
      confidence: roas > 0 ? 0.68 : 0.3,
      href: metricHref("roas"),
    },
    {
      id: "cac",
      label: "CAC",
      value: cac > 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cac) : "Not enough data",
      status: cac > 0 && cac <= 40 ? "healthy" : cac > 0 && cac <= 80 ? "warning" : "critical",
      trendDirection: cac > 0 && cac <= 40 ? "up" : cac > 0 && cac <= 80 ? "flat" : "down",
      trendLabel: "Estimated acquisition cost",
      detail: "Directional CAC estimate from spend and modeled conversion events",
      aiExplanation: "CAC is estimated while direct customer-acquisition attribution is still maturing.",
      recommendedAction: "Lower CAC by prioritizing top-performing message variants",
      confidence: cac > 0 ? 0.5 : 0.3,
      href: metricHref("cac"),
    },
    {
      id: "ltv",
      label: "LTV",
      value: ltv > 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(ltv) : "Not enough data",
      status: ltv >= 120 ? "healthy" : ltv >= 60 ? "warning" : "critical",
      trendDirection: ltv >= 120 ? "up" : ltv >= 60 ? "flat" : "down",
      trendLabel: "Directional estimate",
      detail: "Lifetime value proxy from connected revenue patterns",
      aiExplanation: "LTV is modeled from connected revenue and estimated conversion distribution.",
      recommendedAction: "Deploy retention campaign to increase repeat purchase rate",
      confidence: ltv > 0 ? 0.48 : 0.3,
      href: metricHref("ltv"),
    },
    {
      id: "organic_growth",
      label: "Organic Growth",
      value: formatPercent(organicGrowth),
      status: organicGrowth >= 5 ? "healthy" : organicGrowth >= 0 ? "warning" : "critical",
      trendDirection: organicGrowth > 0 ? "up" : organicGrowth < 0 ? "down" : "flat",
      trendLabel: "Last 14d vs prior 14d",
      detail: "Engagement-driven growth trend from non-paid signals",
      aiExplanation: "Organic growth compares engagement momentum between recent and prior windows.",
      recommendedAction: "Repurpose strongest organic asset across additional channels",
      confidence: priorEngagement > 0 ? 0.62 : 0.4,
      href: metricHref("organic_growth"),
    },
    {
      id: "paid_growth",
      label: "Paid Growth",
      value: formatPercent(paidGrowth),
      status: paidGrowth >= 5 ? "healthy" : paidGrowth >= 0 ? "warning" : "critical",
      trendDirection: paidGrowth > 0 ? "up" : paidGrowth < 0 ? "down" : "flat",
      trendLabel: "Last 14d vs prior 14d",
      detail: "Paid-media momentum from connected spend trend",
      aiExplanation: "Paid growth compares current spend and distribution cadence with the previous period.",
      recommendedAction: "Increase investment in channels with strongest ROAS signals",
      confidence: priorPaid > 0 ? 0.58 : 0.38,
      href: metricHref("paid_growth"),
    },
    {
      id: "ai_confidence",
      label: "AI Confidence",
      value: `${confidenceScore}%`,
      status: confidenceScore >= 75 ? "healthy" : confidenceScore >= 45 ? "warning" : "critical",
      trendDirection: "unknown",
      trendLabel: null,
      detail: aiConfidenceDetail(dataCoverage),
      aiExplanation: "Confidence reflects source connectivity, recency, and signal consistency.",
      recommendedAction: "Improve confidence by connecting missing data sources",
      confidence: dataCoverage.overallConfidence,
      href: metricHref("ai_confidence"),
    },
    {
      id: "biggest_opportunity",
      label: "Biggest Opportunity",
      value: opportunityRisk.biggestOpportunity,
      status: "healthy",
      trendDirection: "up",
      trendLabel: "AI-ranked from current opportunity stack",
      detail: "Highest-ROI recommendation from autonomous opportunity scoring",
      aiExplanation: "Opportunity prioritization blends performance, urgency, and execution readiness.",
      recommendedAction: autonomousRecommendations[0]?.nextWorkflow || "Review executive brief opportunities",
      confidence: enrichedBrief.confidence,
      href: metricHref("biggest_opportunity"),
    },
    {
      id: "biggest_risk",
      label: "Biggest Risk",
      value: opportunityRisk.biggestRisk,
      status: "critical",
      trendDirection: "down",
      trendLabel: "AI-ranked risk to execution momentum",
      detail: "Most immediate downside risk if unaddressed",
      aiExplanation: "Risk prioritization weighs urgency, backlog pressure, and signal degradation.",
      recommendedAction: enrichedBrief.recommendedNextAction?.title || "Address highest urgency blocker",
      confidence: enrichedBrief.confidence,
      href: metricHref("biggest_risk"),
    },
    {
      id: "active_campaigns",
      label: "Active Campaigns",
      value: String(activeCampaigns),
      status: activeCampaigns > 0 ? "healthy" : "warning",
      trendDirection: "unknown",
      trendLabel: null,
      detail: "Real campaign records in this workspace",
      aiExplanation: "Active campaign count is sourced directly from connected campaign entities.",
      recommendedAction: "Ensure each active campaign has at least one cross-channel extension",
      confidence: 0.9,
      href: metricHref("active_campaigns"),
    },
    {
      id: "content_awaiting_approval",
      label: "Content Awaiting Approval",
      value: String(awaitingApproval),
      status: awaitingApproval > 0 ? "warning" : "healthy",
      trendDirection: "unknown",
      trendLabel: null,
      detail: "Draft and schedule approval queue",
      aiExplanation: "Queue pressure increases delivery risk when approvals lag publishing cadence.",
      recommendedAction: "Batch-approve top-priority drafts to unblock scheduled execution",
      confidence: 0.85,
      href: metricHref("content_awaiting_approval"),
    },
    {
      id: "scheduled_posts",
      label: "Scheduled Posts",
      value: String(scheduledPosts),
      status: scheduledPosts > 0 ? "healthy" : "warning",
      trendDirection: "unknown",
      trendLabel: null,
      detail: "Upcoming scheduled and in-progress posts",
      aiExplanation: "Scheduling coverage indicates near-term execution continuity.",
      recommendedAction: "Backfill missing publishing days with repurposed winning assets",
      confidence: 0.88,
      href: metricHref("scheduled_posts"),
    },
    {
      id: "connected_channels",
      label: "Connected Channels",
      value: String(connectedChannels),
      status: connectedChannels > 0 ? "healthy" : "critical",
      trendDirection: "unknown",
      trendLabel: null,
      detail: "Counts currently connected distribution channels",
      aiExplanation: "Connected channels define the breadth of distribution and optimization opportunities.",
      recommendedAction: "Connect one additional channel to increase cross-channel leverage",
      confidence: 0.92,
      href: metricHref("connected_channels"),
    },
  ];

  const recentActivity: RecentActivityItem[] = [
    ...posts
      .slice(0, 4)
      .map((row, index) => ({
        id: `post-${index}`,
        type: "scheduled_post",
        label: `Post status: ${String(row.status).replaceAll("_", " ")}`,
        createdAt: String(row.updated_at),
        href: "/calendar",
      })),
    ...tiktokJobs
      .slice(0, 4)
      .map((row, index) => ({
        id: `tiktok-job-${index}`,
        type: "tiktok_job",
        label: `TikTok job: ${String(row.status).replaceAll("_", " ")}`,
        createdAt: String(row.updated_at),
        href: "/settings/integrations/tiktok",
      })),
  ]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 8);

  const forecastSummary = forecasts.slice(0, 6).map((row) => {
    const label = buildMeasuredOrEstimatedLabel({
      measured: Boolean(row.measured),
      measuredValue: row.measured_value,
      estimatedValue: row.estimated_value,
      unit: row.forecast_type === "confidence" ? "%" : "count",
    });
    return {
      type: String(row.forecast_type || "forecast"),
      label,
      confidence: Number(row.confidence || 0),
      note: String(row.note || "No forecast note provided."),
    };
  });

  const timeline = executionEvents.slice(0, 12).map((event) => ({
    id: event.id,
    timestamp: String(event.created_at || new Date().toISOString()),
    type: String(event.event_type || "event"),
    status: String(event.status || "unknown"),
    message: String(event.message || "Execution event"),
    actor: event.agent ? `agent:${event.agent}` : event.actor_user_id ? `user:${event.actor_user_id.slice(0, 8)}` : "system",
  }));

  const pendingNotifications = notifications.filter((row) => row.status === "PENDING").length;
  const departments = buildDepartmentStatus({
    workflowSummary: operationalSnapshot.workflowSummary,
    publishingQueue: operationalSnapshot.publishingQueue,
    approvalSummary: operationalSnapshot.approvalSummary,
  });

  const channelHealth: ChannelHealthItem[] = [
    {
      key: "tiktok",
      label: "TikTok",
      connected: tiktokConnected,
      health: tiktokConnected ? "healthy" : tiktokStatus === "reconnect_required" ? "stale" : "missing",
      message:
        tiktokStatus === "reconnect_required"
          ? "Reconnect required"
          : tiktokConnected
            ? "Connected"
            : "Not connected",
      lastSyncedAt: tiktokConnection?.refreshed_at || tiktokConnection?.updated_at || null,
    },
    {
      key: "amazon_ads",
      label: "Amazon Ads",
      connected: false,
      health: "limited",
      message: "Connection persistence is not available in current schema.",
      lastSyncedAt: null,
    },
    {
      key: "email",
      label: "Email",
      connected: false,
      health: "missing",
      message: "Email provider not connected.",
      lastSyncedAt: null,
    },
  ];

  const now = new Date();

  return {
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    firstName: input.firstName,
    dateLabel: now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    greeting: greetingForDate(now),
    modeSettings,
    capabilities: modeCapabilities(modeSettings.operatingMode, modeSettings.autonomyLevel),
    cards,
    score,
    scoreTrend,
    brief: enrichedBrief,
    autonomousRecommendations,
    biggestOpportunity: opportunityRisk.biggestOpportunity,
    biggestRisk: opportunityRisk.biggestRisk,
    memorySignals,
    dataCoverage,
    channelHealth,
    recentActivity,
    autonomyLevel: modeSettings.autonomyLevel,
    workflowSummary: operationalSnapshot.workflowSummary,
    approvalSummary: operationalSnapshot.approvalSummary,
    publishingQueue: operationalSnapshot.publishingQueue,
    forecastSummary,
    timeline,
    aiHealth: {
      status: aiHealthMetrics.status,
      acceptanceRate: formatPercent(aiHealthMetrics.acceptanceRate * 100),
      executionSuccessRate: formatPercent(aiHealthMetrics.executionSuccessRate * 100),
      publishingSuccessRate: formatPercent(aiHealthMetrics.publishingSuccessRate * 100),
      forecastAccuracyRate: formatPercent(aiHealthMetrics.forecastAccuracyRate * 100),
    },
    pendingNotifications,
    departments,
  };
}
