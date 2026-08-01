import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type CreditOperationType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "SCHEDULING"
  | "ANALYTICS"
  | "PUBLISHING";

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`CREDIT_ENGINE_INVALID:${label} must be a positive integer.`);
  }
}

async function adjustWorkspaceBalance(input: {
  workspaceId: string;
  fields: Partial<Record<"ai_credits_remaining" | "video_credits_remaining" | "publish_credits_remaining" | "analytics_credits_remaining", number>>;
}): Promise<void> {
  const admin = createAdminClient();

  const existing = await admin
    .from("workspace_credit_balances")
    .select("workspace_id,ai_credits_remaining,video_credits_remaining,publish_credits_remaining,analytics_credits_remaining")
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  const row = (existing.data as {
    workspace_id?: string;
    ai_credits_remaining?: number;
    video_credits_remaining?: number;
    publish_credits_remaining?: number;
    analytics_credits_remaining?: number;
  } | null) || {
    workspace_id: input.workspaceId,
    ai_credits_remaining: 0,
    video_credits_remaining: 0,
    publish_credits_remaining: 0,
    analytics_credits_remaining: 0,
  };

  const next = {
    workspace_id: input.workspaceId,
    ai_credits_remaining: Math.max(0, Number(row.ai_credits_remaining || 0) + Number(input.fields.ai_credits_remaining || 0)),
    video_credits_remaining: Math.max(0, Number(row.video_credits_remaining || 0) + Number(input.fields.video_credits_remaining || 0)),
    publish_credits_remaining: Math.max(0, Number(row.publish_credits_remaining || 0) + Number(input.fields.publish_credits_remaining || 0)),
    analytics_credits_remaining: Math.max(0, Number(row.analytics_credits_remaining || 0) + Number(input.fields.analytics_credits_remaining || 0)),
  };

  const { error } = await admin
    .from("workspace_credit_balances")
    .upsert(next as never, { onConflict: "workspace_id" });

  if (error) {
    throw new Error(`CREDIT_ENGINE_BALANCE_UPDATE_FAILED:${error.message}`);
  }
}

function balanceFieldForOperation(operation: CreditOperationType):
  | "ai_credits_remaining"
  | "video_credits_remaining"
  | "publish_credits_remaining"
  | "analytics_credits_remaining" {
  if (operation === "VIDEO") return "video_credits_remaining";
  if (operation === "PUBLISHING" || operation === "SCHEDULING") return "publish_credits_remaining";
  if (operation === "ANALYTICS") return "analytics_credits_remaining";
  return "ai_credits_remaining";
}

export async function consumeCredits(input: {
  workspaceId: string;
  userId: string | null;
  operationType: CreditOperationType;
  amount: number;
  idempotencyKey: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  assertPositiveInteger(input.amount, "amount");

  const admin = createAdminClient();
  const { error } = await admin
    .from("credit_ledger")
    .insert(
      {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        operation_type: input.operationType,
        direction: "DEBIT",
        amount: input.amount,
        idempotency_key: input.idempotencyKey,
        reference_type: input.referenceType || null,
        reference_id: input.referenceId || null,
        status: "APPLIED",
        metadata: input.metadata || {},
      } as never,
    );

  if (error) {
    if (error.message.includes("duplicate") || error.message.includes("unique")) {
      return;
    }
    throw new Error(`CREDIT_ENGINE_LEDGER_WRITE_FAILED:${error.message}`);
  }

  const field = balanceFieldForOperation(input.operationType);
  await adjustWorkspaceBalance({
    workspaceId: input.workspaceId,
    fields: {
      [field]: -input.amount,
    },
  });
}

export async function refundCredits(input: {
  workspaceId: string;
  userId: string | null;
  operationType: CreditOperationType;
  amount: number;
  idempotencyKey: string;
  referenceType?: string;
  referenceId?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  assertPositiveInteger(input.amount, "amount");

  const admin = createAdminClient();
  const { error } = await admin
    .from("credit_ledger")
    .insert(
      {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        operation_type: input.operationType,
        direction: "CREDIT",
        amount: input.amount,
        idempotency_key: input.idempotencyKey,
        reference_type: input.referenceType || null,
        reference_id: input.referenceId || null,
        status: "REFUNDED",
        note: input.note || "Refund issued before completion.",
        metadata: input.metadata || {},
      } as never,
    );

  if (error) {
    if (error.message.includes("duplicate") || error.message.includes("unique")) {
      return;
    }
    throw new Error(`CREDIT_ENGINE_REFUND_WRITE_FAILED:${error.message}`);
  }

  const field = balanceFieldForOperation(input.operationType);
  await adjustWorkspaceBalance({
    workspaceId: input.workspaceId,
    fields: {
      [field]: input.amount,
    },
  });
}
