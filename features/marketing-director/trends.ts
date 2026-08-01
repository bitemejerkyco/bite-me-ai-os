import { type MarketingScoreTrend } from "@/features/marketing-director/marketing-score-rules";

function comparisonPeriodLabel(trend: MarketingScoreTrend): string {
  if (!trend.previousGeneratedAt || !trend.currentGeneratedAt) {
    return "since last snapshot";
  }

  const current = new Date(trend.currentGeneratedAt).getTime();
  const previous = new Date(trend.previousGeneratedAt).getTime();
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return "since last snapshot";
  }

  const dayDelta = Math.round((current - previous) / (24 * 60 * 60 * 1000));
  if (dayDelta <= 1) return "since yesterday";
  return "since last snapshot";
}

export function formatTrendIndicator(trend: MarketingScoreTrend): string | null {
  if (!trend.available) return null;

  const period = comparisonPeriodLabel(trend);
  const magnitude = Math.abs(trend.delta).toFixed(1);
  if (trend.direction === "up") return `▲ ${magnitude} ${period}`;
  if (trend.direction === "down") return `▼ ${magnitude} ${period}`;
  return `● 0.0 ${period}`;
}
