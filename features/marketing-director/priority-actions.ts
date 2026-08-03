import { priorityRank, type PriorityAction, type PriorityLevel } from "@/features/marketing-director/daily-brief-rules";

type PriorityActionInput = {
  workspaceId: string;
  onboardingComplete: boolean;
  hasLogo: boolean;
  hasBrandVoice: boolean;
  tiktokStatus: "connected" | "reconnect_required" | "disconnected";
  tiktokInboxPending: number;
  draftsAwaitingApproval: number;
  failedScheduledPosts: number;
  failedVideoRenders: number;
  amazonAdsConnected: boolean;
  amazonRecommendationsReady: boolean;
  hasProductsTable: boolean;
  productsCount: number | null;
  mediaAssetsCount: number;
  approvedDrafts: number;
  upcomingScheduledPosts: number;
  pendingScheduledPosts: number;
  integrationErrors: number;
  activeCampaigns: number;
  failedTikTokJobs: number;
  missingIntegrations: string[];
  revenueAvailable: boolean;
  lowScoreCategories: Array<{ key: string; label: string; status: string }>;
};

function makeAction(input: {
  workspaceId: string;
  id: string;
  priority: PriorityLevel;
  impact: string;
  title: string;
  description: string;
  metricLabel: string;
  metricValue: string;
  supportingMetric?: string;
  ctaLabel: string;
  source: string;
  reason: string;
  href: string;
  businessRisk: number;
  revenueImpact: number;
  timeSensitivity: number;
  confidence: number;
  dueAt?: string | null;
}): PriorityAction {
  const priorityWeight = 5 - Math.min(priorityRank(input.priority), 4);
  const priorityScore =
    priorityWeight * 100 +
    input.businessRisk * 20 +
    input.revenueImpact * 12 +
    input.timeSensitivity * 8 +
    input.confidence * 5;

  return {
    id: input.id,
    priority: input.priority,
    priorityScore,
    title: input.title,
    impact: input.impact,
    description: input.description,
    metricLabel: input.metricLabel,
    metricValue: input.metricValue,
    supportingMetric: input.supportingMetric || `${input.metricValue} ${input.metricLabel}`.trim(),
    ctaLabel: input.ctaLabel.trim() || "Open",
    source: input.source,
    reason: input.reason,
    status: "open",
    href: input.href,
    createdAt: new Date().toISOString(),
    dueAt: input.dueAt || null,
    workspaceId: input.workspaceId,
  };
}

export function buildPriorityActions(input: PriorityActionInput): PriorityAction[] {
  const actions: PriorityAction[] = [];

  if (!input.onboardingComplete) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "complete-onboarding",
        priority: "critical",
        impact: "Unblocks core recommendations and automation safety checks.",
        title: "Complete onboarding",
        description: "Finish business setup so recommendations can use full brand context.",
        metricLabel: "Setup completion",
        metricValue: "Incomplete",
        ctaLabel: "Finish setup",
        source: "workspace",
        reason: "Workspace profile fields required for confidence scoring are incomplete.",
        href: "/onboarding",
        businessRisk: 5,
        revenueImpact: 3,
        timeSensitivity: 5,
        confidence: 5,
      }),
    );
  }

  if (!input.hasLogo) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "upload-brand-logo",
        priority: "high",
        impact: "Improves brand consistency across generated content.",
        title: "Upload brand logo",
        description: "Add a logo asset in Media Library for consistent brand creative.",
        metricLabel: "Logo assets",
        metricValue: "0",
        ctaLabel: "Open media library",
        source: "media_assets",
        reason: "No logo-tagged media assets found.",
        href: "/media",
        businessRisk: 3,
        revenueImpact: 2,
        timeSensitivity: 2,
        confidence: 4,
      }),
    );
  }

  if (!input.hasBrandVoice) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "add-brand-voice",
        priority: "high",
        impact: "Raises output quality and recommendation relevance.",
        title: "Add brand voice",
        description: "Brand voice is missing and reduces recommendation precision.",
        metricLabel: "Brand voice",
        metricValue: "Missing",
        ctaLabel: "Update setup",
        source: "workspaces",
        reason: "Brand foundation score indicates missing voice guidance.",
        href: "/onboarding",
        businessRisk: 3,
        revenueImpact: 2,
        timeSensitivity: 2,
        confidence: 4,
      }),
    );
  }

  if (input.missingIntegrations.length > 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "connect-missing-integrations",
        priority: "high",
        impact: "Increases confidence and unlocks analytics-informed recommendations.",
        title: "Connect missing integrations",
        description: `${input.missingIntegrations.length} integration source(s) are missing and limit analytics and revenue confidence.`,
        metricLabel: "Missing sources",
        metricValue: String(input.missingIntegrations.length),
        ctaLabel: "Connect integrations",
        source: "integrations",
        reason: `Missing: ${input.missingIntegrations.join(", ")}`,
        href: "/integrations",
        businessRisk: 4,
        revenueImpact: input.revenueAvailable ? 3 : 5,
        timeSensitivity: 3,
        confidence: 5,
      }),
    );
  }

  if (input.tiktokStatus === "reconnect_required") {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "reconnect-tiktok",
        priority: "critical",
        impact: "Restores publishing and sync reliability for TikTok workflows.",
        title: "Reconnect expired TikTok connection",
        description: "TikTok token refresh failed and publishing is blocked until reconnected.",
        metricLabel: "TikTok status",
        metricValue: "Reconnect required",
        ctaLabel: "Reconnect TikTok",
        source: "tiktok_connections",
        reason: "Connection status is reconnect_required.",
        href: "/settings/integrations/tiktok",
        businessRisk: 5,
        revenueImpact: 4,
        timeSensitivity: 5,
        confidence: 5,
      }),
    );
  }

  if (input.tiktokInboxPending > 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "finish-tiktok-inbox-post",
        priority: "medium",
        impact: "Converts completed uploads into published posts faster.",
        title: "Finish TikTok inbox post",
        description: `${input.tiktokInboxPending} upload job(s) are delivered to inbox and waiting for final publish in TikTok.`,
        metricLabel: "Inbox-delivered jobs",
        metricValue: String(input.tiktokInboxPending),
        ctaLabel: "Review TikTok jobs",
        source: "tiktok_publish_jobs",
        reason: "Jobs are waiting for manual final publish inside TikTok.",
        href: "/settings/integrations/tiktok",
        businessRisk: 2,
        revenueImpact: 3,
        timeSensitivity: 4,
        confidence: 4,
      }),
    );
  }

  if (input.failedTikTokJobs > 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "resolve-failed-tiktok-jobs",
        priority: "high",
        impact: "Prevents content delivery failures from reducing channel output.",
        title: "Resolve failed TikTok publish jobs",
        description: `${input.failedTikTokJobs} TikTok publish job(s) failed and need triage.`,
        metricLabel: "Failed TikTok jobs",
        metricValue: String(input.failedTikTokJobs),
        ctaLabel: "Inspect failed jobs",
        source: "tiktok_publish_jobs",
        reason: "Failed job records exist in the workspace.",
        href: "/settings/integrations/tiktok",
        businessRisk: 4,
        revenueImpact: 4,
        timeSensitivity: 4,
        confidence: 5,
      }),
    );
  }

  if (input.draftsAwaitingApproval > 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "approve-content-drafts",
        priority: "high",
        impact: "Moves blocked content into publish-ready pipeline.",
        title: "Approve content drafts",
        description: `${input.draftsAwaitingApproval} draft(s) need review or approval before scheduling.`,
        metricLabel: "Approval queue",
        metricValue: String(input.draftsAwaitingApproval),
        supportingMetric: `${input.draftsAwaitingApproval} draft${input.draftsAwaitingApproval === 1 ? "" : "s"} awaiting approval`,
        ctaLabel: "Open approval queue",
        source: "content_drafts",
        reason: "Drafts are pending approval.",
        href: "/media?tab=CONTENT_DRAFTS",
        businessRisk: 4,
        revenueImpact: 4,
        timeSensitivity: 4,
        confidence: 5,
      }),
    );
  }

  if (input.pendingScheduledPosts > 0 || input.failedScheduledPosts > 0) {
    const blockedScheduled = input.pendingScheduledPosts + input.failedScheduledPosts;
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "review-or-publish-scheduled-posts",
        priority: "high",
        impact: "Protects publishing cadence and prevents missed campaign windows.",
        title: "Review or publish scheduled posts",
        description: `${blockedScheduled} scheduled post(s) require review, publishing, or recovery.`,
        metricLabel: "Scheduled attention items",
        metricValue: String(blockedScheduled),
        supportingMetric: `${blockedScheduled} scheduled post${blockedScheduled === 1 ? "" : "s"} need attention`,
        ctaLabel: "Open calendar",
        source: "scheduled_posts",
        reason: "Pending approvals, publishing posts, or failed posts are present.",
        href: "/calendar?view=scheduled",
        businessRisk: 4,
        revenueImpact: 3,
        timeSensitivity: 5,
        confidence: 5,
      }),
    );
  }

  if (input.failedVideoRenders > 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "review-failed-video-renders",
        priority: "medium",
        impact: "Recovers blocked creative production.",
        title: "Review failed video renders",
        description: `${input.failedVideoRenders} video render request(s) failed recently.`,
        metricLabel: "Failed renders",
        metricValue: String(input.failedVideoRenders),
        ctaLabel: "Open studio",
        source: "ai_usage_events",
        reason: "AI usage event failures suggest render errors.",
        href: "/studio",
        businessRisk: 3,
        revenueImpact: 2,
        timeSensitivity: 3,
        confidence: 3,
      }),
    );
  }

  if (!input.amazonAdsConnected) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "connect-amazon-ads",
        priority: "medium",
        impact: "Adds paid media visibility for optimization decisions.",
        title: "Connect Amazon Ads",
        description: "Amazon Ads is not connected, reducing paid media recommendations.",
        metricLabel: "Amazon Ads",
        metricValue: "Not connected",
        ctaLabel: "Connect Amazon Ads",
        source: "amazon_ads",
        reason: "No Amazon Ads connection record available.",
        href: "/analytics/amazon-ads",
        businessRisk: 2,
        revenueImpact: 3,
        timeSensitivity: 2,
        confidence: 3,
      }),
    );
  }

  if (input.amazonAdsConnected && input.amazonRecommendationsReady) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "review-amazon-ppc-recommendations",
        priority: "medium",
        impact: "Turns paid media insights into execution changes.",
        title: "Review Amazon PPC recommendations",
        description: "Amazon PPC recommendations are ready for review.",
        metricLabel: "Amazon recommendations",
        metricValue: "Ready",
        ctaLabel: "Open insights",
        source: "amazon_ads_recommendations",
        reason: "Recommendation engine reports actionable PPC opportunities.",
        href: "/analytics/amazon-ads",
        businessRisk: 2,
        revenueImpact: 3,
        timeSensitivity: 2,
        confidence: 3,
      }),
    );
  }

  if (input.hasProductsTable && (input.productsCount || 0) <= 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "add-products",
        priority: "low",
        impact: "Improves product-specific recommendations.",
        title: "Add products",
        description: "Product catalog is empty and limits merchandising recommendations.",
        metricLabel: "Products",
        metricValue: "0",
        ctaLabel: "Open onboarding",
        source: "products",
        reason: "Products table exists but has no records.",
        href: "/onboarding",
        businessRisk: 1,
        revenueImpact: 2,
        timeSensitivity: 1,
        confidence: 3,
      }),
    );
  }

  if (input.mediaAssetsCount <= 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "add-media-assets",
        priority: "medium",
        impact: "Increases creative throughput and output quality.",
        title: "Add media assets",
        description: "Upload media assets to improve content quality and speed.",
        metricLabel: "Media assets",
        metricValue: "0",
        ctaLabel: "Open media library",
        source: "media_assets",
        reason: "No media assets are available in the workspace.",
        href: "/media",
        businessRisk: 3,
        revenueImpact: 2,
        timeSensitivity: 2,
        confidence: 5,
      }),
    );
  }

  if (input.activeCampaigns > 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "review-active-campaign-performance",
        priority: "medium",
        impact: "Keeps active budget and messaging aligned with outcomes.",
        title: "Review active campaign performance",
        description: `${input.activeCampaigns} active campaign(s) are running and should be reviewed against current performance signals.`,
        metricLabel: "Active campaigns",
        metricValue: String(input.activeCampaigns),
        ctaLabel: "Open campaigns",
        source: "campaigns",
        reason: "Active campaigns detected in workspace records.",
        href: "/marketing/campaigns",
        businessRisk: 3,
        revenueImpact: 4,
        timeSensitivity: 3,
        confidence: 4,
      }),
    );
  }

  if (input.approvedDrafts > 0 && input.upcomingScheduledPosts <= 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "schedule-approved-content",
        priority: "high",
        impact: "Converts ready content into upcoming pipeline volume.",
        title: "Schedule approved content",
        description: "Approved drafts are available but no upcoming posts are scheduled.",
        metricLabel: "Approved but unscheduled",
        metricValue: String(input.approvedDrafts),
        ctaLabel: "Schedule posts",
        source: "scheduled_posts",
        reason: "Approved content exists with zero upcoming scheduled posts.",
        href: "/calendar?view=scheduled",
        businessRisk: 4,
        revenueImpact: 4,
        timeSensitivity: 4,
        confidence: 5,
      }),
    );
  }

  if (input.approvedDrafts <= 0 && input.upcomingScheduledPosts <= 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "create-content-pipeline",
        priority: "high",
        impact: "Prevents pipeline gaps that can reduce channel consistency.",
        title: "Create content for your pipeline",
        description: "No approved or scheduled content exists for upcoming publishing windows.",
        metricLabel: "Ready content",
        metricValue: "0",
        ctaLabel: "Create content",
        source: "content_drafts",
        reason: "No approved drafts and no scheduled posts were found.",
        href: "/media?tab=CONTENT_DRAFTS",
        businessRisk: 4,
        revenueImpact: 4,
        timeSensitivity: 5,
        confidence: 5,
      }),
    );
  }

  if (input.integrationErrors > 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "resolve-integration-errors",
        priority: "high",
        impact: "Restores blocked workflows and improves data freshness.",
        title: "Resolve integration errors",
        description: "One or more integrations have errors that may block execution.",
        metricLabel: "Integration errors",
        metricValue: String(input.integrationErrors),
        ctaLabel: "Open integrations",
        source: "integrations",
        reason: "Integration state includes reconnect or error conditions.",
        href: "/integrations",
        businessRisk: 4,
        revenueImpact: 3,
        timeSensitivity: 4,
        confidence: 4,
      }),
    );
  }

  if (input.lowScoreCategories.length > 0) {
    const top = input.lowScoreCategories[0];
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: `review-low-score-${top.key}`,
        priority: "high",
        impact: "Targets score categories with the largest confidence and performance risk.",
        title: "Review low Marketing Score categories",
        description: `${top.label} is currently ${top.status.replaceAll("_", " ")}.`,
        metricLabel: "Low categories",
        metricValue: String(input.lowScoreCategories.length),
        ctaLabel: "Open score details",
        source: "marketing_score",
        reason: `Category ${top.label} is flagged as ${top.status}.`,
        href: "/analytics/marketing-score",
        businessRisk: 4,
        revenueImpact: 3,
        timeSensitivity: 3,
        confidence: 5,
      }),
    );
  }

  const deduped = new Map<string, PriorityAction>();
  for (const action of actions) {
    if (!deduped.has(action.id)) {
      deduped.set(action.id, action);
    }
  }

  return [...deduped.values()].sort((left, right) => {
    const scoreDelta = right.priorityScore - left.priorityScore;
    if (scoreDelta !== 0) return scoreDelta;
    const rankDelta = priorityRank(left.priority) - priorityRank(right.priority);
    if (rankDelta !== 0) return rankDelta;
    return left.title.localeCompare(right.title);
  }).slice(0, 5);
}
