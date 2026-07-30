import { NextResponse } from "next/server";
import { extractResponseText } from "@/features/core/ai-content";
import {
  buildVideoPlanningPrompt,
  parseVideoPlanInput,
  parseVideoPlanResponse,
  VIDEO_PROMPT_VERSION,
} from "@/features/core/video-project";
import { createClient } from "@/lib/supabase/server";
import { buildAgentPrompt } from "@/features/core/agent-prompts";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI is not configured." },
      { status: 503 },
    );
  }
  const input = parseVideoPlanInput(await request.json().catch(() => null));
  if (!input) {
    return NextResponse.json(
      { error: "Complete the video brief first." },
      { status: 400 },
    );
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
        "You are PostMotive's vertical-video planning engine. Return valid JSON only and obey all brand, rights, and compliance constraints.",
      input: buildAgentPrompt({
        jobType: "VIDEO_PLAN",
        businessName: input.workspace.businessName,
        channel: input.channel,
        objective: input.objective,
        roles: [
          "PROMPT_DIRECTOR",
          "BRAND_STRATEGIST",
          "CHANNEL_SPECIALIST",
          "CREATIVE_DIRECTOR",
          "COPYWRITER",
          "COMPLIANCE_REVIEWER",
        ],
        facts: [
          `Website: ${input.workspace.website || "not supplied"}`,
          `Audience: ${input.workspace.audience || "not supplied"}`,
          `Brand voice: ${input.workspace.voice || "not supplied"}`,
          `Industry: ${input.workspace.industry}`,
          `Duration: ${input.durationSeconds} seconds`,
          `Voice: ${input.voice}`,
          `Music mode: ${input.musicMode}`,
        ],
        constraints: [
          "Create original 9:16 vertical-video material.",
          "Do not use real-person likenesses, celebrities, copyrighted characters, copyrighted music, or third-party watermarks.",
          "Never invent prices, discounts, certifications, testimonials, legal approval, or product claims.",
          "Include readable on-screen captions and a safe human-review note.",
        ],
        requiredOutput: [
          "Return strict JSON only.",
          "Include title, script, caption, renderPrompt, complianceNote, and scenes.",
          "Scene durations must total the requested duration.",
        ],
        task: buildVideoPlanningPrompt(input),
      }),
      max_output_tokens: 1800,
    }),
    cache: "no-store",
  });
  const payload: unknown = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return NextResponse.json(
      { error: "OpenAI could not create the video plan." },
      { status: upstream.status },
    );
  }
  const plan = parseVideoPlanResponse(extractResponseText(payload));
  if (!plan) {
    return NextResponse.json(
      { error: "The video plan was incomplete. Please try again." },
      { status: 502 },
    );
  }
  return NextResponse.json({
    ...plan,
    model,
    promptVersion: VIDEO_PROMPT_VERSION,
  });
}
