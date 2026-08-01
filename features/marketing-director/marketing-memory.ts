import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type MarketingMemorySignal = {
  key:
    | "content_style_preference"
    | "approval_pattern"
    | "best_product_line"
    | "best_creative_format"
    | "email_subject_preference"
    | "engagement_peak_day"
    | "cross_channel_reuse_bias";
  insight: string;
  confidence: number;
  source: string;
  lastObservedAt: string;
};

type MemoryRow = {
  signal_key: string;
  insight: string;
  confidence: number | null;
  source: string | null;
  last_observed_at: string | null;
};

type CommandHistoryRow = {
  metadata: unknown;
  updated_at: string | null;
};

function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function validSignalKey(value: string): MarketingMemorySignal["key"] | null {
  const allowed: MarketingMemorySignal["key"][] = [
    "content_style_preference",
    "approval_pattern",
    "best_product_line",
    "best_creative_format",
    "email_subject_preference",
    "engagement_peak_day",
    "cross_channel_reuse_bias",
  ];
  return allowed.includes(value as MarketingMemorySignal["key"])
    ? (value as MarketingMemorySignal["key"])
    : null;
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function countActivityStatus(metadata: unknown, status: string): number {
  const object = safeObject(metadata);
  if (!Array.isArray(object.activity)) return 0;
  return object.activity.filter((item) => {
    const row = safeObject(item);
    return String(row.status || "") === status;
  }).length;
}

export function deriveMemorySignalsFromCommandHistory(rows: CommandHistoryRow[]): MarketingMemorySignal[] {
  const approvals = rows.reduce((sum, row) => sum + countActivityStatus(row.metadata, "approved"), 0);
  const schedules = rows.reduce((sum, row) => sum + countActivityStatus(row.metadata, "scheduled"), 0);
  const generated = rows.reduce((sum, row) => sum + countActivityStatus(row.metadata, "generated"), 0);

  const now = new Date().toISOString();
  const result: MarketingMemorySignal[] = [];

  if (approvals > 0) {
    result.push({
      key: "approval_pattern",
      insight:
        schedules > 0
          ? "User typically approves content before scheduling."
          : "User frequently requests approval checkpoints before execution.",
      confidence: normalizeConfidence(Math.min(1, approvals / Math.max(1, approvals + schedules))),
      source: "command_activity",
      lastObservedAt: now,
    });
  }

  if (generated > 0) {
    result.push({
      key: "cross_channel_reuse_bias",
      insight: "Existing assets are often reused before creating net-new content.",
      confidence: normalizeConfidence(Math.min(1, generated / 10)),
      source: "command_activity",
      lastObservedAt: now,
    });
  }

  return result;
}

export async function loadMarketingMemorySignals(workspaceId: string): Promise<MarketingMemorySignal[]> {
  const admin = createAdminClient();

  const [memoryResult, historyResult] = await Promise.all([
    admin
      .from("marketing_director_memory_signals")
      .select("signal_key,insight,confidence,source,last_observed_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(12),
    admin
      .from("marketing_director_commands")
      .select("metadata,updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(60),
  ]);

  const storedSignals: MarketingMemorySignal[] = ((memoryResult.data as MemoryRow[] | null) || [])
    .map((row) => {
      const key = validSignalKey(String(row.signal_key || ""));
      if (!key) return null;
      return {
        key,
        insight: String(row.insight || "").trim(),
        confidence: normalizeConfidence(Number(row.confidence || 0)),
        source: String(row.source || "marketing_memory"),
        lastObservedAt: String(row.last_observed_at || new Date().toISOString()),
      };
    })
    .filter((row): row is MarketingMemorySignal => Boolean(row && row.insight));

  const derived = deriveMemorySignalsFromCommandHistory((historyResult.data as CommandHistoryRow[] | null) || []);

  const mergedByKey = new Map<MarketingMemorySignal["key"], MarketingMemorySignal>();
  for (const signal of [...storedSignals, ...derived]) {
    const existing = mergedByKey.get(signal.key);
    if (!existing || signal.confidence >= existing.confidence) {
      mergedByKey.set(signal.key, signal);
    }
  }

  return Array.from(mergedByKey.values()).slice(0, 8);
}

export async function upsertMarketingMemorySignals(
  workspaceId: string,
  signals: MarketingMemorySignal[],
): Promise<void> {
  if (signals.length === 0) return;
  const admin = createAdminClient();

  await admin.from("marketing_director_memory_signals").upsert(
    signals.map((signal) => ({
      workspace_id: workspaceId,
      signal_key: signal.key,
      insight: signal.insight,
      confidence: normalizeConfidence(signal.confidence),
      source: signal.source,
      last_observed_at: signal.lastObservedAt,
    })) as never,
    { onConflict: "workspace_id,signal_key" },
  );
}
