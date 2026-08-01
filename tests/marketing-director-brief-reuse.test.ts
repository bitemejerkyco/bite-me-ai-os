import { describe, expect, it } from "vitest";
import { restoreDailyBriefFromSnapshot } from "@/features/marketing-director/daily-brief-snapshot";

describe("marketing director brief reuse", () => {
  it("restores a persisted daily brief snapshot", () => {
    const restored = restoreDailyBriefFromSnapshot({
      workspace_id: "ws-1",
      metrics: [{ id: "m1", label: "Marketing Score", value: "77", trend: "flat", note: "ok" }],
      priority_actions: [],
      recommendations: [],
      confidence: 0.62,
      data_coverage: {
        generatedAt: "2026-08-01T10:00:00.000Z",
        confidenceReason: "Confidence based on connected sources.",
        dataCoverageSummary: "62% confidence",
        scoreDeltaLabel: "No prior snapshot",
        revenueAvailability: "unavailable",
        bestPerformanceSignal: "No reliable performance signal.",
        missingIntegrations: ["Revenue tracking"],
      },
      created_at: "2026-08-01T09:50:00.000Z",
      updated_at: "2026-08-01T10:00:00.000Z",
    });

    expect(restored).not.toBeNull();
    expect(restored?.workspaceId).toBe("ws-1");
    expect(restored?.generatedAt).toBe("2026-08-01T10:00:00.000Z");
    expect(restored?.revenueAvailability).toBe("unavailable");
    expect(restored?.missingIntegrations).toContain("Revenue tracking");
  });

  it("returns null for invalid snapshot rows", () => {
    const restored = restoreDailyBriefFromSnapshot({
      workspace_id: "ws-1",
      metrics: null,
      priority_actions: [],
      recommendations: [],
      confidence: 0.5,
      data_coverage: {},
      created_at: null,
      updated_at: null,
    });

    expect(restored).toBeNull();
  });
});
