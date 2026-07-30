import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildAiCostSummary,
  calculateGrossMargin,
  type AiUsageEvent,
  type ProviderCostRate,
} from "@/features/admin/cost-rules";

type VideoCreditTransactionRow = {
  workspace_id: string;
  kind: string;
  credits_delta: number;
  estimated_provider_cost_cents: number;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function coerceDateRange(input: { from?: string | null; to?: string | null }) {
  const now = new Date();
  const from = input.from ? new Date(input.from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = input.to ? new Date(input.to) : now;
  return {
    from: Number.isNaN(from.getTime()) ? new Date(now.getFullYear(), now.getMonth(), 1) : from,
    to: Number.isNaN(to.getTime()) ? now : to,
  };
}

export async function loadAdminCosts(filters: {
  from?: string | null;
  to?: string | null;
  provider?: string | null;
  model?: string | null;
  accountId?: string | null;
  feature?: string | null;
  status?: string | null;
} = {}) {
  const admin = createAdminClient();
  const range = coerceDateRange(filters);

  const [aiUsageResult, ratesResult, videoTransactionsResult] = await Promise.all([
    admin
      .from("ai_usage_events")
      .select("provider,model,operation,status,input_units,output_units,credits_charged,estimated_cost_cents,actual_cost_cents,revenue_allocated_cents,duration_ms,created_at,account_id,feature")
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString())
      .order("created_at", { ascending: false }),
    admin
      .from("provider_cost_rates")
      .select("provider,model,operation,input_cost,output_cost,fixed_cost_cents,effective_from,effective_to")
      .order("effective_from", { ascending: false }),
    admin
      .from("video_credit_transactions")
      .select("workspace_id,kind,credits_delta,estimated_provider_cost_cents,created_at,metadata")
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString())
      .order("created_at", { ascending: false }),
  ]);

  if (aiUsageResult.error) {
    throw new Error(`AI_USAGE_EVENTS_LIST_FAILED:${aiUsageResult.error.message}`);
  }
  if (ratesResult.error) {
    throw new Error(`PROVIDER_COST_RATES_LIST_FAILED:${ratesResult.error.message}`);
  }
  if (videoTransactionsResult.error) {
    throw new Error(`VIDEO_TRANSACTIONS_LIST_FAILED:${videoTransactionsResult.error.message}`);
  }

  const aiEvents = ((aiUsageResult.data as Array<Record<string, unknown>> | null) || [])
    .filter((event) => !filters.provider || String(event.provider) === filters.provider)
    .filter((event) => !filters.model || String(event.model) === filters.model)
    .filter((event) => !filters.accountId || String(event.account_id) === filters.accountId)
    .filter((event) => !filters.feature || String(event.feature) === filters.feature)
    .filter((event) => !filters.status || String(event.status) === filters.status)
    .map(
      (event): AiUsageEvent => ({
        provider: String(event.provider || "unknown"),
        model: String(event.model || "unknown"),
        operation: String(event.operation || "unknown"),
        status: String(event.status || "PENDING") as AiUsageEvent["status"],
        inputUnits: Number(event.input_units || 0),
        outputUnits: Number(event.output_units || 0),
        creditsCharged: Number(event.credits_charged || 0),
        estimatedCostCents: Number(event.estimated_cost_cents || 0),
        actualCostCents:
          typeof event.actual_cost_cents === "number"
            ? Number(event.actual_cost_cents)
            : null,
        revenueAllocatedCents:
          typeof event.revenue_allocated_cents === "number"
            ? Number(event.revenue_allocated_cents)
            : null,
        durationMs:
          typeof event.duration_ms === "number" ? Number(event.duration_ms) : null,
        createdAt: String(event.created_at),
      }),
    );

  const rates = ((ratesResult.data as Array<Record<string, unknown>> | null) || []).map(
    (rate): ProviderCostRate => ({
      provider: String(rate.provider || "unknown"),
      model: String(rate.model || "unknown"),
      operation: String(rate.operation || "unknown"),
      inputCost:
        typeof rate.input_cost === "number" ? Number(rate.input_cost) : null,
      outputCost:
        typeof rate.output_cost === "number" ? Number(rate.output_cost) : null,
      fixedCostCents: Number(rate.fixed_cost_cents || 0),
      effectiveFrom: String(rate.effective_from),
      effectiveTo: rate.effective_to ? String(rate.effective_to) : null,
    }),
  );

  const videoTransactions = (videoTransactionsResult.data as VideoCreditTransactionRow[] | null) || [];
  const aiSummary = buildAiCostSummary(aiEvents, rates);
  const videoCostToday = videoTransactions
    .filter((row) => row.kind === "VIDEO_RENDER")
    .reduce((sum, row) => sum + Number(row.estimated_provider_cost_cents || 0), 0);
  const creditsRefunded = videoTransactions
    .filter((row) => row.kind === "VIDEO_REFUND")
    .reduce((sum, row) => sum + Math.max(0, Number(row.credits_delta || 0)), 0);
  const totalCostCents = aiSummary.totalCostCents + videoCostToday;
  const totalRevenueAllocatedCents = aiSummary.totalRevenueAllocatedCents;

  return {
    range,
    aiSummary,
    videoCostCents: videoCostToday,
    creditsRefunded,
    grossMarginCents: calculateGrossMargin({
      revenueAllocatedCents: totalRevenueAllocatedCents,
      totalCostCents,
    }),
    totalRevenueAllocatedCents,
    totalCostCents,
    events: aiEvents,
    rates,
    videoTransactions,
  };
}