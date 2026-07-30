import { describe, expect, it } from "vitest";
import {
  buildAiCostSummary,
  calculateGrossMargin,
  calculateUsageEventCost,
} from "@/features/admin/cost-rules";

describe("AI cost calculations", () => {
  const event = {
    provider: "openai",
    model: "gpt-5.6-sol",
    operation: "responses",
    status: "SUCCEEDED" as const,
    inputUnits: 1000,
    outputUnits: 500,
    creditsCharged: 120,
    estimatedCostCents: 0,
    actualCostCents: null,
    revenueAllocatedCents: 900,
    durationMs: 1200,
    createdAt: "2026-07-30T10:00:00.000Z",
  };

  it("uses actual cost when present", () => {
    expect(
      calculateUsageEventCost({ ...event, actualCostCents: 800 }, []),
    ).toEqual({ costCents: 800, source: "actual" });
  });

  it("falls back to configured rates when event estimate is missing", () => {
    expect(
      calculateUsageEventCost(event, [
        {
          provider: "openai",
          model: "gpt-5.6-sol",
          operation: "responses",
          inputCost: 0.1,
          outputCost: 0.2,
          fixedCostCents: 50,
          effectiveFrom: "2026-01-01T00:00:00.000Z",
          effectiveTo: null,
        },
      ]),
    ).toEqual({ costCents: 250, source: "configured_rate" });
  });

  it("reports missing rates safely", () => {
    expect(calculateUsageEventCost(event, [])).toEqual({
      costCents: null,
      source: "rate_not_configured",
    });
  });

  it("calculates gross margin from allocated revenue and cost", () => {
    expect(
      calculateGrossMargin({ revenueAllocatedCents: 1000, totalCostCents: 400 }),
    ).toBe(600);
  });

  it("tracks failed and refunded usage in summaries", () => {
    const summary = buildAiCostSummary(
      [
        event,
        { ...event, status: "FAILED", createdAt: "2026-07-30T11:00:00.000Z" },
        { ...event, status: "REFUNDED", createdAt: "2026-07-30T12:00:00.000Z", actualCostCents: 200 },
      ],
      [],
    );
    expect(summary.failedEvents).toBe(1);
    expect(summary.refundedEvents).toBe(1);
  });
});