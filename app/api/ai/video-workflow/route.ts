import { NextResponse } from "next/server";
import { buildAgentPrompt } from "@/features/core/agent-prompts";
import { extractResponseText } from "@/features/core/ai-content";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { loadVideoRouterSettings } from "@/features/core/video-router-settings";
import { resolveVideoRouterProfile } from "@/features/core/video-router";
import {
  buildVideoPlanningPrompt,
  parseVideoPlanResponse,
  VIDEO_PROMPT_VERSION,
  type VideoProject,
} from "@/features/core/video-project";
import { startVideoProviderJob, getVideoProviderUnavailableMessage } from "@/features/core/video-provider";
import { buildShortVideoWorkflowKey } from "@/features/core/video-idempotency";

type WorkflowBody = {
  channel?: unknown;
  objective?: unknown;
  message?: unknown;
  callToAction?: unknown;
  durationSeconds?: unknown;
  voice?: unknown;
  musicMode?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asDuration(value: unknown): VideoProject["durationSeconds"] | null {
  const parsed = Number(value);
  return [8, 9, 10, 11, 12, 13, 14, 15].includes(parsed)
    ? (parsed as VideoProject["durationSeconds"])
    : null;
}

function normalizeHashtags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item)).filter(Boolean))].slice(0, 12);
}

async function generatePlan(input: {
  workspace: Record<string, unknown>;
  channel: VideoProject["channel"];
  objective: string;
  message: string;
  callToAction: string;
  durationSeconds: VideoProject["durationSeconds"];
  voice: VideoProject["voice"];
  musicMode: VideoProject["musicMode"];
}): Promise<{
  title: string;
  script: string;
  caption: string;
  renderPrompt: string;
  complianceNote: string;
  hashtags: string[];
  callToAction: string;
  scenes: VideoProject["scenes"];
}> {
  const env = getServerEnv();
  if (!env.openAiApiKey) {
    throw new Error("Video generation is temporarily unavailable.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openAiModel,
      instructions:
        "You are PostMotive's vertical-video planning engine. Return valid JSON only and obey all brand, rights, and compliance constraints.",
      input: buildAgentPrompt({
        jobType: "VIDEO_PLAN",
        businessName: text(input.workspace.businessName),
        channel: input.channel,
        objective: input.objective,
        roles: ["PROMPT_DIRECTOR", "BRAND_STRATEGIST", "CHANNEL_SPECIALIST", "CREATIVE_DIRECTOR", "COPYWRITER", "COMPLIANCE_REVIEWER"],
        facts: [
          `Website: ${text(input.workspace.website) || "not supplied"}`,
          `Audience: ${text(input.workspace.audience) || "not supplied"}`,
          `Brand voice: ${text(input.workspace.voice) || "not supplied"}`,
          `Industry: ${text(input.workspace.industry) || "GENERAL_RETAIL"}`,
          `Duration: ${input.durationSeconds} seconds`,
          `Voice: ${input.voice}`,
          `Music mode: ${input.musicMode}`,
          `Call to action: ${input.callToAction}`,
        ],
        constraints: [
          "Create original 9:16 vertical-video material.",
          "Do not use real-person likenesses, celebrities, copyrighted characters, copyrighted music, or third-party watermarks.",
          "Never invent prices, discounts, certifications, testimonials, legal approval, or product claims.",
          "Include readable on-screen captions and a safe human-review note.",
        ],
        requiredOutput: [
          "Return strict JSON only.",
          "Include title, script, caption, hashtags, callToAction, renderPrompt, complianceNote, and scenes.",
          "Scene durations must total the requested duration.",
        ],
        task: buildVideoPlanningPrompt({
          workspace: input.workspace as never,
          channel: input.channel,
          objective: input.objective,
          message: input.message,
          callToAction: input.callToAction,
          durationSeconds: input.durationSeconds,
          voice: input.voice,
          musicMode: input.musicMode,
        }),
      }),
      max_output_tokens: 1800,
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  const plan = parseVideoPlanResponse(extractResponseText(payload));
  if (!response.ok || !plan) {
    throw new Error("Video generation is temporarily unavailable.");
  }

  return {
    ...plan,
    hashtags: normalizeHashtags((plan as { hashtags?: unknown }).hashtags),
    callToAction: plan.callToAction || input.callToAction,
  };
}

async function upsertDraft(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  workspaceId: string;
  userId: string;
  projectId: string;
  title: string;
  objective: string;
  channel: string;
  copy: string;
  hashtags: string[];
  callToAction: string;
}) {
  const existing = await input.supabase
    .from("content_drafts")
    .select("id")
    .eq("video_project_id", input.projectId)
    .maybeSingle();
  if (existing.error) {
    throw new Error(existing.error.message);
  }

  const payload = {
    workspace_id: input.workspaceId,
    created_by: input.userId,
    channel: input.channel,
    objective: input.objective,
    title: input.title,
    copy: input.copy,
    compliance_note: "Review the video, captions, claims, and posting settings before publishing.",
    status: "DRAFT",
    entry_type: "POST",
    original_copy: input.copy,
    model: "video-workflow",
    prompt_version: VIDEO_PROMPT_VERSION,
    content_format: "VERTICAL_VIDEO",
    video_project_id: input.projectId,
    media_storage_path: null,
    metadata: {
      hashtags: input.hashtags,
      callToAction: input.callToAction,
      workflow: "short-video",
      videoProjectId: input.projectId,
    },
  } as never;

  if (existing.data?.id) {
    const { error } = await input.supabase
      .from("content_drafts")
      .update({
        copy: input.copy,
        original_copy: input.copy,
        metadata: {
          hashtags: input.hashtags,
          callToAction: input.callToAction,
          workflow: "short-video",
          videoProjectId: input.projectId,
        },
      } as never)
      .eq("id", existing.data.id);
    if (error) throw new Error(error.message);
    return existing.data.id;
  }

  const { data, error } = await input.supabase.from("content_drafts").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return String((data as { id?: string } | null)?.id || "");
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims;
    if (!user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as WorkflowBody | null;
    const channel = text(body?.channel) as VideoProject["channel"];
    const objective = text(body?.objective);
    const message = text(body?.message);
    const callToAction = text(body?.callToAction);
    const durationSeconds = asDuration(body?.durationSeconds);
    const voice = text(body?.voice) as VideoProject["voice"];
    const musicMode = text(body?.musicMode) as VideoProject["musicMode"];

    if (!durationSeconds || !["TikTok", "Instagram Reels", "Facebook Reels"].includes(channel) || !objective || !message || !callToAction) {
      return NextResponse.json({ error: "Complete the short-video brief first." }, { status: 400 });
    }

    const { data: workspaceId, error: workspaceError } = await supabase.rpc("my_primary_workspace_id");
    if (workspaceError || !workspaceId) {
      return NextResponse.json({ error: "Save Business Setup before generating video." }, { status: 400 });
    }

    const workflow = buildShortVideoWorkflowKey({
      workspaceId: String(workspaceId),
      channel,
      objective,
      message,
      callToAction,
      durationSeconds,
      voice,
      musicMode,
    });

    const existing = await supabase
      .from("video_projects")
      .select("id,content_draft_id,workflow_key,credit_request_id,title,channel,objective,prompt,script,caption,hashtags,call_to_action,scenes,duration_seconds,aspect_ratio,voice,voice_disclosure,music_mode,licensed_music_asset_id,provider,routing_tier,provider_model,provider_job_id,provider_progress,video_storage_path,voiceover_storage_path,status,failure_reason,created_at,updated_at")
      .eq("workspace_id", workspaceId)
      .eq("workflow_key", workflow)
      .maybeSingle();
    if (existing.error) {
      return NextResponse.json({ error: "Video generation is temporarily unavailable." }, { status: 503 });
    }

    if (existing.data && ["GENERATING", "READY", "APPROVED"].includes(String(existing.data.status || ""))) {
      return NextResponse.json({
        ok: true,
        status: existing.data.status,
        projectId: existing.data.id,
        draftId: existing.data.content_draft_id,
        workflowKey: existing.data.workflow_key,
      });
    }

    const plan = await generatePlan({
      workspace: {
        businessName: (existing.data as { title?: string } | null)?.title || "",
        website: "",
        industry: "GENERAL_RETAIL",
        primaryGoal: objective,
        audience: "",
        voice: "",
      },
      channel,
      objective,
      message,
      callToAction,
      durationSeconds,
      voice,
      musicMode,
    });

    const routerSettings = await loadVideoRouterSettings();
    const profile = resolveVideoRouterProfile({
      requestedTier: null,
      mode: routerSettings.mode,
      seconds: durationSeconds,
      settings: routerSettings,
    });

    const projectId = existing.data?.id || crypto.randomUUID();
    const creditRequestId = existing.data?.credit_request_id || crypto.randomUUID();
    if (!existing.data?.credit_request_id) {
      const reservation = await supabase.rpc("reserve_my_video_credits", {
        video_seconds: durationSeconds,
        credit_request_id: creditRequestId,
      });
      if (reservation.error) {
        return NextResponse.json({ error: reservation.error.message }, { status: 402 });
      }
    }

    const { error: projectError } = await supabase.from("video_projects").upsert({
      id: projectId,
      workspace_id: workspaceId,
      content_draft_id: existing.data?.content_draft_id || null,
      workflow_key: workflow,
      credit_request_id: creditRequestId,
      created_by: user.sub,
      title: plan.title,
      channel,
      objective,
      prompt: plan.renderPrompt,
      script: plan.script,
      caption: plan.caption,
      hashtags: plan.hashtags,
      call_to_action: plan.callToAction,
      scenes: plan.scenes,
      duration_seconds: durationSeconds,
      aspect_ratio: "9:16",
      voice,
      voice_disclosure: true,
      music_mode: musicMode,
      licensed_music_asset_id: null,
      provider: profile.providerKey,
      routing_tier: profile.tier,
      provider_model: profile.model,
      provider_job_id: null,
      provider_progress: 0,
      video_storage_path: null,
      voiceover_storage_path: null,
      status: "GENERATING",
      failure_reason: null,
    } as never);
    if (projectError) {
      return NextResponse.json({ error: "Video generation is temporarily unavailable." }, { status: 503 });
    }

    const providerJob =
      profile.providerKey === "REPLICATE"
        ? await startVideoProviderJob({
            providerKey: profile.providerKey,
            model: profile.model,
            prompt: plan.renderPrompt,
            seconds: durationSeconds,
          })
        : { providerJobId: crypto.randomUUID(), status: "queued" as const, progress: 0, providerKey: profile.providerKey, model: profile.model };

    const { error: updateError } = await supabase.from("video_projects").update({
      provider_job_id: providerJob.providerJobId,
      provider_progress: providerJob.progress,
      provider: providerJob.providerKey,
      provider_model: providerJob.model,
      status: "GENERATING",
      updated_at: new Date().toISOString(),
    } as never).eq("id", projectId);
    if (updateError) {
      return NextResponse.json({ error: "Video generation is temporarily unavailable." }, { status: 503 });
    }

    const draftCopy = [
      `Caption: ${plan.caption}`,
      `CTA: ${plan.callToAction}`,
      plan.hashtags.length ? `Hashtags: ${plan.hashtags.join(" ")}` : "",
      `Script: ${plan.script}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const draftId = await upsertDraft({
      supabase,
      workspaceId: String(workspaceId),
      userId: user.sub,
      projectId,
      title: plan.title,
      objective,
      channel,
      copy: draftCopy,
      hashtags: plan.hashtags,
      callToAction: plan.callToAction,
    });

    await supabase.from("video_projects").update({ content_draft_id: draftId } as never).eq("id", projectId);

    return NextResponse.json({
      ok: true,
      status: providerJob.status,
      projectId,
      draftId,
      workflowKey: workflow,
      providerJobId: providerJob.providerJobId,
      tier: profile.tier,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    return NextResponse.json(
      { ok: false, error: message.includes("temporarily unavailable") ? message : getVideoProviderUnavailableMessage() },
      { status: 503 },
    );
  }
}