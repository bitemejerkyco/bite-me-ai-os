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
  integrationErrors: number;
  lowScoreCategories: Array<{ key: string; label: string; status: string }>;
};

function makeAction(input: {
  workspaceId: string;
  id: string;
  priority: PriorityLevel;
  title: string;
  description: string;
  source: string;
  href: string;
  dueAt?: string | null;
}): PriorityAction {
  return {
    id: input.id,
    priority: input.priority,
    title: input.title,
    description: input.description,
    source: input.source,
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
        title: "Complete onboarding",
        description: "Finish business setup so recommendations can use full brand context.",
        source: "workspace",
        href: "/onboarding",
      }),
    );
  }

  if (!input.hasLogo) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "upload-brand-logo",
        priority: "high",
        title: "Upload brand logo",
        description: "Add a logo asset in Media Library for consistent brand creative.",
        source: "media_assets",
        href: "/media",
      }),
    );
  }

  if (!input.hasBrandVoice) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "add-brand-voice",
        priority: "high",
        title: "Add brand voice",
        description: "Brand voice is missing and reduces recommendation precision.",
        source: "workspaces",
        href: "/onboarding",
      }),
    );
  }

  if (input.tiktokStatus === "disconnected") {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "connect-tiktok",
        priority: "high",
        title: "Connect TikTok",
        description: "Connect TikTok to unlock upload-to-draft guidance and analytics.",
        source: "tiktok_connections",
        href: "/settings/integrations/tiktok",
      }),
    );
  }

  if (input.tiktokStatus === "reconnect_required") {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "reconnect-tiktok",
        priority: "critical",
        title: "Reconnect expired TikTok connection",
        description: "TikTok token refresh failed and publishing is blocked until reconnected.",
        source: "tiktok_connections",
        href: "/settings/integrations/tiktok",
      }),
    );
  }

  if (input.tiktokInboxPending > 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "finish-tiktok-inbox-post",
        priority: "medium",
        title: "Finish TikTok inbox post",
        description: `${input.tiktokInboxPending} upload job(s) are delivered to inbox and waiting for final publish in TikTok.`,
        source: "tiktok_publish_jobs",
        href: "/settings/integrations/tiktok",
      }),
    );
  }

  if (input.draftsAwaitingApproval > 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "approve-content-drafts",
        priority: "high",
        title: "Approve content drafts",
        description: `${input.draftsAwaitingApproval} draft(s) need review or approval before scheduling.`,
        source: "content_drafts",
        href: "/content",
      }),
    );
  }

  if (input.failedScheduledPosts > 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "review-failed-scheduled-posts",
        priority: "high",
        title: "Review failed scheduled posts",
        description: `${input.failedScheduledPosts} scheduled post(s) failed and should be triaged.`,
        source: "scheduled_posts",
        href: "/calendar",
      }),
    );
  }

  if (input.failedVideoRenders > 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "review-failed-video-renders",
        priority: "medium",
        title: "Review failed video renders",
        description: `${input.failedVideoRenders} video render request(s) failed recently.`,
        source: "ai_usage_events",
        href: "/studio",
      }),
    );
  }

  if (!input.amazonAdsConnected) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "connect-amazon-ads",
        priority: "medium",
        title: "Connect Amazon Ads",
        description: "Amazon Ads is not connected, reducing paid media recommendations.",
        source: "amazon_ads",
        href: "/analytics/amazon-ads",
      }),
    );
  }

  if (input.amazonAdsConnected && input.amazonRecommendationsReady) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "review-amazon-ppc-recommendations",
        priority: "medium",
        title: "Review Amazon PPC recommendations",
        description: "Amazon PPC recommendations are ready for review.",
        source: "amazon_ads_recommendations",
        href: "/analytics/amazon-ads",
      }),
    );
  }

  if (input.hasProductsTable && (input.productsCount || 0) <= 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "add-products",
        priority: "low",
        title: "Add products",
        description: "Product catalog is empty and limits merchandising recommendations.",
        source: "products",
        href: "/onboarding",
      }),
    );
  }

  if (input.mediaAssetsCount <= 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "add-media-assets",
        priority: "medium",
        title: "Add media assets",
        description: "Upload media assets to improve content quality and speed.",
        source: "media_assets",
        href: "/media",
      }),
    );
  }

  if (input.approvedDrafts > 0 && input.upcomingScheduledPosts <= 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "schedule-approved-content",
        priority: "high",
        title: "Schedule approved content",
        description: "Approved drafts are available but no upcoming posts are scheduled.",
        source: "scheduled_posts",
        href: "/calendar",
      }),
    );
  }

  if (input.integrationErrors > 0) {
    actions.push(
      makeAction({
        workspaceId: input.workspaceId,
        id: "resolve-integration-errors",
        priority: "high",
        title: "Resolve integration errors",
        description: "One or more integrations have errors that may block execution.",
        source: "integrations",
        href: "/settings/integrations/tiktok",
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
        title: "Review low Marketing Score categories",
        description: `${top.label} is currently ${top.status.replaceAll("_", " ")}.`,
        source: "marketing_score",
        href: "/",
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
    const rankDelta = priorityRank(left.priority) - priorityRank(right.priority);
    if (rankDelta !== 0) return rankDelta;
    return left.title.localeCompare(right.title);
  });
}
