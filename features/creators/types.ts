export const CREATOR_PIPELINE_STAGES = [
  "DISCOVERED",
  "AI_RECOMMENDED",
  "SAVED",
  "CONTACTED",
  "INTERESTED",
  "NEGOTIATING",
  "AGREEMENT_PENDING",
  "CAMPAIGN_ACTIVE",
  "CONTENT_PRODUCTION",
  "CONTENT_REVIEW",
  "PUBLISHED",
  "COMPLETED",
  "AMBASSADOR",
  "DECLINED",
  "ARCHIVED",
] as const;

export type CreatorPipelineStage = (typeof CREATOR_PIPELINE_STAGES)[number];

export type CreatorPlatform = {
  platform: string;
  handle: string;
  profileUrl: string;
  followers: number;
  averageViews: number;
  engagementRate: number;
  verified: boolean;
};

export type Creator = {
  id: string;
  workspaceId: string;
  displayName: string;
  handle: string;
  bio: string;
  profileImageUrl: string;
  location: string;
  niches: string[];
  platforms: CreatorPlatform[];
  followerCount: number;
  averageViews: number;
  engagementRate: number;
  audienceSummary: string;
  estimatedRateMin: number;
  estimatedRateMax: number;
  currency: string;
  brandSafetyStatus: "SAFE" | "REVIEW" | "RESTRICTED";
  availabilityStatus: "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
  matchScore: number;
  saved: boolean;
  source: "DEMO" | "MANUAL";
  createdAt: string;
  updatedAt: string;
};

export type CreatorPipelineRecord = {
  id: string;
  workspaceId: string;
  creatorId: string;
  stage: CreatorPipelineStage;
  assignedUserId: string | null;
  campaignId?: string | null;
  nextAction?: string | null;
  nextActionAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export const CREATOR_CAMPAIGN_STATUSES = [
  "DRAFT",
  "RECRUITING",
  "ACTIVE",
  "CONTENT_REVIEW",
  "SCHEDULED",
  "LIVE",
  "COMPLETED",
  "PAUSED",
  "CANCELLED",
] as const;

export type CreatorCampaignStatus = (typeof CREATOR_CAMPAIGN_STATUSES)[number];

export type CreatorCampaign = {
  id: string;
  workspaceId: string;
  name: string;
  goal: string;
  status: CreatorCampaignStatus;
  description: string;
  budget: number;
  currency: string;
  startDate: string;
  endDate: string;
  productIds: string[];
  creatorIds: string[];
  platforms: string[];
  deliverables: string[];
  approvalRequired: boolean;
  trackingMethod: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export const CREATOR_SUBMISSION_STATUSES = [
  "SUBMITTED",
  "IN_REVIEW",
  "REVISION_REQUESTED",
  "APPROVED",
  "REJECTED",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export type CreatorSubmissionStatus = (typeof CREATOR_SUBMISSION_STATUSES)[number];

export type CreatorSubmission = {
  id: string;
  workspaceId: string;
  creatorId: string;
  campaignId: string | null;
  status: CreatorSubmissionStatus;
  assetType: "IMAGE" | "VIDEO" | "CAPTION" | "STORY_CONCEPT" | "SCRIPT" | "THUMBNAIL";
  title: string;
  contentUrl: string | null;
  textBody: string | null;
  supportingNotes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatorUgcAsset = {
  id: string;
  workspaceId: string;
  creatorId: string;
  campaignId: string | null;
  productId: string | null;
  platform: string;
  assetType: string;
  title: string;
  tags: string[];
  usageRightsStart: string | null;
  usageRightsEnd: string | null;
  approvalStatus: "APPROVED" | "ARCHIVED";
  performanceMetrics: {
    reach?: number;
    impressions?: number;
    engagement?: number;
    clicks?: number;
    conversions?: number;
    revenue?: number;
  } | null;
  mediaLibraryAssetId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatorActivityEvent = {
  id: string;
  workspaceId: string;
  actorUserId: string | null;
  eventType: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type CreatorAnalyticsSnapshot = {
  id: string;
  workspaceId: string;
  periodStart: string;
  periodEnd: string;
  measured: {
    activeCampaigns: number;
    creatorsEngaged: number;
    contentSubmitted: number;
    contentApproved: number;
    publishedAssets: number;
    reach: number | null;
    impressions: number | null;
    engagement: number | null;
    clicks: number | null;
    conversions: number | null;
    revenue: number | null;
    campaignSpend: number | null;
    costPerEngagement: number | null;
    costPerAcquisition: number | null;
    creatorRoi: number | null;
  };
  estimated: {
    campaignSpend: number | null;
  };
  isDemo: boolean;
  createdAt: string;
};

export type CreatorRecommendation = {
  creatorId: string;
  matchScore: number;
  reasons: string[];
  concerns: string[];
  recommendedCampaignType: string;
  recommendedDeliverables: string[];
  recommendedOutreachAngle: string;
  confidence: number;
};

export type CreatorRecommendationInput = {
  brandProfile: string;
  industry: string;
  productsOrServices: string[];
  campaignGoal: string;
  targetAudience: string;
  location: string;
  connectedPlatforms: string[];
};

export type DemoDataBundle = {
  creators: Creator[];
  campaigns: CreatorCampaign[];
  pipeline: CreatorPipelineRecord[];
  submissions: CreatorSubmission[];
  ugcAssets: CreatorUgcAsset[];
  activity: CreatorActivityEvent[];
  analytics: CreatorAnalyticsSnapshot[];
};
