import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { EXECUTION_ERROR_CODES, recordExecutionEvent } from "@/features/marketing-director/execution-engine";

type ApprovalAction = "approve" | "reject" | "edit_request" | "comment";

type ApprovalMutationBody = {
  action?: unknown;
  itemIds?: unknown;
  comment?: unknown;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function parseAction(value: unknown): ApprovalAction | null {
  const normalized = asText(value).toLowerCase();
  if (normalized === "approve") return "approve";
  if (normalized === "reject") return "reject";
  if (normalized === "edit_request") return "edit_request";
  if (normalized === "comment") return "comment";
  return null;
}

function toApprovalStatus(action: ApprovalAction): "APPROVED" | "REJECTED" | "EDIT_REQUESTED" | "PENDING" {
  if (action === "approve") return "APPROVED";
  if (action === "reject") return "REJECTED";
  if (action === "edit_request") return "EDIT_REQUESTED";
  return "PENDING";
}

export async function GET() {
  try {
    const context = await requireWorkspaceContext();
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("marketing_approval_items")
      .select("id,workflow_id,item_type,title,status,requires_comment,comment,target_record_type,target_record_id,requested_by,resolved_by,resolved_at,metadata,created_at,updated_at")
      .eq("workspace_id", context.workspaceId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`APPROVAL_INBOX_LOAD_FAILED:${error.message}`);
    }

    const rows = (data as Array<Record<string, unknown>> | null) || [];

    return NextResponse.json({
      ok: true,
      items: rows,
      pendingCount: rows.filter((row) => row.status === "PENDING").length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    return NextResponse.json(
      {
        ok: false,
        code: EXECUTION_ERROR_CODES.INVALID_WORKFLOW,
        error: message.startsWith("AUTH_REQUIRED:") ? "Sign in required." : "Unable to load approval inbox.",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    const body = (await request.json().catch(() => null)) as ApprovalMutationBody | null;

    const action = parseAction(body?.action);
    const itemIds = asStringArray(body?.itemIds);
    const comment = asText(body?.comment);

    if (!action || itemIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          code: EXECUTION_ERROR_CODES.INVALID_WORKFLOW,
          error: "action and itemIds are required.",
        },
        { status: 400 },
      );
    }

    if ((action === "reject" || action === "edit_request") && !comment) {
      return NextResponse.json(
        {
          ok: false,
          code: EXECUTION_ERROR_CODES.APPROVAL_REQUIRED,
          error: "A comment is required for reject and edit_request actions.",
        },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const status = toApprovalStatus(action);
    const now = new Date().toISOString();

    const { data: existingItems, error: loadError } = await admin
      .from("marketing_approval_items")
      .select("id,status,title")
      .eq("workspace_id", context.workspaceId)
      .in("id", itemIds);

    if (loadError) {
      throw new Error(`APPROVAL_INBOX_ACTION_LOAD_FAILED:${loadError.message}`);
    }

    const validItems = (existingItems as Array<{ id: string; status: string | null; title: string | null }> | null) || [];
    if (validItems.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          code: EXECUTION_ERROR_CODES.WORKFLOW_BLOCKED,
          error: "No approval items found for the provided IDs.",
        },
        { status: 404 },
      );
    }

    if (action !== "comment") {
      const { error: updateError } = await admin
        .from("marketing_approval_items")
        .update({
          status,
          comment: comment || null,
          resolved_by: context.userId,
          resolved_at: now,
          updated_at: now,
        } as never)
        .eq("workspace_id", context.workspaceId)
        .in("id", validItems.map((item) => item.id));

      if (updateError) {
        throw new Error(`APPROVAL_INBOX_ACTION_UPDATE_FAILED:${updateError.message}`);
      }
    } else {
      const { error: commentError } = await admin
        .from("marketing_approval_items")
        .update({
          comment: comment || null,
          updated_at: now,
        } as never)
        .eq("workspace_id", context.workspaceId)
        .in("id", validItems.map((item) => item.id));

      if (commentError) {
        throw new Error(`APPROVAL_INBOX_COMMENT_FAILED:${commentError.message}`);
      }
    }

    await Promise.all(
      validItems.map((item) =>
        recordExecutionEvent({
          workspaceId: context.workspaceId,
          approvalItemId: item.id,
          actorUserId: context.userId,
          eventType: "approval_inbox",
          status: action === "comment" ? "COMMENTED" : status,
          message: `${action} action applied to approval item ${item.title || item.id}.`,
          metadata: {
            action,
            comment,
          },
        }),
      ),
    );

    return NextResponse.json({
      ok: true,
      code: "APPROVAL_ACTION_APPLIED",
      updatedCount: validItems.length,
      action,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    return NextResponse.json(
      {
        ok: false,
        code: EXECUTION_ERROR_CODES.INVALID_WORKFLOW,
        error: message.startsWith("AUTH_REQUIRED:") ? "Sign in required." : "Unable to update approval items.",
      },
      { status: 400 },
    );
  }
}
