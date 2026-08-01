import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type DataCoverageHealth = "healthy" | "stale" | "limited" | "missing";

export type DataCoverageSourceKey =
  | "workspace_profile"
  | "brand_setup"
  | "products"
  | "media_library"
  | "content_library"
  | "calendar"
  | "tiktok"
  | "amazon_ads"
  | "email_provider"
  | "social_analytics"
  | "revenue_tracking"
  | "video_generation"
  | "ai_usage";

export type DataCoverageSource = {
  key: DataCoverageSourceKey;
  label: string;
  connected: boolean;
  configured: boolean;
  lastSyncedAt: string | null;
  recordCount: number | null;
  health: DataCoverageHealth;
  confidenceContribution: number;
  message: string;
};

export type DataCoverageModel = {
  workspaceId: string;
  sources: DataCoverageSource[];
  overallConfidence: number;
  warning: string | null;
  generatedAt: string;
};

export type DataCoverageInput = {
  workspaceId: string;
  workspaceProfileComplete: boolean;
  hasProductsTable: boolean;
  productsCount: number | null;
  mediaCount: number;
  contentDraftCount: number;
  scheduledPostsCount: number;
  tiktokConnected: boolean;
  tiktokLastSyncedAt: string | null;
  amazonAdsConnected: boolean;
  amazonAdsMessage: string;
  emailConnected: boolean;
  emailMessage: string;
  performanceSnapshotCount: number;
  performanceLastRecordedAt: string | null;
  revenueRecordsCount: number;
  aiUsageCount: number;
  aiUsageLastAt: string | null;
  videoTransactionsCount: number;
  videoTransactionsLastAt: string | null;
};

function stale(lastSyncedAt: string | null, days: number): boolean {
  if (!lastSyncedAt) return true;
  return Date.now() - new Date(lastSyncedAt).getTime() > days * 24 * 60 * 60 * 1000;
}

function source(input: Omit<DataCoverageSource, "confidenceContribution">): DataCoverageSource {
  const confidenceContribution =
    input.health === "healthy"
      ? 1
      : input.health === "limited"
        ? 0.6
        : input.health === "stale"
          ? 0.35
          : 0;
  return { ...input, confidenceContribution };
}

export function buildDataCoverageModel(input: DataCoverageInput): DataCoverageModel {
  const workspaceProfile: DataCoverageSource = source({
    key: "workspace_profile",
    label: "Workspace profile",
    connected: true,
    configured: input.workspaceProfileComplete,
    lastSyncedAt: null,
    recordCount: 1,
    health: input.workspaceProfileComplete ? "healthy" : "limited",
    message: input.workspaceProfileComplete
      ? "Workspace profile is configured."
      : "Workspace profile is incomplete.",
  });

  const brandSetup: DataCoverageSource = source({
    key: "brand_setup",
    label: "Brand setup",
    connected: true,
    configured: input.workspaceProfileComplete,
    lastSyncedAt: null,
    recordCount: input.workspaceProfileComplete ? 1 : 0,
    health: input.workspaceProfileComplete ? "healthy" : "limited",
    message: input.workspaceProfileComplete
      ? "Brand setup is complete."
      : "Finish brand setup to improve recommendation quality.",
  });

  const productsSource: DataCoverageSource = source({
    key: "products",
    label: "Products",
    connected: input.hasProductsTable,
    configured: input.hasProductsTable,
    lastSyncedAt: null,
    recordCount: input.productsCount,
    health: input.hasProductsTable ? "limited" : "missing",
    message: input.hasProductsTable
      ? "Product catalog integration is available but sparse."
      : "Product catalog table is not available in this environment.",
  });

  const mediaSource: DataCoverageSource = source({
    key: "media_library",
    label: "Media Library",
    connected: true,
    configured: input.mediaCount > 0,
    lastSyncedAt: null,
    recordCount: input.mediaCount,
    health: input.mediaCount > 0 ? "healthy" : "limited",
    message: input.mediaCount > 0
      ? "Media assets are available."
      : "Add media assets to improve content and campaign recommendations.",
  });

  const contentSource: DataCoverageSource = source({
    key: "content_library",
    label: "Content Library",
    connected: true,
    configured: input.contentDraftCount > 0,
    lastSyncedAt: null,
    recordCount: input.contentDraftCount,
    health: input.contentDraftCount > 0 ? "healthy" : "limited",
    message: input.contentDraftCount > 0
      ? "Content drafts are available."
      : "No content drafts are available yet.",
  });

  const calendarSource: DataCoverageSource = source({
    key: "calendar",
    label: "Calendar",
    connected: true,
    configured: input.scheduledPostsCount > 0,
    lastSyncedAt: null,
    recordCount: input.scheduledPostsCount,
    health: input.scheduledPostsCount > 0 ? "healthy" : "limited",
    message: input.scheduledPostsCount > 0
      ? "Scheduled posts are available."
      : "No scheduled posts found.",
  });

  const tiktokSource: DataCoverageSource = source({
    key: "tiktok",
    label: "TikTok",
    connected: input.tiktokConnected,
    configured: input.tiktokConnected,
    lastSyncedAt: input.tiktokLastSyncedAt,
    recordCount: input.tiktokConnected ? 1 : 0,
    health: input.tiktokConnected
      ? stale(input.tiktokLastSyncedAt, 14)
        ? "stale"
        : "healthy"
      : "limited",
    message: input.tiktokConnected
      ? "TikTok is connected."
      : "Connect TikTok to improve organic social recommendations.",
  });

  const amazonAdsSource: DataCoverageSource = source({
    key: "amazon_ads",
    label: "Amazon Ads",
    connected: input.amazonAdsConnected,
    configured: input.amazonAdsConnected,
    lastSyncedAt: null,
    recordCount: input.amazonAdsConnected ? 1 : 0,
    health: input.amazonAdsConnected ? "healthy" : "limited",
    message: input.amazonAdsMessage,
  });

  const emailSource: DataCoverageSource = source({
    key: "email_provider",
    label: "Email provider",
    connected: input.emailConnected,
    configured: input.emailConnected,
    lastSyncedAt: null,
    recordCount: input.emailConnected ? 1 : 0,
    health: input.emailConnected ? "healthy" : "missing",
    message: input.emailMessage,
  });

  const socialAnalyticsSource: DataCoverageSource = source({
    key: "social_analytics",
    label: "Social analytics",
    connected: input.performanceSnapshotCount > 0,
    configured: input.performanceSnapshotCount > 0,
    lastSyncedAt: input.performanceLastRecordedAt,
    recordCount: input.performanceSnapshotCount,
    health: input.performanceSnapshotCount <= 0
      ? "missing"
      : stale(input.performanceLastRecordedAt, 14)
        ? "stale"
        : "healthy",
    message: input.performanceSnapshotCount > 0
      ? "Performance snapshots are available."
      : "No social performance snapshots found.",
  });

  const revenueSource: DataCoverageSource = source({
    key: "revenue_tracking",
    label: "Revenue tracking",
    connected: input.revenueRecordsCount > 0,
    configured: input.revenueRecordsCount > 0,
    lastSyncedAt: input.performanceLastRecordedAt,
    recordCount: input.revenueRecordsCount,
    health: input.revenueRecordsCount > 0 ? "healthy" : "missing",
    message: input.revenueRecordsCount > 0
      ? "Connected revenue records are available."
      : "Insufficient connected revenue data.",
  });

  const videoGenerationSource: DataCoverageSource = source({
    key: "video_generation",
    label: "Video generation",
    connected: input.videoTransactionsCount > 0,
    configured: input.videoTransactionsCount > 0,
    lastSyncedAt: input.videoTransactionsLastAt,
    recordCount: input.videoTransactionsCount,
    health: input.videoTransactionsCount > 0 ? "healthy" : "limited",
    message: input.videoTransactionsCount > 0
      ? "Video generation history is available."
      : "No video generation history found.",
  });

  const aiUsageSource: DataCoverageSource = source({
    key: "ai_usage",
    label: "AI usage",
    connected: input.aiUsageCount > 0,
    configured: input.aiUsageCount > 0,
    lastSyncedAt: input.aiUsageLastAt,
    recordCount: input.aiUsageCount,
    health: input.aiUsageCount > 0 ? "healthy" : "limited",
    message: input.aiUsageCount > 0
      ? "AI usage records are available."
      : "AI usage records are limited.",
  });

  const sources = [
    workspaceProfile,
    brandSetup,
    productsSource,
    mediaSource,
    contentSource,
    calendarSource,
    tiktokSource,
    amazonAdsSource,
    emailSource,
    socialAnalyticsSource,
    revenueSource,
    videoGenerationSource,
    aiUsageSource,
  ];

  const overallConfidence = Number(
    (
      sources.reduce((sum, current) => sum + current.confidenceContribution, 0) /
      sources.length
    ).toFixed(2),
  );

  const missingCritical = sources
    .filter((item) =>
      ["tiktok", "amazon_ads", "social_analytics", "revenue_tracking"].includes(item.key),
    )
    .filter((item) => item.health === "missing" || item.health === "limited");

  const warning = missingCritical.length
    ? "PostMotive has limited performance data. Connect TikTok Analytics and Amazon Ads to improve recommendations."
    : null;

  return {
    workspaceId: input.workspaceId,
    sources,
    overallConfidence,
    warning,
    generatedAt: new Date().toISOString(),
  };
}

export async function detectProductsTable(): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("products").select("id", { count: "exact", head: true }).limit(1);
  return !error;
}
