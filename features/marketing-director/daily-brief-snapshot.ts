import { normalizeConfidence, type DailyBrief } from "@/features/marketing-director/daily-brief-rules";

export type StoredBriefRow = {
  workspace_id: string;
  metrics: unknown;
  priority_actions: unknown;
  recommendations: unknown;
  confidence: number | null;
  data_coverage: unknown;
  created_at: string | null;
  updated_at: string | null;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "")).filter(Boolean);
}

function buildSnapshotNarrative(input: {
  dataCoverageSummary: string;
  scoreDeltaLabel: string;
  bestPerformanceSignal: string;
  urgencySummary: string;
  needsAttention: string[];
  performingWell: string[];
  missingIntegrations: string[];
  revenueAvailability: "available" | "unavailable";
  recommendedNextActionTitle: string | null;
  sinceLastVisit: string[];
}): string {
  const topNeed = input.needsAttention[0] || "No critical blocker is currently flagged in connected records.";
  const topStrength = input.performingWell[0] || "No strong positive execution signal is confirmed yet.";
  const missing = input.missingIntegrations.length > 0
    ? input.missingIntegrations.join(", ")
    : "no major integration gaps";
  const nextAction = input.recommendedNextActionTitle || "review priority actions and confirm the next safe step";
  const recentShift = input.sinceLastVisit.slice(0, 2).join(" ") || "No significant activity change was recorded since the previous brief.";

  return [
    `This brief snapshot reflects current connected workspace data: ${input.dataCoverageSummary}.`,
    `${input.scoreDeltaLabel}`,
    `Best available performance signal: ${input.bestPerformanceSignal}`,
    `Urgency context: ${input.urgencySummary}`,
    `Primary risk right now: ${topNeed}`,
    `Primary strength to protect: ${topStrength}`,
    input.revenueAvailability === "available"
      ? "Revenue impact is connected and can be used for prioritization decisions today."
      : "Revenue impact is still unavailable from connected sources, so financial guidance should be treated as directional.",
    `Integration coverage focus: ${missing}.`,
    `Recommended next step is to ${nextAction}.`,
    `Recent activity context: ${recentShift}`,
  ].join(" ");
}

export function restoreDailyBriefFromSnapshot(row: StoredBriefRow): DailyBrief | null {
  const metrics = Array.isArray(row.metrics) ? row.metrics : [];
  const priorityActions = Array.isArray(row.priority_actions) ? row.priority_actions : [];
  const recommendations = Array.isArray(row.recommendations) ? row.recommendations : [];
  const dataCoverage = (row.data_coverage && typeof row.data_coverage === "object")
    ? row.data_coverage as Record<string, unknown>
    : {};

  if (metrics.length === 0) return null;

  const generatedAt = String(dataCoverage.generatedAt || row.updated_at || row.created_at || new Date().toISOString());
  const dataCoverageSummary = String(dataCoverage.dataCoverageSummary || "Coverage summary unavailable.");
  const scoreDeltaLabel = String(dataCoverage.scoreDeltaLabel || "No prior Marketing Score snapshot is available yet.");
  const revenueAvailability = String(dataCoverage.revenueAvailability || "unavailable") === "available" ? "available" : "unavailable";
  const bestPerformanceSignal = String(dataCoverage.bestPerformanceSignal || "No strong performance signal is available yet from connected analytics sources.");
  const missingIntegrations = asStringArray(dataCoverage.missingIntegrations);
  const sinceLastVisit = asStringArray(dataCoverage.sinceLastVisit);
  const needsAttention = asStringArray(dataCoverage.needsAttention);
  const performingWell = asStringArray(dataCoverage.performingWell);
  const underperforming = asStringArray(dataCoverage.underperforming);
  const recommendedNextAction =
    dataCoverage.recommendedNextAction && typeof dataCoverage.recommendedNextAction === "object"
      ? (dataCoverage.recommendedNextAction as DailyBrief["recommendedNextAction"])
      : null;
  const urgency =
    dataCoverage.urgency && typeof dataCoverage.urgency === "object"
      ? {
          level: String((dataCoverage.urgency as Record<string, unknown>).level || "none") as DailyBrief["urgency"]["level"],
          label: String((dataCoverage.urgency as Record<string, unknown>).label || "Stable"),
          summary: String((dataCoverage.urgency as Record<string, unknown>).summary || "Stable: no urgent blockers were detected from connected workspace data."),
          factors: asStringArray((dataCoverage.urgency as Record<string, unknown>).factors),
          hasUrgentWork: Boolean((dataCoverage.urgency as Record<string, unknown>).hasUrgentWork),
        }
      : {
          level: "none" as DailyBrief["urgency"]["level"],
          label: "Stable",
          summary: "Stable: no urgent blockers were detected from connected workspace data.",
          factors: [],
          hasUrgentWork: false,
        };

  const executiveNarrative = String(dataCoverage.executiveNarrative || "").trim() || buildSnapshotNarrative({
    dataCoverageSummary,
    scoreDeltaLabel,
    bestPerformanceSignal,
    urgencySummary: urgency.summary,
    needsAttention,
    performingWell,
    missingIntegrations,
    revenueAvailability,
    recommendedNextActionTitle: recommendedNextAction?.title || null,
    sinceLastVisit,
  });

  const morningBrief =
    dataCoverage.morningBrief && typeof dataCoverage.morningBrief === "object"
      ? {
          overnightChanges: asStringArray((dataCoverage.morningBrief as Record<string, unknown>).overnightChanges),
          wins: asStringArray((dataCoverage.morningBrief as Record<string, unknown>).wins),
          risks: asStringArray((dataCoverage.morningBrief as Record<string, unknown>).risks),
          urgentActions: asStringArray((dataCoverage.morningBrief as Record<string, unknown>).urgentActions),
          opportunities: asStringArray((dataCoverage.morningBrief as Record<string, unknown>).opportunities),
          marketingScoreChanges: asStringArray((dataCoverage.morningBrief as Record<string, unknown>).marketingScoreChanges),
          campaignPerformance: asStringArray((dataCoverage.morningBrief as Record<string, unknown>).campaignPerformance),
          aiRecommendations: asStringArray((dataCoverage.morningBrief as Record<string, unknown>).aiRecommendations),
          estimatedBusinessImpact: String((dataCoverage.morningBrief as Record<string, unknown>).estimatedBusinessImpact || ""),
        }
      : {
          overnightChanges: sinceLastVisit,
          wins: performingWell,
          risks: needsAttention,
          urgentActions: recommendedNextAction?.title ? [recommendedNextAction.title] : [],
          opportunities: [],
          marketingScoreChanges: [scoreDeltaLabel],
          campaignPerformance: [bestPerformanceSignal],
          aiRecommendations: [],
          estimatedBusinessImpact: "Estimated business impact is directional based on connected data.",
        };

  const autonomousRecommendations = Array.isArray(dataCoverage.autonomousRecommendations)
    ? dataCoverage.autonomousRecommendations as DailyBrief["autonomousRecommendations"]
    : [];

  return {
    workspaceId: String(row.workspace_id || ""),
    generatedAt,
    executiveNarrative,
    confidence: normalizeConfidence(Number(row.confidence || 0)),
    confidenceReason: String(dataCoverage.confidenceReason || "Confidence is based on current connected data."),
    dataQualityWarning: dataCoverage.warning ? String(dataCoverage.warning) : null,
    dataCoverageSummary,
    scoreDeltaLabel,
    revenueAvailability,
    bestPerformanceSignal,
    missingIntegrations,
    sinceLastVisit,
    needsAttention,
    performingWell,
    underperforming,
    recommendedNextAction,
    urgency,
    metrics: metrics as DailyBrief["metrics"],
    priorityActions: priorityActions as DailyBrief["priorityActions"],
    recommendations: recommendations as DailyBrief["recommendations"],
    autonomousRecommendations,
    morningBrief,
  };
}
