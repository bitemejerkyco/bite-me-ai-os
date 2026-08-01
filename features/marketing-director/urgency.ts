export type MarketingUrgencyLevel = "none" | "medium" | "high" | "critical";

export type MarketingUrgency = {
  level: MarketingUrgencyLevel;
  label: string;
  summary: string;
  score: number;
  factors: string[];
  hasUrgentWork: boolean;
};

export type MarketingUrgencyInput = {
  criticalScoreCategories: number;
  failedPublishingJobs: number;
  approvalBacklog: number;
  missingRequiredIntegrations: number;
  scheduledWorkAtRisk: number;
  highPriorityActions: number;
};

export function calculateMarketingUrgency(input: MarketingUrgencyInput): MarketingUrgency {
  const factors: string[] = [];
  let score = 0;

  if (input.criticalScoreCategories > 0) {
    score += Math.min(30, input.criticalScoreCategories * 12);
    factors.push(`${input.criticalScoreCategories} critical score categor${input.criticalScoreCategories === 1 ? "y" : "ies"}`);
  }

  if (input.failedPublishingJobs > 0) {
    score += Math.min(20, input.failedPublishingJobs * 8);
    factors.push(`${input.failedPublishingJobs} failed publishing job${input.failedPublishingJobs === 1 ? "" : "s"}`);
  }

  if (input.approvalBacklog > 0) {
    score += Math.min(16, input.approvalBacklog * 2);
    factors.push(`${input.approvalBacklog} item${input.approvalBacklog === 1 ? "" : "s"} awaiting approval`);
  }

  if (input.missingRequiredIntegrations > 0) {
    score += Math.min(14, input.missingRequiredIntegrations * 4);
    factors.push(`${input.missingRequiredIntegrations} missing required integration${input.missingRequiredIntegrations === 1 ? "" : "s"}`);
  }

  if (input.scheduledWorkAtRisk > 0) {
    score += Math.min(12, input.scheduledWorkAtRisk * 3);
    factors.push(`${input.scheduledWorkAtRisk} scheduled item${input.scheduledWorkAtRisk === 1 ? "" : "s"} at risk`);
  }

  if (input.highPriorityActions > 0) {
    score += Math.min(12, input.highPriorityActions * 3);
    factors.push(`${input.highPriorityActions} high-priority action${input.highPriorityActions === 1 ? "" : "s"}`);
  }

  let level: MarketingUrgencyLevel = "none";
  if (score >= 55) level = "critical";
  else if (score >= 35) level = "high";
  else if (score >= 15) level = "medium";

  const label = level === "critical"
    ? "Critical urgency"
    : level === "high"
      ? "High urgency"
      : level === "medium"
        ? "Moderate urgency"
        : "Stable";

  const summary = factors.length > 0
    ? `${label}: ${factors[0]}.`
    : "Stable: no urgent blockers were detected from connected workspace data.";

  return {
    level,
    label,
    summary,
    score,
    factors,
    hasUrgentWork: level === "critical" || level === "high",
  };
}
