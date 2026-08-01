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
import { getMarketingModeSettings, modeCapabilities, type MarketingModeSettings } from "@/features/marketing-director/modes";
import {
  getMarketingScoreForWorkspace,
  getScoreTrend,
} from "@/features/marketing-director/marketing-score";
import { formatTrendIndicator } from "@/features/marketing-director/trends";
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
export type ExecutiveMetricCard = {
  id: ExecutiveMetricCardId;
  label: string;
  value: string;
  status: "healthy" | "warning" | "critical" | "unavailable";
  trendDirection: "up" | "down" | "flat" | "unknown";
  trendLabel: string | null;
  detail: string;
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
  dataCoverage: DataCoverageModel;
  channelHealth: ChannelHealthItem[];
  recentActivity: RecentActivityItem[];
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

  const campaigns = (campaignsResult.data as CampaignRow[] | null) || [];
  const drafts = (draftsResult.data as DraftRow[] | null) || [];
  const posts = (scheduledPostsResult.data as ScheduledPostRow[] | null) || [];
  const tiktokConnection = (tiktokResult.data as TikTokConnectionRow | null) || null;
  const tiktokJobs = (tiktokJobsResult.data as TikTokJobRow[] | null) || [];
  const performance = (performanceResult.data as PerformanceRow[] | null) || [];
  const media = (mediaResult.data as MediaRow[] | null) || [];
  const aiUsage = (aiUsageResult.data as AiUsageRow[] | null) || [];
  const videoTransactions = (videoTransactionsResult.data as VideoTransactionRow[] | null) || [];

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

  if (shouldRefreshBrief) {
    await saveDailyBriefSnapshot(brief);
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
      detail: brief.urgency.summary,
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
      href: metricHref("revenue_impact"),
    },
    {
      id: "ai_confidence",
      label: "AI Confidence",
      value: `${confidenceScore}%`,
      status: confidenceScore >= 75 ? "healthy" : confidenceScore >= 45 ? "warning" : "critical",
      trendDirection: "unknown",
      trendLabel: null,
      detail: aiConfidenceDetail(dataCoverage),
      href: metricHref("ai_confidence"),
    },
    {
      id: "active_campaigns",
      label: "Active Campaigns",
      value: String(activeCampaigns),
      status: activeCampaigns > 0 ? "healthy" : "warning",
      trendDirection: "unknown",
      trendLabel: null,
      detail: "Real campaign records in this workspace",
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
    capabilities: modeCapabilities(modeSettings.operatingMode),
    cards,
    score,
    scoreTrend,
    brief,
    dataCoverage,
    channelHealth,
    recentActivity,
  };
}
