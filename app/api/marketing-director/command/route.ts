import { NextResponse } from "next/server";
import {
  COMMAND_PROMPT_MAX_LENGTH,
  buildCommandPlan,
} from "@/features/marketing-director/command-router";
import { getMarketingModeSettings } from "@/features/marketing-director/modes";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { createAdminClient } from "@/lib/supabase/admin";

const REQUEST_LIMIT_PER_USER_PER_HOUR = 30;

type CommandBody = {
  prompt?: unknown;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  if (message.startsWith("AUTH_REQUIRED:")) return "Sign in required.";
  if (message.startsWith("WORKSPACE_REQUIRED:")) return "Complete Business Setup first.";
  if (message.startsWith("WORKSPACE_LOOKUP_FAILED:")) return "Workspace lookup failed.";
  if (message.startsWith("COMMAND_TOO_LONG:")) return `Prompt must be ${COMMAND_PROMPT_MAX_LENGTH} characters or fewer.`;
  if (message.startsWith("COMMAND_INVALID:")) return "Command prompt is required.";
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
      return badRequest("Command prompt is required.");
    }
    if (prompt.length > COMMAND_PROMPT_MAX_LENGTH) {
      return badRequest(`Prompt must be ${COMMAND_PROMPT_MAX_LENGTH} characters or fewer.`);
    }

    promptLength = prompt.length;

    const withinLimit = await enforceRequestLimit(workspaceId, userId);
    if (!withinLimit) {
      return NextResponse.json(
        {
          ok: false,
          error: "Command limit reached. Try again in about an hour.",
        },
        { status: 429 },
      );
    }

    const proposal = buildCommandPlan(prompt);
    const admin = createAdminClient();

    const { error: commandInsertError } = await admin.from("marketing_director_commands").insert({
      workspace_id: workspaceId,
      actor_user_id: userId,
      prompt,
      mode: modeSettings.operatingMode,
      detected_intent: proposal.detectedIntent,
      proposal,
      status: "PROPOSED",
      metadata: {
        policy: "proposal_only",
        requiresApproval: proposal.requiresApproval,
        promptLength,
      },
    } as never);

    if (commandInsertError) {
      throw new Error(`COMMAND_INSERT_FAILED:${commandInsertError.message}`);
    }

    const { error: usageInsertError } = await admin.from("ai_usage_events").insert({
      account_id: workspaceId,
      user_id: userId,
      provider: "internal",
      model: "marketing-director-router-v1",
      feature: "marketing_director_command_center",
      operation: "proposal_only",
      status: "SUCCEEDED",
      input_units: prompt.length,
      output_units: 0,
      credits_charged: 0,
      estimated_cost_cents: 0,
      actual_cost_cents: 0,
      duration_ms: 0,
      metadata: {
        mode: modeSettings.operatingMode,
        detectedIntent: proposal.detectedIntent,
        proposalOnly: true,
      },
    } as never);

    if (usageInsertError) {
      throw new Error(`COMMAND_USAGE_LOG_FAILED:${usageInsertError.message}`);
    }

    return NextResponse.json({
      ok: true,
      mode: modeSettings.operatingMode,
      policy: "proposal_only",
      proposal,
      message: "Proposal ready. No actions were executed.",
    });
  } catch (error) {
    if (workspaceId && userId) {
      const admin = createAdminClient();
      await admin.from("ai_usage_events").insert({
        account_id: workspaceId,
        user_id: userId,
        provider: "internal",
        model: "marketing-director-router-v1",
        feature: "marketing_director_command_center",
        operation: "proposal_only",
        status: "FAILED",
        input_units: promptLength,
        output_units: 0,
        credits_charged: 0,
        estimated_cost_cents: 0,
        actual_cost_cents: 0,
        duration_ms: 0,
        metadata: {
          reason: safeError(error),
        },
      } as never);
    }

    return NextResponse.json(
      {
        ok: false,
        error: safeError(error),
      },
      {
        status: 400,
      },
    );
  }
}
