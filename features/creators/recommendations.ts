import type {
  Creator,
  CreatorRecommendation,
  CreatorRecommendationInput,
} from "@/features/creators/types";

function textSet(values: string[]): Set<string> {
  return new Set(values.map((item) => item.trim().toLowerCase()).filter(Boolean));
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const item of a) {
    if (b.has(item)) overlap += 1;
  }
  return overlap / Math.max(a.size, b.size);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildCreatorRecommendations(input: {
  context: CreatorRecommendationInput;
  creators: Creator[];
  limit?: number;
}): CreatorRecommendation[] {
  const { context, creators, limit = 6 } = input;
  const goal = context.campaignGoal.toLowerCase();
  const industryTokens = textSet([context.industry, ...context.productsOrServices]);
  const audienceTokens = textSet(context.targetAudience.split(/[^a-z0-9]+/iu));
  const platformTokens = textSet(context.connectedPlatforms);
  const location = context.location.trim().toLowerCase();

  const ranked = creators.map((creator) => {
    const nicheTokens = textSet(creator.niches);
    const creatorAudience = textSet(creator.audienceSummary.split(/[^a-z0-9]+/iu));
    const creatorPlatforms = textSet(creator.platforms.map((platform) => platform.platform));

    const nicheFit = overlapScore(industryTokens, nicheTokens);
    const audienceFit = overlapScore(audienceTokens, creatorAudience);
    const platformFit = overlapScore(platformTokens, creatorPlatforms);
    const locationFit = creator.location.toLowerCase().includes(location) ? 1 : 0;
    const engagementFit = Math.min(creator.engagementRate / 0.09, 1);
    const safetyPenalty = creator.brandSafetyStatus === "SAFE" ? 0 : creator.brandSafetyStatus === "REVIEW" ? -8 : -18;
    const availabilityPenalty = creator.availabilityStatus === "AVAILABLE" ? 0 : creator.availabilityStatus === "LIMITED" ? -5 : -15;

    const weightedScore =
      nicheFit * 28 +
      audienceFit * 20 +
      platformFit * 16 +
      locationFit * 10 +
      engagementFit * 16 +
      Math.min(creator.matchScore / 100, 1) * 10 +
      safetyPenalty +
      availabilityPenalty;

    const matchScore = clampScore(weightedScore);
    const reasons: string[] = [];
    const concerns: string[] = [];

    if (nicheFit >= 0.5) reasons.push("Niche aligns with your industry and product focus.");
    if (audienceFit >= 0.3) reasons.push("Audience summary overlaps with your target audience.");
    if (platformFit > 0) reasons.push("Active on at least one connected platform in your workspace.");
    if (locationFit > 0) reasons.push("Creator location is aligned with your target geography.");
    if (creator.engagementRate >= 0.06) reasons.push("Engagement rate is strong for beta creator campaigns.");

    if (creator.brandSafetyStatus === "REVIEW") concerns.push("Brand safety needs manual review before campaign activation.");
    if (creator.brandSafetyStatus === "RESTRICTED") concerns.push("Brand safety is restricted for current campaign criteria.");
    if (creator.availabilityStatus !== "AVAILABLE") concerns.push("Availability is limited; timelines may require flexibility.");

    const recommendedCampaignType = goal.includes("awareness")
      ? "Awareness burst"
      : goal.includes("conversion") || goal.includes("sales")
        ? "Performance creator conversion"
        : goal.includes("local")
          ? "Local creator spotlight"
          : "Creator product storytelling";

    const recommendedDeliverables = goal.includes("video")
      ? ["2 short videos", "1 story concept", "1 thumbnail variant"]
      : ["1 short video", "1 caption set", "1 image post"];

    const recommendedOutreachAngle = `Lead with ${context.campaignGoal.toLowerCase()} and highlight fit with ${creator.niches[0] || "your campaign"}.`;

    const confidence = Math.max(0.2, Math.min(0.95, (matchScore / 100) * 0.9));

    return {
      creatorId: creator.id,
      matchScore,
      reasons: reasons.length ? reasons : ["Matches baseline campaign criteria from workspace settings."],
      concerns,
      recommendedCampaignType,
      recommendedDeliverables,
      recommendedOutreachAngle,
      confidence: Number(confidence.toFixed(2)),
    } satisfies CreatorRecommendation;
  });

  return ranked
    .sort((left, right) => right.matchScore - left.matchScore || right.confidence - left.confidence)
    .slice(0, limit);
}

export const CREATOR_RECOMMENDATION_LABEL =
  "Based on demo creator profiles and your workspace settings.";
