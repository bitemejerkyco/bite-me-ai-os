import { type MarketingScoreCategoryKey } from "@/features/marketing-director/marketing-score-rules";

export const SCORE_CATEGORY_DESTINATIONS: Record<MarketingScoreCategoryKey, string> = {
  brandFoundation: "/onboarding",
  contentConsistency: "/media?tab=CONTENT_DRAFTS",
  contentReadiness: "/media?tab=CONTENT_DRAFTS",
  channelConnections: "/integrations",
  campaignActivity: "/marketing/campaigns",
  analyticsCoverage: "/analytics",
  audienceEngagement: "/analytics",
  paidMediaHealth: "/integrations",
  emailHealth: "/integrations",
  complianceReadiness: "/settings",
};

export function destinationForScoreCategory(category: MarketingScoreCategoryKey): string {
  return SCORE_CATEGORY_DESTINATIONS[category];
}

export function recommendationActionForCategory(category: MarketingScoreCategoryKey): {
  label: string;
  href: string;
} {
  switch (category) {
    case "analyticsCoverage":
      return { label: "Connect analytics", href: "/integrations" };
    case "audienceEngagement":
      return { label: "Open content recommendations", href: "/media?tab=CONTENT_DRAFTS" };
    case "contentReadiness":
      return { label: "Review drafts", href: "/media?tab=CONTENT_DRAFTS" };
    case "paidMediaHealth":
      return { label: "Open integrations", href: "/integrations" };
    case "emailHealth":
      return { label: "Open integrations", href: "/integrations" };
    case "channelConnections":
      return { label: "Open integrations", href: "/integrations" };
    case "campaignActivity":
      return { label: "Open campaigns", href: "/marketing/campaigns" };
    case "brandFoundation":
      return { label: "Complete business setup", href: "/onboarding" };
    case "complianceReadiness":
      return { label: "Review settings", href: "/settings" };
    case "contentConsistency":
    default:
      return { label: "Open content library", href: "/media?tab=CONTENT_DRAFTS" };
  }
}
