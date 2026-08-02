import type {
  Creator,
  CreatorActivityEvent,
  CreatorAnalyticsSnapshot,
  CreatorCampaign,
  CreatorPipelineRecord,
  CreatorSubmission,
  CreatorUgcAsset,
  DemoDataBundle,
} from "@/features/creators/types";

const NOW = "2026-08-01T10:00:00.000Z";

type SeedCreatorInput = {
  id: string;
  displayName: string;
  handle: string;
  location: string;
  niches: string[];
  platform: string;
  followers: number;
  avgViews: number;
  engagementRate: number;
  minRate: number;
  maxRate: number;
  availability: "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
  safety: "SAFE" | "REVIEW" | "RESTRICTED";
  matchScore: number;
};

function mkCreator(workspaceId: string, input: SeedCreatorInput): Creator {
  return {
    id: input.id,
    workspaceId,
    displayName: input.displayName,
    handle: input.handle,
    bio: `${input.displayName} creates ${input.niches.join(", ")} content for brand-safe audience growth.`,
    profileImageUrl: `/postmotive-mark.png`,
    location: input.location,
    niches: input.niches,
    platforms: [
      {
        platform: input.platform,
        handle: input.handle,
        profileUrl: `https://example.com/${input.handle.replace(/^@/u, "")}`,
        followers: input.followers,
        averageViews: input.avgViews,
        engagementRate: input.engagementRate,
        verified: input.followers > 180000,
      },
    ],
    followerCount: input.followers,
    averageViews: input.avgViews,
    engagementRate: input.engagementRate,
    audienceSummary: `${Math.round(input.engagementRate * 100)}% engagement in ${input.location} with ${input.niches[0]} audience overlap.`,
    estimatedRateMin: input.minRate,
    estimatedRateMax: input.maxRate,
    currency: "USD",
    brandSafetyStatus: input.safety,
    availabilityStatus: input.availability,
    matchScore: input.matchScore,
    saved: false,
    source: "DEMO",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const CREATOR_SEED: SeedCreatorInput[] = [
  { id: "cr_001", displayName: "Maya Food Lab", handle: "@mayafoodlab", location: "Austin, TX", niches: ["Food", "Beverage"], platform: "Instagram", followers: 42000, avgViews: 22000, engagementRate: 0.064, minRate: 350, maxRate: 700, availability: "AVAILABLE", safety: "SAFE", matchScore: 92 },
  { id: "cr_002", displayName: "Trail Fuel Josh", handle: "@trailfueljosh", location: "Boulder, CO", niches: ["Outdoors", "Fitness"], platform: "TikTok", followers: 155000, avgViews: 74000, engagementRate: 0.052, minRate: 1200, maxRate: 2500, availability: "LIMITED", safety: "SAFE", matchScore: 87 },
  { id: "cr_003", displayName: "Glow Routine Co", handle: "@glowroutineco", location: "Los Angeles, CA", niches: ["Beauty", "Lifestyle"], platform: "Instagram", followers: 98000, avgViews: 36000, engagementRate: 0.048, minRate: 900, maxRate: 1700, availability: "AVAILABLE", safety: "SAFE", matchScore: 81 },
  { id: "cr_004", displayName: "Garage Rev Mike", handle: "@garagerevmike", location: "Phoenix, AZ", niches: ["Automotive", "Technology"], platform: "YouTube", followers: 210000, avgViews: 86000, engagementRate: 0.039, minRate: 1700, maxRate: 3200, availability: "LIMITED", safety: "REVIEW", matchScore: 74 },
  { id: "cr_005", displayName: "ScaleOps Sarah", handle: "@scaleopssarah", location: "Seattle, WA", niches: ["Business", "Technology"], platform: "LinkedIn", followers: 31000, avgViews: 14000, engagementRate: 0.071, minRate: 400, maxRate: 900, availability: "AVAILABLE", safety: "SAFE", matchScore: 79 },
  { id: "cr_006", displayName: "City Bites Crew", handle: "@citybitescrew", location: "Chicago, IL", niches: ["Food", "Lifestyle"], platform: "TikTok", followers: 84000, avgViews: 42000, engagementRate: 0.062, minRate: 700, maxRate: 1500, availability: "AVAILABLE", safety: "SAFE", matchScore: 90 },
  { id: "cr_007", displayName: "HomeGym Devin", handle: "@homegymdevin", location: "Denver, CO", niches: ["Fitness", "Technology"], platform: "YouTube", followers: 126000, avgViews: 51000, engagementRate: 0.055, minRate: 1000, maxRate: 2100, availability: "LIMITED", safety: "SAFE", matchScore: 85 },
  { id: "cr_008", displayName: "Weekend Wheels", handle: "@weekendwheels", location: "Detroit, MI", niches: ["Automotive", "Lifestyle"], platform: "Instagram", followers: 67000, avgViews: 25000, engagementRate: 0.044, minRate: 650, maxRate: 1200, availability: "AVAILABLE", safety: "REVIEW", matchScore: 70 },
  { id: "cr_009", displayName: "CFO Quick Tips", handle: "@cfoquicktips", location: "New York, NY", niches: ["Business"], platform: "LinkedIn", followers: 54000, avgViews: 19000, engagementRate: 0.058, minRate: 800, maxRate: 1600, availability: "AVAILABLE", safety: "SAFE", matchScore: 76 },
  { id: "cr_010", displayName: "Beauty Local Lena", handle: "@beautylocallena", location: "San Diego, CA", niches: ["Beauty", "Local creators"], platform: "TikTok", followers: 29000, avgViews: 13000, engagementRate: 0.083, minRate: 250, maxRate: 600, availability: "AVAILABLE", safety: "SAFE", matchScore: 88 },
  { id: "cr_011", displayName: "Micro Meal Prep", handle: "@micromealprep", location: "Nashville, TN", niches: ["Food", "Fitness", "Micro creators"], platform: "Instagram", followers: 18000, avgViews: 9000, engagementRate: 0.095, minRate: 180, maxRate: 420, availability: "AVAILABLE", safety: "SAFE", matchScore: 91 },
  { id: "cr_012", displayName: "MidTier Tech Mom", handle: "@midtiertechmom", location: "Portland, OR", niches: ["Technology", "Lifestyle", "Mid-tier creators"], platform: "YouTube", followers: 240000, avgViews: 102000, engagementRate: 0.037, minRate: 2200, maxRate: 3800, availability: "LIMITED", safety: "SAFE", matchScore: 82 },
  { id: "cr_013", displayName: "Urban Runner Kai", handle: "@urbanrunnerkai", location: "Atlanta, GA", niches: ["Fitness", "Outdoors"], platform: "TikTok", followers: 73000, avgViews: 31000, engagementRate: 0.061, minRate: 700, maxRate: 1400, availability: "AVAILABLE", safety: "SAFE", matchScore: 86 },
  { id: "cr_014", displayName: "Family Road Labs", handle: "@familyroadlabs", location: "Boise, ID", niches: ["Outdoors", "Automotive", "Lifestyle"], platform: "Instagram", followers: 112000, avgViews: 44000, engagementRate: 0.046, minRate: 1000, maxRate: 2000, availability: "LIMITED", safety: "SAFE", matchScore: 80 },
  { id: "cr_015", displayName: "Brew Science Mia", handle: "@brewsciencemia", location: "Milwaukee, WI", niches: ["Beverage", "Technology"], platform: "YouTube", followers: 51000, avgViews: 21000, engagementRate: 0.054, minRate: 550, maxRate: 1300, availability: "AVAILABLE", safety: "SAFE", matchScore: 83 },
  { id: "cr_016", displayName: "Local Lift Club", handle: "@localliftclub", location: "Raleigh, NC", niches: ["Fitness", "Local creators"], platform: "Instagram", followers: 24000, avgViews: 10200, engagementRate: 0.088, minRate: 220, maxRate: 520, availability: "AVAILABLE", safety: "SAFE", matchScore: 89 },
  { id: "cr_017", displayName: "Founders Field Notes", handle: "@foundersfieldnotes", location: "Miami, FL", niches: ["Business", "Lifestyle"], platform: "LinkedIn", followers: 47000, avgViews: 17600, engagementRate: 0.049, minRate: 600, maxRate: 1250, availability: "AVAILABLE", safety: "SAFE", matchScore: 77 },
  { id: "cr_018", displayName: "Auto Care Annie", handle: "@autocareannie", location: "Dallas, TX", niches: ["Automotive", "Beauty"], platform: "TikTok", followers: 132000, avgViews: 65000, engagementRate: 0.041, minRate: 1300, maxRate: 2400, availability: "LIMITED", safety: "REVIEW", matchScore: 69 },
  { id: "cr_019", displayName: "Kitchen Sprint", handle: "@kitchensprint", location: "San Jose, CA", niches: ["Food", "Technology"], platform: "YouTube", followers: 88000, avgViews: 35000, engagementRate: 0.057, minRate: 900, maxRate: 1600, availability: "AVAILABLE", safety: "SAFE", matchScore: 84 },
  { id: "cr_020", displayName: "Mindful Move Jen", handle: "@mindfulmovejen", location: "Salt Lake City, UT", niches: ["Fitness", "Lifestyle"], platform: "Instagram", followers: 61000, avgViews: 26000, engagementRate: 0.067, minRate: 650, maxRate: 1400, availability: "AVAILABLE", safety: "SAFE", matchScore: 88 },
  { id: "cr_021", displayName: "Outdoor Grid Nate", handle: "@outdoorgridnate", location: "Bend, OR", niches: ["Outdoors", "Technology"], platform: "YouTube", followers: 94000, avgViews: 39000, engagementRate: 0.045, minRate: 950, maxRate: 1900, availability: "LIMITED", safety: "SAFE", matchScore: 78 },
  { id: "cr_022", displayName: "Beauty Bench Rae", handle: "@beautybenchrae", location: "Orlando, FL", niches: ["Beauty"], platform: "TikTok", followers: 117000, avgViews: 53000, engagementRate: 0.059, minRate: 1100, maxRate: 2100, availability: "AVAILABLE", safety: "SAFE", matchScore: 83 },
  { id: "cr_023", displayName: "Cafe Tech Weekly", handle: "@cafetechweekly", location: "Minneapolis, MN", niches: ["Beverage", "Business", "Technology"], platform: "LinkedIn", followers: 27000, avgViews: 11800, engagementRate: 0.064, minRate: 320, maxRate: 760, availability: "AVAILABLE", safety: "SAFE", matchScore: 81 },
  { id: "cr_024", displayName: "Motor Habit", handle: "@motorhabit", location: "Tampa, FL", niches: ["Automotive", "Outdoors"], platform: "Instagram", followers: 79000, avgViews: 30000, engagementRate: 0.042, minRate: 800, maxRate: 1500, availability: "LIMITED", safety: "RESTRICTED", matchScore: 63 },
  { id: "cr_025", displayName: "Local Spark Toni", handle: "@localsparktoni", location: "Kansas City, MO", niches: ["Lifestyle", "Local creators", "Micro creators"], platform: "TikTok", followers: 16000, avgViews: 8700, engagementRate: 0.099, minRate: 150, maxRate: 360, availability: "AVAILABLE", safety: "SAFE", matchScore: 90 },
];

export function buildCreatorDemoData(workspaceId: string, userId: string): DemoDataBundle {
  const creators = CREATOR_SEED.map((item, index) => ({
    ...mkCreator(workspaceId, item),
    saved: index % 3 === 0,
  }));

  const campaigns: CreatorCampaign[] = [
    {
      id: "cc_001",
      workspaceId,
      name: "Jerky Summer Trail Challenge",
      goal: "Drive product trial with creator-led adventure content",
      status: "ACTIVE",
      description: "Creator short-form series featuring trail-ready snack moments.",
      budget: 18000,
      currency: "USD",
      startDate: "2026-07-20",
      endDate: "2026-09-10",
      productIds: ["prod_trail_pack"],
      creatorIds: ["cr_002", "cr_013", "cr_021"],
      platforms: ["TikTok", "Instagram", "YouTube"],
      deliverables: ["3 Reels", "4 TikTok videos", "1 YouTube recap"],
      approvalRequired: true,
      trackingMethod: "UTM_LINK_PLACEHOLDER",
      createdBy: userId,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: "cc_002",
      workspaceId,
      name: "Fuel Your Workday",
      goal: "Increase B2B snack box awareness",
      status: "RECRUITING",
      description: "Business creator series around desk-friendly snack swaps.",
      budget: 9500,
      currency: "USD",
      startDate: "2026-08-10",
      endDate: "2026-09-20",
      productIds: ["prod_office_box"],
      creatorIds: ["cr_005", "cr_009", "cr_017"],
      platforms: ["LinkedIn", "Instagram"],
      deliverables: ["2 LinkedIn posts", "3 short videos"],
      approvalRequired: true,
      trackingMethod: "PROMO_CODE_PLACEHOLDER",
      createdBy: userId,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: "cc_003",
      workspaceId,
      name: "Local Retail Weekend",
      goal: "Increase foot traffic for local partner stores",
      status: "CONTENT_REVIEW",
      description: "Local creator UGC highlighting in-store discovery moments.",
      budget: 6000,
      currency: "USD",
      startDate: "2026-07-29",
      endDate: "2026-08-22",
      productIds: ["prod_sampler"],
      creatorIds: ["cr_010", "cr_016", "cr_025"],
      platforms: ["TikTok", "Instagram"],
      deliverables: ["6 local short videos"],
      approvalRequired: true,
      trackingMethod: "STORE_CODE_PLACEHOLDER",
      createdBy: userId,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: "cc_004",
      workspaceId,
      name: "Protein Focus Month",
      goal: "Expand fitness vertical awareness",
      status: "DRAFT",
      description: "Fitness-focused creator campaign with recipe and workout pairings.",
      budget: 12000,
      currency: "USD",
      startDate: "2026-09-01",
      endDate: "2026-10-05",
      productIds: ["prod_protein"],
      creatorIds: ["cr_007", "cr_011", "cr_020"],
      platforms: ["Instagram", "YouTube", "TikTok"],
      deliverables: ["4 recipe videos", "2 routines", "5 short clips"],
      approvalRequired: true,
      trackingMethod: "LANDING_LINK_PLACEHOLDER",
      createdBy: userId,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: "cc_005",
      workspaceId,
      name: "Flavor Drop Tech Launch",
      goal: "Promote new product drop to tech-forward audience",
      status: "SCHEDULED",
      description: "Technology and lifestyle creators preview upcoming flavor release.",
      budget: 14000,
      currency: "USD",
      startDate: "2026-08-05",
      endDate: "2026-09-01",
      productIds: ["prod_flavor_drop"],
      creatorIds: ["cr_012", "cr_019", "cr_023"],
      platforms: ["YouTube", "LinkedIn", "Instagram"],
      deliverables: ["3 preview videos", "2 thought-leadership posts"],
      approvalRequired: true,
      trackingMethod: "TRACKING_CODE_PLACEHOLDER",
      createdBy: userId,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];

  const pipeline: CreatorPipelineRecord[] = [
    { id: "cp_001", workspaceId, creatorId: "cr_001", stage: "SAVED", assignedUserId: userId, campaignId: null, nextAction: "Send intro brief", nextActionAt: "2026-08-02T16:00:00.000Z", notes: "Strong beverage overlap.", createdAt: NOW, updatedAt: NOW },
    { id: "cp_002", workspaceId, creatorId: "cr_002", stage: "NEGOTIATING", assignedUserId: userId, campaignId: "cc_001", nextAction: "Counter deliverable package", nextActionAt: "2026-08-03T18:00:00.000Z", notes: "Requested 2x fee for exclusivity.", createdAt: NOW, updatedAt: NOW },
    { id: "cp_003", workspaceId, creatorId: "cr_003", stage: "AI_RECOMMENDED", assignedUserId: userId, campaignId: null, nextAction: "Review brand safety note", nextActionAt: "2026-08-04T18:00:00.000Z", notes: null, createdAt: NOW, updatedAt: NOW },
    { id: "cp_004", workspaceId, creatorId: "cr_005", stage: "CONTACTED", assignedUserId: userId, campaignId: "cc_002", nextAction: "Follow up with audience deck", nextActionAt: "2026-08-02T14:30:00.000Z", notes: null, createdAt: NOW, updatedAt: NOW },
    { id: "cp_005", workspaceId, creatorId: "cr_006", stage: "INTERESTED", assignedUserId: userId, campaignId: "cc_003", nextAction: "Share legal terms", nextActionAt: "2026-08-03T12:00:00.000Z", notes: null, createdAt: NOW, updatedAt: NOW },
    { id: "cp_006", workspaceId, creatorId: "cr_007", stage: "DISCOVERED", assignedUserId: userId, campaignId: null, nextAction: "Assess product fit", nextActionAt: "2026-08-05T11:00:00.000Z", notes: null, createdAt: NOW, updatedAt: NOW },
    { id: "cp_007", workspaceId, creatorId: "cr_010", stage: "CONTENT_REVIEW", assignedUserId: userId, campaignId: "cc_003", nextAction: "Approve revision", nextActionAt: "2026-08-01T22:00:00.000Z", notes: null, createdAt: NOW, updatedAt: NOW },
    { id: "cp_008", workspaceId, creatorId: "cr_011", stage: "CAMPAIGN_ACTIVE", assignedUserId: userId, campaignId: "cc_004", nextAction: "Review week-1 metrics", nextActionAt: "2026-08-07T16:00:00.000Z", notes: null, createdAt: NOW, updatedAt: NOW },
    { id: "cp_009", workspaceId, creatorId: "cr_012", stage: "AGREEMENT_PENDING", assignedUserId: userId, campaignId: "cc_005", nextAction: "Confirm usage rights", nextActionAt: "2026-08-02T19:00:00.000Z", notes: null, createdAt: NOW, updatedAt: NOW },
    { id: "cp_010", workspaceId, creatorId: "cr_013", stage: "CAMPAIGN_ACTIVE", assignedUserId: userId, campaignId: "cc_001", nextAction: "Check first post draft", nextActionAt: "2026-08-03T15:00:00.000Z", notes: null, createdAt: NOW, updatedAt: NOW },
    { id: "cp_011", workspaceId, creatorId: "cr_016", stage: "PUBLISHED", assignedUserId: userId, campaignId: "cc_003", nextAction: "Evaluate local store lift", nextActionAt: "2026-08-08T14:00:00.000Z", notes: null, createdAt: NOW, updatedAt: NOW },
    { id: "cp_012", workspaceId, creatorId: "cr_020", stage: "CONTENT_PRODUCTION", assignedUserId: userId, campaignId: "cc_004", nextAction: "Collect raw footage", nextActionAt: "2026-08-02T17:30:00.000Z", notes: null, createdAt: NOW, updatedAt: NOW },
    { id: "cp_013", workspaceId, creatorId: "cr_021", stage: "SAVED", assignedUserId: userId, campaignId: null, nextAction: "Invite to trail challenge", nextActionAt: "2026-08-05T17:30:00.000Z", notes: null, createdAt: NOW, updatedAt: NOW },
    { id: "cp_014", workspaceId, creatorId: "cr_023", stage: "COMPLETED", assignedUserId: userId, campaignId: "cc_005", nextAction: "Plan ambassador proposal", nextActionAt: "2026-08-11T17:30:00.000Z", notes: null, createdAt: NOW, updatedAt: NOW },
    { id: "cp_015", workspaceId, creatorId: "cr_024", stage: "DECLINED", assignedUserId: userId, campaignId: null, nextAction: null, nextActionAt: null, notes: "Safety restricted for current brand guidelines.", createdAt: NOW, updatedAt: NOW },
  ];

  const submissions: CreatorSubmission[] = [
    { id: "cs_001", workspaceId, creatorId: "cr_013", campaignId: "cc_001", status: "SUBMITTED", assetType: "VIDEO", title: "Trail snack opener", contentUrl: "https://example.com/demo/cs_001.mp4", textBody: null, supportingNotes: "Demo workspace data", submittedAt: NOW, reviewedAt: null, reviewedBy: null, createdAt: NOW, updatedAt: NOW },
    { id: "cs_002", workspaceId, creatorId: "cr_002", campaignId: "cc_001", status: "IN_REVIEW", assetType: "SCRIPT", title: "Day hike script", contentUrl: null, textBody: "Script draft for TikTok post", supportingNotes: "Demo workspace data", submittedAt: NOW, reviewedAt: null, reviewedBy: null, createdAt: NOW, updatedAt: NOW },
    { id: "cs_003", workspaceId, creatorId: "cr_010", campaignId: "cc_003", status: "REVISION_REQUESTED", assetType: "THUMBNAIL", title: "Local promo thumbnail", contentUrl: "https://example.com/demo/cs_003.jpg", textBody: null, supportingNotes: "Need product logo placement", submittedAt: NOW, reviewedAt: NOW, reviewedBy: userId, createdAt: NOW, updatedAt: NOW },
    { id: "cs_004", workspaceId, creatorId: "cr_016", campaignId: "cc_003", status: "APPROVED", assetType: "VIDEO", title: "Weekend store visit", contentUrl: "https://example.com/demo/cs_004.mp4", textBody: null, supportingNotes: "Approved as demo", submittedAt: NOW, reviewedAt: NOW, reviewedBy: userId, createdAt: NOW, updatedAt: NOW },
    { id: "cs_005", workspaceId, creatorId: "cr_011", campaignId: "cc_004", status: "SCHEDULED", assetType: "CAPTION", title: "Protein prep caption", contentUrl: null, textBody: "Caption for recipe post", supportingNotes: "Demo workspace data", submittedAt: NOW, reviewedAt: NOW, reviewedBy: userId, createdAt: NOW, updatedAt: NOW },
    { id: "cs_006", workspaceId, creatorId: "cr_006", campaignId: "cc_003", status: "PUBLISHED", assetType: "VIDEO", title: "City bites collab", contentUrl: "https://example.com/demo/cs_006.mp4", textBody: null, supportingNotes: "Demo workspace data", submittedAt: NOW, reviewedAt: NOW, reviewedBy: userId, createdAt: NOW, updatedAt: NOW },
    { id: "cs_007", workspaceId, creatorId: "cr_005", campaignId: "cc_002", status: "SUBMITTED", assetType: "STORY_CONCEPT", title: "Desk snack stories", contentUrl: null, textBody: "LinkedIn story concept", supportingNotes: "Demo workspace data", submittedAt: NOW, reviewedAt: null, reviewedBy: null, createdAt: NOW, updatedAt: NOW },
    { id: "cs_008", workspaceId, creatorId: "cr_019", campaignId: "cc_005", status: "IN_REVIEW", assetType: "IMAGE", title: "Flavor drop teaser", contentUrl: "https://example.com/demo/cs_008.jpg", textBody: null, supportingNotes: "Demo workspace data", submittedAt: NOW, reviewedAt: null, reviewedBy: null, createdAt: NOW, updatedAt: NOW },
    { id: "cs_009", workspaceId, creatorId: "cr_020", campaignId: "cc_004", status: "APPROVED", assetType: "VIDEO", title: "Mindful fuel walkthrough", contentUrl: "https://example.com/demo/cs_009.mp4", textBody: null, supportingNotes: "Demo workspace data", submittedAt: NOW, reviewedAt: NOW, reviewedBy: userId, createdAt: NOW, updatedAt: NOW },
    { id: "cs_010", workspaceId, creatorId: "cr_023", campaignId: "cc_005", status: "APPROVED", assetType: "CAPTION", title: "Founder post draft", contentUrl: null, textBody: "Founders-facing release notes style post.", supportingNotes: "Demo workspace data", submittedAt: NOW, reviewedAt: NOW, reviewedBy: userId, createdAt: NOW, updatedAt: NOW },
    { id: "cs_011", workspaceId, creatorId: "cr_025", campaignId: "cc_003", status: "REJECTED", assetType: "THUMBNAIL", title: "Local splash card", contentUrl: "https://example.com/demo/cs_011.jpg", textBody: null, supportingNotes: "Brand mismatch for campaign style.", submittedAt: NOW, reviewedAt: NOW, reviewedBy: userId, createdAt: NOW, updatedAt: NOW },
    { id: "cs_012", workspaceId, creatorId: "cr_001", campaignId: "cc_001", status: "ARCHIVED", assetType: "IMAGE", title: "Archived prep shot", contentUrl: "https://example.com/demo/cs_012.jpg", textBody: null, supportingNotes: "Archived demo sample", submittedAt: NOW, reviewedAt: NOW, reviewedBy: userId, createdAt: NOW, updatedAt: NOW },
  ];

  const ugcAssets: CreatorUgcAsset[] = Array.from({ length: 20 }).map((_, idx) => ({
    id: `cu_${String(idx + 1).padStart(3, "0")}`,
    workspaceId,
    creatorId: creators[idx % creators.length]?.id || "cr_001",
    campaignId: campaigns[idx % campaigns.length]?.id || null,
    productId: idx % 2 === 0 ? "prod_trail_pack" : "prod_sampler",
    platform: idx % 3 === 0 ? "TikTok" : idx % 3 === 1 ? "Instagram" : "YouTube",
    assetType: idx % 2 === 0 ? "VIDEO" : "IMAGE",
    title: `Approved UGC Asset ${idx + 1}`,
    tags: ["demo", "creator", idx % 2 === 0 ? "video" : "image"],
    usageRightsStart: "2026-08-01",
    usageRightsEnd: idx % 5 === 0 ? "2026-09-01" : "2026-12-31",
    approvalStatus: "APPROVED",
    performanceMetrics: idx < 8 ? {
      reach: 3000 + idx * 420,
      impressions: 4200 + idx * 610,
      engagement: 240 + idx * 35,
      clicks: 90 + idx * 11,
      conversions: 7 + idx,
      ...(idx % 4 === 0 ? {} : { revenue: 400 + idx * 75 }),
    } : null,
    mediaLibraryAssetId: null,
    createdAt: NOW,
    updatedAt: NOW,
  }));

  const activity: CreatorActivityEvent[] = [
    { id: "ca_001", workspaceId, actorUserId: userId, eventType: "CREATOR_SAVED", entityType: "creator", entityId: "cr_001", summary: "Creator saved from discover list.", metadata: { demo: true }, createdAt: NOW },
    { id: "ca_002", workspaceId, actorUserId: userId, eventType: "CAMPAIGN_CREATED", entityType: "creator_campaign", entityId: "cc_004", summary: "Creator campaign created.", metadata: { demo: true }, createdAt: NOW },
    { id: "ca_003", workspaceId, actorUserId: userId, eventType: "CONTENT_SUBMITTED", entityType: "creator_submission", entityId: "cs_001", summary: "Creator submitted content.", metadata: { demo: true }, createdAt: NOW },
    { id: "ca_004", workspaceId, actorUserId: userId, eventType: "CONTENT_APPROVED", entityType: "creator_submission", entityId: "cs_004", summary: "Creator content approved.", metadata: { demo: true }, createdAt: NOW },
    { id: "ca_005", workspaceId, actorUserId: userId, eventType: "CREATOR_STAGE_MOVED", entityType: "creator_pipeline", entityId: "cp_002", summary: "Creator moved to negotiating.", metadata: { from: "INTERESTED", to: "NEGOTIATING", demo: true }, createdAt: NOW },
    { id: "ca_006", workspaceId, actorUserId: userId, eventType: "UGC_ADDED", entityType: "creator_ugc_asset", entityId: "cu_001", summary: "Approved creator asset added to UGC library.", metadata: { demo: true }, createdAt: NOW },
  ];

  const analytics: CreatorAnalyticsSnapshot[] = [
    {
      id: "cm_001",
      workspaceId,
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      measured: {
        activeCampaigns: campaigns.filter((item) => ["ACTIVE", "CONTENT_REVIEW", "LIVE", "SCHEDULED"].includes(item.status)).length,
        creatorsEngaged: 14,
        contentSubmitted: submissions.length,
        contentApproved: submissions.filter((row) => row.status === "APPROVED" || row.status === "SCHEDULED" || row.status === "PUBLISHED").length,
        publishedAssets: submissions.filter((row) => row.status === "PUBLISHED").length,
        reach: 148000,
        impressions: 251000,
        engagement: 13200,
        clicks: 4100,
        conversions: 390,
        revenue: null,
        campaignSpend: 22450,
        costPerEngagement: 1.7,
        costPerAcquisition: 57.56,
        creatorRoi: null,
      },
      estimated: {
        campaignSpend: 24000,
      },
      isDemo: true,
      createdAt: NOW,
    },
  ];

  return {
    creators,
    campaigns,
    pipeline,
    submissions,
    ugcAssets,
    activity,
    analytics,
  };
}
