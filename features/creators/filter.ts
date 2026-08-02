import type { Creator } from "@/features/creators/types";

export type CreatorFilterInput = {
  platform?: string;
  niche?: string;
  location?: string;
  minFollowers?: number | null;
  minViews?: number | null;
  minEngagement?: number | null;
  maxRate?: number | null;
  availability?: string;
  safety?: string;
  minMatch?: number | null;
};

export function filterCreators(creators: Creator[], filter: CreatorFilterInput): Creator[] {
  return creators.filter((creator) => {
    if (filter.platform && filter.platform !== "ALL" && !creator.platforms.some((item) => item.platform === filter.platform)) return false;
    if (filter.niche && filter.niche !== "ALL" && !creator.niches.includes(filter.niche)) return false;
    if (filter.location && !creator.location.toLowerCase().includes(filter.location.toLowerCase())) return false;
    if (filter.minFollowers !== null && filter.minFollowers !== undefined && creator.followerCount < filter.minFollowers) return false;
    if (filter.minViews !== null && filter.minViews !== undefined && creator.averageViews < filter.minViews) return false;
    if (filter.minEngagement !== null && filter.minEngagement !== undefined && creator.engagementRate < filter.minEngagement) return false;
    if (filter.maxRate !== null && filter.maxRate !== undefined && creator.estimatedRateMax > filter.maxRate) return false;
    if (filter.availability && filter.availability !== "ALL" && creator.availabilityStatus !== filter.availability) return false;
    if (filter.safety && filter.safety !== "ALL" && creator.brandSafetyStatus !== filter.safety) return false;
    if (filter.minMatch !== null && filter.minMatch !== undefined && creator.matchScore < filter.minMatch) return false;
    return true;
  });
}
