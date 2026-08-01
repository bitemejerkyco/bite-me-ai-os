export type ExecutiveMetricCardId =
  | "marketing_score"
  | "marketing_health"
  | "revenue_impact"
  | "ai_confidence"
  | "active_campaigns"
  | "content_awaiting_approval"
  | "scheduled_posts"
  | "connected_channels";

export const EXECUTIVE_CARD_DESTINATIONS: Record<ExecutiveMetricCardId, string> = {
  marketing_score: "/analytics/marketing-score",
  marketing_health: "/analytics/marketing-health",
  revenue_impact: "/analytics/revenue",
  ai_confidence: "/analytics/ai-confidence",
  active_campaigns: "/marketing/campaigns",
  content_awaiting_approval: "/content-library?status=awaiting-approval",
  scheduled_posts: "/calendar?view=scheduled",
  connected_channels: "/integrations",
};
