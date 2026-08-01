import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { refundCredits, type CreditOperationType } from "@/features/billing/credit-engine";

const ALLOWED_TYPES = new Set<CreditOperationType>([
  "TEXT",
  "IMAGE",
  "VIDEO",
  "SCHEDULING",
  "ANALYTICS",
  "PUBLISHING",
]);

export async function POST(request: NextRequest) {
  try {
    const context = await requireWorkspaceContext();
    const body = (await request.json()) as {
      operationType?: CreditOperationType;
      amount?: number;
      idempotencyKey?: string;
      referenceType?: string;
      referenceId?: string;
      note?: string;
    };

    const operationType = body.operationType;
    if (!operationType || !ALLOWED_TYPES.has(operationType)) {
      throw new Error("CREDIT_REFUND_INVALID:Invalid operation type.");
    }

    const amount = Number(body.amount || 0);
    const idempotencyKey = String(body.idempotencyKey || "").trim();
    if (!idempotencyKey) {
      throw new Error("CREDIT_REFUND_INVALID:idempotencyKey is required.");
    }

    await refundCredits({
      workspaceId: context.workspaceId,
      userId: context.userId,
      operationType,
      amount,
      idempotencyKey,
      referenceType: body.referenceType,
      referenceId: body.referenceId,
      note: body.note,
      metadata: {
        source: "api",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
