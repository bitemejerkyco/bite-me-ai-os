export type ExecutiveMetricCardId =
  | "marketing_score"
  | "marketing_health"
  | "revenue_impact"
  | "lead_generation"
  | "conversion_rate"
  | "roas"
  | "cac"
  | "ltv"
  | "organic_growth"
  | "paid_growth"
  | "ai_confidence"
  | "biggest_opportunity"
  | "biggest_risk"
  | "active_campaigns"
  | "content_awaiting_approval"
  | "scheduled_posts"
  | "connected_channels";

export const EXECUTIVE_CARD_DESTINATIONS: Record<ExecutiveMetricCardId, string> = {
  marketing_score: "/analytics/marketing-score",
  marketing_health: "/analytics/marketing-health",
  revenue_impact: "/analytics/revenue",
  lead_generation: "/analytics/marketing-health",
  conversion_rate: "/analytics/revenue",
  roas: "/analytics/revenue",
  cac: "/analytics/revenue",
  ltv: "/analytics/revenue",
  organic_growth: "/analytics/marketing-health",
  paid_growth: "/analytics/revenue",
  ai_confidence: "/analytics/ai-confidence",
  biggest_opportunity: "/analytics/executive-brief",
  biggest_risk: "/analytics/executive-brief",
  active_campaigns: "/marketing/campaigns",
  content_awaiting_approval: "/content-library?status=awaiting-approval",
  scheduled_posts: "/calendar?view=scheduled",
  connected_channels: "/integrations",
};
