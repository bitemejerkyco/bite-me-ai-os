import { NextResponse } from "next/server";
import {
  COMMAND_PROMPT_MAX_LENGTH,
  classifyIntent,
} from "@/features/marketing-director/command-router";
import {
  appendCommandActivity,
  type CommandActivityEvent,
} from "@/features/marketing-director/command-activity";
import { buildMarketingDirectorCommandPlan } from "@/features/marketing-director/ai-command-plan";
import { loadMarketingDirectorDashboard } from "@/features/marketing-director/dashboard";
import { getMarketingModeSettings } from "@/features/marketing-director/modes";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { createAdminClient } from "@/lib/supabase/admin";

const REQUEST_LIMIT_PER_USER_PER_HOUR = 30;
const DUPLICATE_WINDOW_MS = 25_000;

type CommandBody = {
  prompt?: unknown;
};

type ErrorCode =
  | "INVALID_PROMPT"
  | "PROMPT_TOO_LONG"
  | "REQUEST_LIMITED"
  | "DUPLICATE_REQUEST"
  | "REQUEST_FAILED";

function errorResponse(status: number, code: ErrorCode, message: string) {
  return NextResponse.json({ ok: false, error: message, code }, { status });
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  if (message.startsWith("AUTH_REQUIRED:")) return "Sign in required.";
  if (message.startsWith("WORKSPACE_REQUIRED:")) return "Complete Business Setup first.";
  if (message.startsWith("WORKSPACE_LOOKUP_FAILED:")) return "Workspace lookup failed.";
  if (message.startsWith("COMMAND_TOO_LONG:")) return `Prompt must be ${COMMAND_PROMPT_MAX_LENGTH} characters or fewer.`;
  if (message.startsWith("COMMAND_INVALID:")) return "Command prompt is required.";
  if (message.startsWith("COMMAND_DUPLICATE:")) return "A similar request was just submitted. Please wait a few seconds.";
  if (message.startsWith("COMMAND_RATE_LIMIT:")) return "Command limit reached. Try again in about an hour.";
  return "Unable to process command request.";
}

async function enforceRequestLimit(workspaceId: string, userId: string) {
  const admin = createAdminClient();
  const threshold = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("marketing_director_commands")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("actor_user_id", userId)
    .gte("created_at", threshold);

  if (error) {
    throw new Error(`COMMAND_RATE_LOOKUP_FAILED:${error.message}`);
  }

  if ((count || 0) >= REQUEST_LIMIT_PER_USER_PER_HOUR) {
    return false;
  }
  return true;
}

async function enforceDuplicateGuard(workspaceId: string, userId: string, prompt: string) {
  const admin = createAdminClient();
  const threshold = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const { data, error } = await admin
    .from("marketing_director_commands")
    .select("id,prompt,created_at")
    .eq("workspace_id", workspaceId)
    .eq("actor_user_id", userId)
    .gte("created_at", threshold)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(`COMMAND_DUPLICATE_LOOKUP_FAILED:${error.message}`);
  }

  const normalizedPrompt = prompt.trim().toLowerCase();
  const existing = (data as Array<{ id: string; prompt: string | null; created_at: string | null }> | null) || [];
  const duplicate = existing.find((item) => String(item.prompt || "").trim().toLowerCase() === normalizedPrompt);
  if (duplicate) {
    throw new Error("COMMAND_DUPLICATE:Duplicate request in short window.");
  }
}

function initialActivityEvents(input: {
  planId: string;
  userId: string;
  request: string;
  generatedAt: string;
}): CommandActivityEvent[] {
  return [
    {
      id: `${input.planId}_request`,
      status: "request",
      timestamp: input.generatedAt,
      userId: input.userId,
      planId: input.planId,
      request: input.request,
      details: "Request submitted to Marketing Director.",
    },
    {
      id: `${input.planId}_plan_generated`,
      status: "plan_generated",
      timestamp: input.generatedAt,
      userId: input.userId,
      planId: input.planId,
      request: input.request,
      details: "Structured plan generated in proposal-only mode.",
    },
  ];
}

export async function POST(request: Request) {
  let workspaceId = "";
  let userId = "";
  let promptLength = 0;

  try {
    const context = await requireWorkspaceContext();
    workspaceId = context.workspaceId;
    userId = context.userId;

    const modeSettings = await getMarketingModeSettings(workspaceId);

    const body = (await request.json().catch(() => null)) as CommandBody | null;
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return errorResponse(400, "INVALID_PROMPT", "Command prompt is required.");
    }
    if (prompt.length > COMMAND_PROMPT_MAX_LENGTH) {
      return errorResponse(400, "PROMPT_TOO_LONG", `Prompt must be ${COMMAND_PROMPT_MAX_LENGTH} characters or fewer.`);
    }

    promptLength = prompt.length;

    const withinLimit = await enforceRequestLimit(workspaceId, userId);
    if (!withinLimit) {
      return errorResponse(429, "REQUEST_LIMITED", "Command limit reached. Try again in about an hour.");
    }

    await enforceDuplicateGuard(workspaceId, userId, prompt);

    const dashboard = await loadMarketingDirectorDashboard({
      workspaceId,
      firstName: context.firstName,
      workspaceName: context.workspaceName,
      refreshBrief: false,
    });

    const { plan: structuredPlan, source: planSource } = await buildMarketingDirectorCommandPlan({
      prompt,
      dashboard,
      modeSettings,
      workspaceId,
      workspaceName: context.workspaceName,
    });

    const detectedIntent = classifyIntent(prompt);

    const admin = createAdminClient();

    let metadata: Record<string, unknown> = {
      policy: "proposal_only",
      requiresApproval: true,
      promptLength,
      requestClass: structuredPlan.requestClass,
      conversation: {
        sessionId: `session_${structuredPlan.planId}`,
      },
      activity: [],
    };

    for (const event of initialActivityEvents({
      planId: structuredPlan.planId,
      userId,
      request: prompt,
      generatedAt: structuredPlan.generatedAt,
    })) {
      metadata = appendCommandActivity(metadata, {
        status: event.status,
        timestamp: event.timestamp,
        userId: event.userId,
        planId: event.planId,
        request: event.request,
        details: event.details,
      });
    }

    const { data: insertedCommand, error: commandInsertError } = await admin.from("marketing_director_commands").insert({
      workspace_id: workspaceId,
      actor_user_id: userId,
      prompt,
      mode: modeSettings.operatingMode,
      detected_intent: detectedIntent,
      proposal: structuredPlan,
      status: "PROPOSED",
      metadata,
    } as never).select("id").single();

    if (commandInsertError) {
      throw new Error(`COMMAND_INSERT_FAILED:${commandInsertError.message}`);
    }

    const { error: usageInsertError } = await admin.from("ai_usage_events").insert({
      account_id: workspaceId,
      user_id: userId,
      provider: "internal",
      model: "marketing-director-router-v1",
      feature: "marketing_director_command_center",
      operation: "structured_plan",
      status: "SUCCEEDED",
      input_units: prompt.length,
      output_units: 0,
      credits_charged: 0,
      estimated_cost_cents: 0,
      actual_cost_cents: 0,
      duration_ms: 0,
      metadata: {
        mode: modeSettings.operatingMode,
        detectedIntent,
        requestClass: structuredPlan.requestClass,
        planId: structuredPlan.planId,
        proposalOnly: true,
        planningSource: planSource,
      },
    } as never);

    if (usageInsertError) {
      throw new Error(`COMMAND_USAGE_LOG_FAILED:${usageInsertError.message}`);
    }

    return NextResponse.json({
      ok: true,
      code: "PLAN_READY",
      mode: modeSettings.operatingMode,
      policy: "proposal_only",
      proposal: structuredPlan,
      commandId: (insertedCommand as { id?: string } | null)?.id || null,
      message: "Proposal ready. No actions were executed.",
    });
  } catch (error) {
    console.error("MARKETING_DIRECTOR_COMMAND_FAILED");
    console.error(error);
    console.error(error instanceof Error ? error.stack : undefined);

    const safeMessage = safeError(error);

    return NextResponse.json(
      {
        ok: false,
        code: "REQUEST_FAILED",
        error: safeMessage,
        stack:
          process.env.NODE_ENV !== "production"
            ? error instanceof Error
              ? error.stack
              : null
            : undefined,
      },
      { status: 500 }
    );
  }
}
