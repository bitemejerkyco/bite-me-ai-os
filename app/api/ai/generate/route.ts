import { NextResponse } from "next/server";
import {
  buildMarketingPrompt,
  extractResponseText,
  parseAIContentRequest,
} from "@/features/core/ai-content";
import { createClient } from "@/lib/supabase/server";
import { buildAgentPrompt } from "@/features/core/agent-prompts";

const PROMPT_VERSION = "postmotive-content-v2";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI is not configured. Add OPENAI_API_KEY to .env.local." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const input = parseAIContentRequest(body);
  if (!input) {
    return NextResponse.json(
      { error: "Complete the channel, objective, and business setup first." },
      { status: 400 },
    );
  }

  let workspaceId: string | null = null;
  const learningSignals: string[] = [];
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (workspace?.id) {
    workspaceId = workspace.id;
    const { data: feedback } = await supabase
      .from("content_feedback")
      .select("signal,reason,notes,channel,entry_type")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(40);
    const positiveReasons = new Set<string>();
    const negativeReasons = new Set<string>();
    let editedCount = 0;
    for (const item of feedback || []) {
      const detail = [item.reason, item.notes].filter(Boolean).join(": ").slice(0, 220);
      if (item.signal === "POSITIVE" && detail) positiveReasons.add(detail);
      if (item.signal === "NEGATIVE" && detail) negativeReasons.add(detail);
      if (item.signal === "EDITED") editedCount += 1;
    }
    if (positiveReasons.size) {
      learningSignals.push(
        `Users approved these qualities: ${[...positiveReasons].slice(0, 3).join("; ")}`,
      );
    }
    if (negativeReasons.size) {
      learningSignals.push(
        `Users asked to avoid or improve: ${[...negativeReasons].slice(0, 3).join("; ")}`,
      );
    }
    if (editedCount) {
      learningSignals.push(
        `${editedCount} recent drafts were edited by a human before use; preserve brand facts and favor concise, editable copy.`,
      );
    }
    const { data: knowledge } = await supabase
      .from("content_knowledge")
      .select("entry_type,channel,title,content,score,grade,confidence,strengths")
      .eq("workspace_id", workspace.id)
      .eq("active", true)
      .gte("score", 75)
      .in("confidence", ["MEDIUM", "HIGH"])
      .order("score", { ascending: false })
      .limit(5);
    for (const winner of knowledge || []) {
      learningSignals.push(
        `Proven ${winner.entry_type === "AD" ? "ad" : "post"} winner for ${winner.channel} (score ${winner.score}, grade ${winner.grade}): ${winner.title}. Strengths: ${(winner.strengths || []).join(", ")}. Winning copy pattern: ${String(winner.content).slice(0, 180)}`,
      );
    }
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.6-sol";
  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions:
        "You are the marketing content engine for PostMotive. Follow the supplied business facts and compliance requirement. Never invent discounts, prices, certifications, customer claims, or legal approval.",
      input: buildAgentPrompt({
        jobType: "CONTENT",
        businessName: input.workspace.businessName,
        channel: input.channel,
        objective: input.objective,
        roles: [
          "PROMPT_DIRECTOR",
          "BRAND_STRATEGIST",
          "CHANNEL_SPECIALIST",
          "COPYWRITER",
          "COMPLIANCE_REVIEWER",
          "PERFORMANCE_ANALYST",
        ],
        facts: [
          `Website: ${input.workspace.website || "not supplied"}`,
          `Audience: ${input.workspace.audience || "not supplied"}`,
          `Brand voice: ${input.workspace.voice || "not supplied"}`,
          `Industry: ${input.workspace.industry}`,
          `Entry type: ${input.entryType}`,
        ],
        constraints: [
          "Never invent discounts, prices, certifications, testimonials, customer claims, legal approval, or product facts.",
          "Keep paid ads approval-gated.",
          "Apply the selected industry's compliance mode and channel safety requirements.",
        ],
        learningSignals,
        requiredOutput: [
          "Return only the publishable marketing copy.",
          "Make the opening useful immediately and end with the requested call to action.",
        ],
        task: buildMarketingPrompt({ ...input, learningSignals: [] }),
      }),
      max_output_tokens: 700,
    }),
    cache: "no-store",
  });

  const payload: unknown = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "message" in payload.error &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : "OpenAI could not generate content.";
    return NextResponse.json({ error: message }, { status: upstream.status });
  }

  const copy = extractResponseText(payload);
  if (!copy) {
    return NextResponse.json(
      { error: "OpenAI returned an empty response. Please try again." },
      { status: 502 },
    );
  }

  const restricted = ["CANNABIS", "CBD", "ALCOHOL"].includes(
    input.workspace.industry,
  );
  const complianceNote = restricted
    ? "Compliance Mode was included in the AI prompt. Review local laws and channel rules before publishing."
    : "AI brand-safety guidance was applied. Verify pricing, claims, links, and offer terms before publishing.";
  let generationRunId: string | undefined;
  const userId = typeof claims.sub === "string" ? claims.sub : null;
  if (workspaceId && userId) {
    const { data: generationRun } = await supabase
      .from("ai_generation_runs")
      .insert({
        workspace_id: workspaceId,
        created_by: userId,
        entry_type: input.entryType,
        channel: input.channel,
        objective: input.objective,
        model,
        prompt_version: PROMPT_VERSION,
        generated_copy: copy,
        compliance_note: complianceNote,
      })
      .select("id")
      .single();
    generationRunId = generationRun?.id;
  }

  return NextResponse.json({
    title: `${input.workspace.businessName}: ${input.entryType === "AD" ? "Ad" : "Post"} · ${input.objective} for ${input.channel}`,
    copy,
    complianceNote,
    generationRunId,
    model,
    promptVersion: PROMPT_VERSION,
  });
}
