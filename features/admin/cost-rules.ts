export type AiUsageEvent = {
  provider: string;
  model: string;
  operation: string;
  status: "SUCCEEDED" | "FAILED" | "REFUNDED" | "PENDING";
  inputUnits: number;
  outputUnits: number;
  creditsCharged: number;
  estimatedCostCents: number;
  actualCostCents: number | null;
  revenueAllocatedCents: number | null;
  durationMs: number | null;
  createdAt: string;
};

export type ProviderCostRate = {
  provider: string;
  model: string;
  operation: string;
  inputCost: number | null;
  outputCost: number | null;
  fixedCostCents: number;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type CostComputation = {
  costCents: number | null;
  source: "actual" | "event_estimate" | "configured_rate" | "rate_not_configured";
};

export function findEffectiveRate(
  rates: ProviderCostRate[],
  event: AiUsageEvent,
): ProviderCostRate | null {
  const createdAt = new Date(event.createdAt).getTime();
  return (
    rates.find((rate) => {
      if (
        rate.provider !== event.provider ||
        rate.model !== event.model ||
        rate.operation !== event.operation
      ) {
        return false;
      }
      const effectiveFrom = new Date(rate.effectiveFrom).getTime();
      const effectiveTo = rate.effectiveTo
        ? new Date(rate.effectiveTo).getTime()
        : Number.POSITIVE_INFINITY;
      return createdAt >= effectiveFrom && createdAt <= effectiveTo;
    }) || null
  );
}

export function calculateUsageEventCost(
  event: AiUsageEvent,
  rates: ProviderCostRate[],
): CostComputation {
  if (typeof event.actualCostCents === "number") {
    return { costCents: event.actualCostCents, source: "actual" };
  }
  if (event.estimatedCostCents > 0) {
    return { costCents: event.estimatedCostCents, source: "event_estimate" };
  }

  const rate = findEffectiveRate(rates, event);
  if (!rate) {
    return { costCents: null, source: "rate_not_configured" };
  }

  const inputCost = (rate.inputCost || 0) * event.inputUnits;
  const outputCost = (rate.outputCost || 0) * event.outputUnits;
  return {
    costCents: Math.round(inputCost + outputCost + rate.fixedCostCents),
    source: "configured_rate",
  };
}

export function calculateGrossMargin(input: {
  revenueAllocatedCents: number;
  totalCostCents: number;
}) {
  return input.revenueAllocatedCents - input.totalCostCents;
}

export function buildAiCostSummary(
  events: AiUsageEvent[],
  rates: ProviderCostRate[],
) {
  return events.reduce(
    (summary, event) => {
      const cost = calculateUsageEventCost(event, rates);
      const resolvedCost = cost.costCents ?? 0;
      summary.totalEvents += 1;
      summary.failedEvents += event.status === "FAILED" ? 1 : 0;
      summary.refundedEvents += event.status === "REFUNDED" ? 1 : 0;
      summary.totalCredits += event.creditsCharged;
      summary.totalRevenueAllocatedCents += event.revenueAllocatedCents ?? 0;
      summary.totalCostCents += resolvedCost;
      summary.averageDurationMs += event.durationMs ?? 0;
      if (cost.source === "rate_not_configured") {
        summary.missingRateEvents += 1;
      }
      return summary;
    },
    {
      totalEvents: 0,
      failedEvents: 0,
      refundedEvents: 0,
      totalCredits: 0,
      totalRevenueAllocatedCents: 0,
      totalCostCents: 0,
      averageDurationMs: events.length
        ? Math.round(
            events.reduce((sum, event) => sum + (event.durationMs ?? 0), 0) /
              events.length,
          )
        : 0,
      missingRateEvents: 0,
    },
  );
}