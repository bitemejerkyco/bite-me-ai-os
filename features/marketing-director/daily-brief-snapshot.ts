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

export function restoreDailyBriefFromSnapshot(row: StoredBriefRow): DailyBrief | null {
  const metrics = Array.isArray(row.metrics) ? row.metrics : [];
  const priorityActions = Array.isArray(row.priority_actions) ? row.priority_actions : [];
  const recommendations = Array.isArray(row.recommendations) ? row.recommendations : [];
  const dataCoverage = (row.data_coverage && typeof row.data_coverage === "object")
    ? row.data_coverage as Record<string, unknown>
    : {};

  if (metrics.length === 0) return null;

  const generatedAt = String(dataCoverage.generatedAt || row.updated_at || row.created_at || new Date().toISOString());

  return {
    workspaceId: String(row.workspace_id || ""),
    generatedAt,
    executiveNarrative: String(dataCoverage.executiveNarrative || "Executive narrative is unavailable for this snapshot."),
    confidence: normalizeConfidence(Number(row.confidence || 0)),
    confidenceReason: String(dataCoverage.confidenceReason || "Confidence is based on current connected data."),
    dataQualityWarning: dataCoverage.warning ? String(dataCoverage.warning) : null,
    dataCoverageSummary: String(dataCoverage.dataCoverageSummary || "Coverage summary unavailable."),
    scoreDeltaLabel: String(dataCoverage.scoreDeltaLabel || "No prior Marketing Score snapshot is available yet."),
    revenueAvailability: String(dataCoverage.revenueAvailability || "unavailable") === "available" ? "available" : "unavailable",
    bestPerformanceSignal: String(dataCoverage.bestPerformanceSignal || "No strong performance signal is available yet from connected analytics sources."),
    missingIntegrations: asStringArray(dataCoverage.missingIntegrations),
    sinceLastVisit: asStringArray(dataCoverage.sinceLastVisit),
    needsAttention: asStringArray(dataCoverage.needsAttention),
    performingWell: asStringArray(dataCoverage.performingWell),
    underperforming: asStringArray(dataCoverage.underperforming),
    recommendedNextAction:
      dataCoverage.recommendedNextAction && typeof dataCoverage.recommendedNextAction === "object"
        ? (dataCoverage.recommendedNextAction as DailyBrief["recommendedNextAction"])
        : null,
    urgency:
      dataCoverage.urgency && typeof dataCoverage.urgency === "object"
        ? {
            level: String((dataCoverage.urgency as Record<string, unknown>).level || "none") as DailyBrief["urgency"]["level"],
            label: String((dataCoverage.urgency as Record<string, unknown>).label || "Stable"),
            summary: String((dataCoverage.urgency as Record<string, unknown>).summary || "Stable: no urgent blockers were detected from connected workspace data."),
            factors: asStringArray((dataCoverage.urgency as Record<string, unknown>).factors),
            hasUrgentWork: Boolean((dataCoverage.urgency as Record<string, unknown>).hasUrgentWork),
          }
        : {
            level: "none",
            label: "Stable",
            summary: "Stable: no urgent blockers were detected from connected workspace data.",
            factors: [],
            hasUrgentWork: false,
          },
    metrics: metrics as DailyBrief["metrics"],
    priorityActions: priorityActions as DailyBrief["priorityActions"],
    recommendations: recommendations as DailyBrief["recommendations"],
  };
}
