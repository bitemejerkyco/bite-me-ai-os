import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  MARKETING_CATEGORY_ORDER,
  MARKETING_SCORE_MAXIMUM,
  MARKETING_SCORE_VERSION,
  MARKETING_SCORE_WEIGHTS,
  categoryLabel,
  clampScore,
  marketingWeightTotal,
  scoreHealthStatus,
  summarizeConfidence,
  toCategoryResult,
  type MarketingOpportunity,
  type MarketingScoreCategoryKey,
  type MarketingScoreInput,
  type MarketingScoreResult,
  type MarketingScoreTrend,
} from "@/features/marketing-director/marketing-score-rules";

type ScoreSnapshotRow = { score: number | null; generated_at: string | null };
type WorkspaceRow = {
  id: string;
  name: string | null;
  website: string | null;
  industry: string | null;
  primary_goal: string | null;
  audience: string | null;
  voice: string | null;
};

function logWorkspaceScoreRecovery(workspaceId: string, reason: string): void {
  console.info(JSON.stringify({
    event: "WORKSPACE_BOOTSTRAP_RECOVERED",
    workspaceId,
    source: "marketing-score",
    reason,
  }));
}
type DraftRow = { status: string | null; created_at: string | null };
type CampaignRow = { status: string | null; updated_at: string | null };
type ScheduledPostRow = { status: string | null; scheduled_for: string | null; updated_at: string | null };
type PerformanceRow = {
  impressions: number | null;
  engagements: number | null;
  clicks: number | null;
  conversions: number | null;
  revenue: number | null;
  spend: number | null;
  recorded_at: string | null;
};
type MediaRow = { mime_type: string | null; file_name: string | null; tags: string[] | null; created_at: string | null };
type AiUsageRow = { status: string | null; created_at: string | null };
type TikTokConnectionRow = { status: string | null; updated_at: string | null; refreshed_at: string | null };

function ratio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
}

function daysSince(timestamp: string | null): number | null {
  if (!timestamp) return null;
  return Math.floor((Date.now() - new Date(timestamp).getTime()) / (24 * 60 * 60 * 1000));
}

function channelEnabled(input: MarketingScoreInput, key: keyof MarketingScoreInput["integrations"]): boolean {
  const intentionallyDisabled = new Set(input.intentionallyDisabledChannels.map((item) => (item ?? "").toLowerCase()));
  if (intentionallyDisabled.has(key.toLowerCase())) return false;
  return input.integrations[key].enabled;
}

export function calculateMarketingScore(input: MarketingScoreInput): MarketingScoreResult {
  if (marketingWeightTotal() !== MARKETING_SCORE_MAXIMUM) {
    throw new Error("MARKETING_SCORE_WEIGHTS_INVALID:Category weights must total 100.");
  }

  const categories = [] as MarketingScoreResult["categories"];

  const brandFields = [
    input.brand.businessName,
    input.brand.website,
    input.brand.industry,
    input.brand.primaryGoal,
    input.brand.audience,
    input.brand.voice,
  ];
  const brandFilled = brandFields.filter((item) => Boolean(String(item || "").trim())).length;
  categories.push(
    toCategoryResult({
      key: "brandFoundation",
      maximumScore: MARKETING_SCORE_WEIGHTS.brandFoundation,
      score: MARKETING_SCORE_WEIGHTS.brandFoundation * ratio(brandFilled, brandFields.length),
      explanation:
        brandFilled === brandFields.length
          ? "Brand profile has all core fields configured."
          : "Brand profile is missing core business context fields.",
      evidence: [
        `Configured brand fields: ${brandFilled}/${brandFields.length}`,
        `Website configured: ${Boolean(input.brand.website)}`,
      ],
      recommendedAction: "Complete business profile, audience, and brand voice fields.",
      confidence: 0.9,
    }),
  );

  const recentDraftActivity = input.drafts.recent7Days;
  const consistencyRatio = Math.min(1, ratio(recentDraftActivity, 5));
  categories.push(
    toCategoryResult({
      key: "contentConsistency",
      maximumScore: MARKETING_SCORE_WEIGHTS.contentConsistency,
      score: MARKETING_SCORE_WEIGHTS.contentConsistency * consistencyRatio,
      explanation:
        recentDraftActivity > 0
          ? "Recent content output is available for consistency analysis."
          : "No recent content activity detected.",
      evidence: [
        `Drafts created in last 7 days: ${recentDraftActivity}`,
        `Total drafts: ${input.drafts.total}`,
      ],
      recommendedAction: "Publish a weekly content cadence to stabilize consistency.",
      confidence: input.drafts.total > 0 ? 0.8 : 0.4,
    }),
  );

  const readinessRatio = input.drafts.total > 0 ? ratio(input.drafts.approved, input.drafts.total) : 0;
  categories.push(
    toCategoryResult({
      key: "contentReadiness",
      maximumScore: MARKETING_SCORE_WEIGHTS.contentReadiness,
      score: MARKETING_SCORE_WEIGHTS.contentReadiness * readinessRatio,
      explanation:
        input.drafts.total > 0
          ? "Content readiness is based on approved draft ratio."
          : "Content readiness is unavailable without drafts.",
      evidence: [
        `Approved drafts: ${input.drafts.approved}`,
        `Total drafts: ${input.drafts.total}`,
      ],
      recommendedAction: "Approve high-quality drafts so campaigns can be scheduled.",
      confidence: input.drafts.total > 0 ? 0.8 : 0.3,
      available: input.drafts.total > 0,
    }),
  );

  const enabledChannels = ["tiktok", "amazonAds", "email"].filter((key) =>
    channelEnabled(input, key as keyof MarketingScoreInput["integrations"]),
  );
  const connectedEnabledChannels = enabledChannels.filter(
    (key) => input.integrations[key as keyof MarketingScoreInput["integrations"]].connected,
  );
  const channelRatio = enabledChannels.length === 0 ? 1 : ratio(connectedEnabledChannels.length, enabledChannels.length);
  categories.push(
    toCategoryResult({
      key: "channelConnections",
      maximumScore: MARKETING_SCORE_WEIGHTS.channelConnections,
      score: MARKETING_SCORE_WEIGHTS.channelConnections * channelRatio,
      explanation:
        enabledChannels.length === 0
          ? "No channels are currently enabled, so this category is neutral."
          : "Channel score is based on enabled channels only.",
      evidence: [
        `Enabled channels: ${enabledChannels.length}`,
        `Connected enabled channels: ${connectedEnabledChannels.length}`,
      ],
      recommendedAction: "Connect at least one active distribution channel used by your team.",
      confidence: enabledChannels.length > 0 ? 0.85 : 0.5,
    }),
  );

  const campaignActivityRatio = Math.min(1, ratio(input.campaigns.active + input.campaigns.recent30Days, 4));
  categories.push(
    toCategoryResult({
      key: "campaignActivity",
      maximumScore: MARKETING_SCORE_WEIGHTS.campaignActivity,
      score: MARKETING_SCORE_WEIGHTS.campaignActivity * campaignActivityRatio,
      explanation:
        input.campaigns.total > 0
          ? "Campaign activity uses active and recently updated campaigns."
          : "No campaigns are available yet.",
      evidence: [
        `Active campaigns: ${input.campaigns.active}`,
        `Recent campaign updates (30d): ${input.campaigns.recent30Days}`,
      ],
      recommendedAction: "Activate at least one current campaign aligned to your core objective.",
      confidence: input.campaigns.total > 0 ? 0.75 : 0.3,
      available: input.campaigns.total > 0,
    }),
  );

  const analyticsRatio = Math.min(1, ratio(input.performance.snapshots, 20));
  categories.push(
    toCategoryResult({
      key: "analyticsCoverage",
      maximumScore: MARKETING_SCORE_WEIGHTS.analyticsCoverage,
      score: MARKETING_SCORE_WEIGHTS.analyticsCoverage * analyticsRatio,
      explanation:
        input.performance.snapshots > 0
          ? "Analytics coverage is measured from performance snapshot availability."
          : "No performance snapshots are available.",
      evidence: [
        `Performance snapshots: ${input.performance.snapshots}`,
        `Last performance sync: ${input.performance.lastRecordedAt || "Never"}`,
      ],
      recommendedAction: "Connect analytics-enabled channels and keep syncs current.",
      confidence: input.performance.snapshots > 0 ? 0.8 : 0.25,
      available: input.performance.snapshots > 0,
    }),
  );

  const engagementRate = ratio(input.performance.engagements, input.performance.impressions);
  const engagementScoreRatio = Math.min(1, ratio(engagementRate, 0.05));
  categories.push(
    toCategoryResult({
      key: "audienceEngagement",
      maximumScore: MARKETING_SCORE_WEIGHTS.audienceEngagement,
      score: MARKETING_SCORE_WEIGHTS.audienceEngagement * engagementScoreRatio,
      explanation:
        input.performance.impressions > 0
          ? "Engagement is evaluated from real impressions and engagements."
          : "Audience engagement is unavailable without impression data.",
      evidence: [
        `Impressions: ${input.performance.impressions}`,
        `Engagements: ${input.performance.engagements}`,
      ],
      recommendedAction: "Refresh creative and posting cadence to increase engagement.",
      confidence: input.performance.impressions > 0 ? 0.75 : 0.2,
      available: input.performance.impressions > 0,
    }),
  );

  const paidMediaConnected = channelEnabled(input, "amazonAds") && input.integrations.amazonAds.connected;
  const paidMediaStale = daysSince(input.integrations.amazonAds.lastSyncedAt);
  categories.push(
    toCategoryResult({
      key: "paidMediaHealth",
      maximumScore: MARKETING_SCORE_WEIGHTS.paidMediaHealth,
      score: paidMediaConnected
        ? MARKETING_SCORE_WEIGHTS.paidMediaHealth * (paidMediaStale !== null && paidMediaStale > 14 ? 0.6 : 0.9)
        : 0,
      explanation: paidMediaConnected
        ? "Paid media health is based on connection and sync recency."
        : "Paid media health is unavailable because Amazon Ads is not connected.",
      evidence: [
        `Amazon Ads connected: ${input.integrations.amazonAds.connected}`,
        `Amazon Ads message: ${input.integrations.amazonAds.message}`,
      ],
      recommendedAction: "Connect Amazon Ads and review PPC recommendations weekly.",
      confidence: paidMediaConnected ? 0.7 : 0.2,
      available: paidMediaConnected,
    }),
  );

  const emailConnected = channelEnabled(input, "email") && input.integrations.email.connected;
  categories.push(
    toCategoryResult({
      key: "emailHealth",
      maximumScore: MARKETING_SCORE_WEIGHTS.emailHealth,
      score: emailConnected ? MARKETING_SCORE_WEIGHTS.emailHealth * 0.85 : 0,
      explanation: emailConnected
        ? "Email provider is connected and can contribute to lifecycle marketing."
        : "Email health is unavailable because no email provider is connected.",
      evidence: [
        `Email connected: ${input.integrations.email.connected}`,
        `Email status: ${input.integrations.email.message}`,
      ],
      recommendedAction: "Connect an email provider and configure lifecycle journeys.",
      confidence: emailConnected ? 0.65 : 0.2,
      available: emailConnected,
    }),
  );

  const compliancePenalty = Math.min(1, ratio(input.calendar.failed + input.drafts.awaitingApproval, 6));
  categories.push(
    toCategoryResult({
      key: "complianceReadiness",
      maximumScore: MARKETING_SCORE_WEIGHTS.complianceReadiness,
      score: MARKETING_SCORE_WEIGHTS.complianceReadiness * (1 - compliancePenalty),
      explanation:
        input.calendar.failed > 0
          ? "Compliance readiness is reduced by failed publishing workflow states."
          : "No major compliance workflow failures detected.",
      evidence: [
        `Failed scheduled posts: ${input.calendar.failed}`,
        `Awaiting approval items: ${input.drafts.awaitingApproval}`,
      ],
      recommendedAction: "Resolve failed publishing records and tighten approval checks.",
      confidence: 0.7,
    }),
  );

  const weightedBreakdown = MARKETING_CATEGORY_ORDER.reduce((acc, key) => {
    const category = categories.find((item) => item.key === key);
    acc[key] = category ? clampScore(category.score, category.maximumScore) : 0;
    return acc;
  }, {} as Record<MarketingScoreCategoryKey, number>);

  const score = clampScore(
    categories.reduce((sum, category) => sum + category.score, 0),
    MARKETING_SCORE_MAXIMUM,
  );

  const confidence = Number(
    (
      categories.reduce((sum, category) => sum + category.confidence, 0) /
      categories.length
    ).toFixed(2),
  );

  return {
    workspaceId: input.workspaceId,
    score,
    maximumScore: MARKETING_SCORE_MAXIMUM,
    status: scoreHealthStatus(score),
    confidence,
    confidenceReason: summarizeConfidence(confidence),
    scoreVersion: MARKETING_SCORE_VERSION,
    generatedAt: input.generatedAt || new Date().toISOString(),
    categories,
    weightedBreakdown,
  };
}

export function getTopMarketingOpportunities(scoreResult: MarketingScoreResult): MarketingOpportunity[] {
  return scoreResult.categories
    .filter((category) => ["critical", "needs_attention", "unavailable"].includes(category.status))
    .map((category) => ({
      category: category.key,
      title: categoryLabel(category.key),
      status: category.status,
      scoreGap: Number((category.maximumScore - category.score).toFixed(2)),
      recommendation: category.recommendedAction,
      evidence: category.evidence,
    }))
    .sort((left, right) => right.scoreGap - left.scoreGap)
    .slice(0, 5);
}

export async function getScoreTrend(workspaceId: string): Promise<MarketingScoreTrend> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("marketing_score_snapshots")
    .select("score,generated_at")
    .eq("workspace_id", workspaceId)
    .order("generated_at", { ascending: false })
    .limit(2);

  const snapshots = (data as ScoreSnapshotRow[] | null) || null;

  if (error || !snapshots || snapshots.length < 2) {
    return {
      available: false,
      direction: "unknown",
      delta: 0,
      previousScore: null,
      currentScore: 0,
      previousGeneratedAt: null,
      currentGeneratedAt: new Date().toISOString(),
    };
  }

  const current = Number(snapshots[0].score || 0);
  const previous = Number(snapshots[1].score || 0);
  const delta = Number((current - previous).toFixed(2));

  return {
    available: true,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    delta,
    previousScore: previous,
    currentScore: current,
    previousGeneratedAt: String(snapshots[1].generated_at),
    currentGeneratedAt: String(snapshots[0].generated_at),
  };
}

export async function getMarketingScoreForWorkspace(workspaceId: string): Promise<MarketingScoreResult> {
  const admin = createAdminClient();

  const [workspaceResult, draftsResult, campaignsResult, postsResult, performanceResult, mediaResult, aiUsageResult, tiktokResult] = await Promise.all([
    admin
      .from("workspaces")
      .select("id,name,website,industry,primary_goal,audience,voice")
      .eq("id", workspaceId)
      .maybeSingle(),
    admin
      .from("content_drafts")
      .select("status,created_at")
      .eq("workspace_id", workspaceId),
    admin
      .from("campaigns")
      .select("status,updated_at")
      .eq("workspace_id", workspaceId),
    admin
      .from("scheduled_posts")
      .select("status,scheduled_for,updated_at")
      .eq("workspace_id", workspaceId),
    admin
      .from("content_performance_snapshots")
      .select("impressions,engagements,clicks,conversions,revenue,spend,recorded_at")
      .eq("workspace_id", workspaceId),
    admin
      .from("media_assets")
      .select("mime_type,file_name,tags,created_at")
      .eq("workspace_id", workspaceId),
    admin
      .from("ai_usage_events")
      .select("status,created_at")
      .eq("account_id", workspaceId),
    admin
      .from("tiktok_connections")
      .select("status,updated_at,refreshed_at")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
  ]);

  const workspace = (workspaceResult.data as WorkspaceRow | null) || null;
  const drafts = (draftsResult.data as DraftRow[] | null) || [];
  const campaigns = (campaignsResult.data as CampaignRow[] | null) || [];
  const posts = (postsResult.data as ScheduledPostRow[] | null) || [];
  const performance = (performanceResult.data as PerformanceRow[] | null) || [];
  const media = (mediaResult.data as MediaRow[] | null) || [];
  const aiUsage = (aiUsageResult.data as AiUsageRow[] | null) || [];
  const tiktok = (tiktokResult.data as TikTokConnectionRow | null) || null;

  const resolvedWorkspace = workspace || {
    id: workspaceId,
    name: "My Workspace",
    website: null,
    industry: "GENERAL_RETAIL",
    primary_goal: null,
    audience: null,
    voice: null,
  };

  if (workspaceResult.error || !workspace) {
    logWorkspaceScoreRecovery(workspaceId, workspaceResult.error?.message || "Workspace not found.");
  }
  if (draftsResult.error) throw new Error(`MARKETING_SCORE_DRAFTS_FAILED:${draftsResult.error.message}`);
  if (campaignsResult.error) throw new Error(`MARKETING_SCORE_CAMPAIGNS_FAILED:${campaignsResult.error.message}`);
  if (postsResult.error) throw new Error(`MARKETING_SCORE_POSTS_FAILED:${postsResult.error.message}`);
  if (performanceResult.error) throw new Error(`MARKETING_SCORE_PERFORMANCE_FAILED:${performanceResult.error.message}`);
  if (mediaResult.error) throw new Error(`MARKETING_SCORE_MEDIA_FAILED:${mediaResult.error.message}`);
  if (aiUsageResult.error) throw new Error(`MARKETING_SCORE_AI_USAGE_FAILED:${aiUsageResult.error.message}`);

  const score = calculateMarketingScore({
    workspaceId,
    brand: {
      businessName: resolvedWorkspace.name,
      website: resolvedWorkspace.website,
      industry: resolvedWorkspace.industry,
      primaryGoal: resolvedWorkspace.primary_goal,
      audience: resolvedWorkspace.audience,
      voice: resolvedWorkspace.voice,
    },
    drafts: {
      total: drafts.length,
      approved: drafts.filter((row) => row.status === "APPROVED").length,
      archived: drafts.filter((row) => row.status === "ARCHIVED").length,
      recent7Days: drafts.filter(
        (row) => Date.now() - new Date(String(row.created_at)).getTime() <= 7 * 24 * 60 * 60 * 1000,
      ).length,
      awaitingApproval: drafts.filter((row) => row.status === "DRAFT").length,
    },
    campaigns: {
      total: campaigns.length,
      active: campaigns.filter((row) => row.status === "ACTIVE").length,
      recent30Days: campaigns.filter(
        (row) => Date.now() - new Date(String(row.updated_at)).getTime() <= 30 * 24 * 60 * 60 * 1000,
      ).length,
    },
    calendar: {
      scheduled: posts.filter((row) => row.status === "SCHEDULED").length,
      publishing: posts.filter((row) => row.status === "PUBLISHING").length,
      deliveredToInbox: posts.filter((row) => row.status === "DELIVERED_TO_INBOX").length,
      failed: posts.filter((row) => row.status === "FAILED").length,
      pendingApproval: posts.filter((row) => row.status === "PENDING_APPROVAL").length,
      publishedRecent30Days: posts.filter(
        (row) => row.status === "PUBLISHED" && Date.now() - new Date(String(row.updated_at)).getTime() <= 30 * 24 * 60 * 60 * 1000,
      ).length,
    },
    performance: {
      snapshots: performance.length,
      impressions: performance.reduce((sum, row) => sum + Number(row.impressions || 0), 0),
      engagements: performance.reduce((sum, row) => sum + Number(row.engagements || 0), 0),
      clicks: performance.reduce((sum, row) => sum + Number(row.clicks || 0), 0),
      conversions: performance.reduce((sum, row) => sum + Number(row.conversions || 0), 0),
      spend: performance.reduce((sum, row) => sum + Number(row.spend || 0), 0),
      revenue: performance.reduce((sum, row) => sum + Number(row.revenue || 0), 0),
      lastRecordedAt: performance
        .map((row) => String(row.recorded_at))
        .sort()
        .at(-1) || null,
    },
    media: {
      total: media.length,
      video: media.filter((row) => String(row.mime_type || "").startsWith("video/")).length,
      logoTagged: media.filter((row) => {
        const tags = Array.isArray(row.tags) ? row.tags : [];
        return tags.includes("logo") || String(row.file_name || "").toLowerCase().includes("logo");
      }).length,
      lastUploadedAt: media.map((row) => String(row.created_at)).sort().at(-1) || null,
    },
    aiUsage: {
      totalEvents30Days: aiUsage.filter(
        (row) => Date.now() - new Date(String(row.created_at)).getTime() <= 30 * 24 * 60 * 60 * 1000,
      ).length,
      failedEvents30Days: aiUsage.filter(
        (row) =>
          row.status === "FAILED" &&
          Date.now() - new Date(String(row.created_at)).getTime() <= 30 * 24 * 60 * 60 * 1000,
      ).length,
      lastEventAt: aiUsage.map((row) => String(row.created_at)).sort().at(-1) || null,
    },
    integrations: {
      tiktok: {
        enabled: true,
        connected: Boolean(tiktok && tiktok.status === "CONNECTED"),
        active: Boolean(tiktok && tiktok.status === "CONNECTED"),
        lastSyncedAt: tiktok?.refreshed_at || tiktok?.updated_at || null,
        message: tiktok?.status
          ? `TikTok status: ${String(tiktok.status).toLowerCase()}`
          : "TikTok is not connected.",
      },
      amazonAds: {
        enabled: true,
        connected: false,
        active: false,
        lastSyncedAt: null,
        message: "Amazon Ads connection persistence is not available in the current schema.",
      },
      email: {
        enabled: true,
        connected: false,
        active: false,
        lastSyncedAt: null,
        message: "Email provider integration is not configured.",
      },
    },
    intentionallyDisabledChannels: [],
  });

  await admin.from("marketing_score_snapshots").insert({
    workspace_id: workspaceId,
    score: score.score,
    score_version: score.scoreVersion,
    category_scores: score.categories,
    data_coverage: {
      confidence: score.confidence,
      confidenceReason: score.confidenceReason,
    },
    generated_at: score.generatedAt,
  } as never);

  return score;
}
