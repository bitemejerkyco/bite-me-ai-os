import { NextResponse } from "next/server";
import { buildAgentPrompt } from "@/features/core/agent-prompts";
import { extractResponseText } from "@/features/core/ai-content";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { loadVideoRouterSettings } from "@/features/core/video-router-settings";
import { resolveVideoRouterProfile } from "@/features/core/video-router";
import {
  buildVideoPlanningPrompt,
  parseVideoPlanResponseDetailed,
  parseVideoPlanResponse,
  VIDEO_PROMPT_VERSION,
  type VideoCreditStatusState,
  type VideoPlanParseFailureCategory,
  type VideoProject,
  type VideoWorkflowStage,
} from "@/features/core/video-project";
import {
  fetchVideoProviderJob,
  getVideoProviderUnavailableMessage,
  startVideoProviderJob,
} from "@/features/core/video-provider";
import { buildShortVideoWorkflowKey } from "@/features/core/video-idempotency";

type WorkflowBody = {
  channel?: unknown;
  objective?: unknown;
  message?: unknown;
  callToAction?: unknown;
  durationSeconds?: unknown;
  voice?: unknown;
  musicMode?: unknown;
  workflowKey?: unknown;
  projectId?: unknown;
  retry?: unknown;
};

type VideoProjectRow = {
  id: string;
  workspace_id: string;
  content_draft_id: string | null;
  workflow_key: string | null;
  credit_request_id: string | null;
  title: string;
  channel: string;
  objective: string;
  prompt: string;
  script: string;
  caption: string;
  hashtags: string[] | null;
  call_to_action: string | null;
  scenes: unknown;
  duration_seconds: number;
  voice: string;
  music_mode: string;
  provider: string;
  routing_tier: string | null;
  provider_model: string | null;
  provider_job_id: string | null;
  provider_job_status: "queued" | "in_progress" | "completed" | "failed" | null;
  provider_progress: number | null;
  status: string;
  failure_reason: string | null;
  failure_reference_id: string | null;
  workflow_stage: VideoWorkflowStage | null;
  workflow_percentage: number | null;
  credit_status: VideoCreditStatusState | null;
  credit_refunded_at: string | null;
  media_asset_id: string | null;
  video_storage_path: string | null;
  workflow_started_at: string | null;
  workflow_completed_at: string | null;
  updated_at: string;
};

type MediaAssetRow = {
  id: string;
  storage_path: string;
};

const SAFE_FAILURE_MESSAGE = "Video generation didn't complete.";
const SAFE_TRANSIENT_ERROR = "Video generation is temporarily unavailable.";
const STAGE_PROGRESS: Record<VideoWorkflowStage, number> = {
  PREPARING_VIDEO_PLAN: 8,
  RESERVING_CREDITS: 18,
  STARTING_VIDEO_GENERATOR: 30,
  GENERATING_SCENES: 45,
  RENDERING_FINAL_VIDEO: 75,
  SAVING_TO_MEDIA_LIBRARY: 92,
  CREATING_CONTENT_LIBRARY_DRAFT: 97,
  COMPLETE: 100,
  FAILED: 0,
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

function sanitizeWorkflowKey(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().slice(0, 240);
}

function newFailureReferenceId(): string {
  return `vf-${crypto.randomUUID().slice(0, 8)}`;
}

function toStageProgress(stage: VideoWorkflowStage, current?: number | null): number {
  const base = STAGE_PROGRESS[stage] ?? 0;
  const safeCurrent = Number.isFinite(Number(current)) ? Number(current) : 0;
  return Math.max(base, Math.min(100, Math.max(0, safeCurrent)));
}

function computeGenerationProgress(providerProgress: number, current?: number | null): number {
  const baseline = 40 + Math.round(Math.max(0, Math.min(100, providerProgress)) * 0.48);
  const candidate = Math.min(89, Math.max(40, baseline));
  const existing = Number.isFinite(Number(current)) ? Number(current) : 0;
  return Math.max(existing, candidate);
}

function safeError(message?: string): string {
  if (!message) return SAFE_TRANSIENT_ERROR;
  return message.includes("temporarily unavailable")
    ? SAFE_TRANSIENT_ERROR
    : SAFE_TRANSIENT_ERROR;
}

function logVideoPlanFailure(input: {
  stage: "openai_request_failed" | "openai_response_failed" | "plan_parse_failed";
  openAiStatus: number | null;
  openAiRequestId: string | null;
  extractedTextEmpty: boolean;
  parseFailureCategory: VideoPlanParseFailureCategory | null;
  model: string;
}) {
  console.error("[video-workflow] plan-failure", {
    stage: input.stage,
    openAiStatus: input.openAiStatus,
    openAiRequestId: input.openAiRequestId,
    extractedTextEmpty: input.extractedTextEmpty,
    parseFailureCategory: input.parseFailureCategory,
    model: input.model,
  });
}

function logStageTransition(input: {
  projectId: string;
  workflowKey: string;
  stage: VideoWorkflowStage;
  progress: number;
  status: string;
  providerStatus?: string | null;
}) {
  console.info("[video-workflow] stage-transition", {
    projectId: input.projectId,
    workflowKey: input.workflowKey,
    stage: input.stage,
    progress: input.progress,
    status: input.status,
    providerStatus: input.providerStatus || null,
  });
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
    throw new Error(SAFE_TRANSIENT_ERROR);
  }

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
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
  } catch {
    logVideoPlanFailure({
      stage: "openai_request_failed",
      openAiStatus: null,
      openAiRequestId: null,
      extractedTextEmpty: true,
      parseFailureCategory: null,
      model: env.openAiModel,
    });
    throw new Error(SAFE_TRANSIENT_ERROR);
  }

  const payload = await response.json().catch(() => null);
  const extractedText = extractResponseText(payload);
  const parsedPlan = parseVideoPlanResponseDetailed(extractedText);
  const requestId = response.headers.get("x-request-id")
    || response.headers.get("openai-request-id")
    || null;

  if (!response.ok) {
    logVideoPlanFailure({
      stage: "openai_response_failed",
      openAiStatus: response.status,
      openAiRequestId: requestId,
      extractedTextEmpty: extractedText.trim().length === 0,
      parseFailureCategory: parsedPlan.failureCategory,
      model: env.openAiModel,
    });
    throw new Error(SAFE_TRANSIENT_ERROR);
  }

  const plan = parsedPlan.plan || parseVideoPlanResponse(extractedText);
  if (!plan) {
    logVideoPlanFailure({
      stage: "plan_parse_failed",
      openAiStatus: response.status,
      openAiRequestId: requestId,
      extractedTextEmpty: extractedText.trim().length === 0,
      parseFailureCategory: parsedPlan.failureCategory,
      model: env.openAiModel,
    });
    throw new Error(SAFE_TRANSIENT_ERROR);
  }

  return {
    ...plan,
    hashtags: normalizeHashtags((plan as { hashtags?: unknown }).hashtags),
    callToAction: plan.callToAction || input.callToAction,
  };
}

async function getAuthContext() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims;
  return { supabase, user };
}

async function lookupProject(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  workspaceId: string;
  projectId?: string;
  workflowKey?: string;
}) {
  if (input.projectId) {
    const byId = await input.supabase
      .from("video_projects")
      .select("id,workspace_id,content_draft_id,workflow_key,credit_request_id,title,channel,objective,prompt,script,caption,hashtags,call_to_action,scenes,duration_seconds,voice,music_mode,provider,routing_tier,provider_model,provider_job_id,provider_job_status,provider_progress,status,failure_reason,failure_reference_id,workflow_stage,workflow_percentage,credit_status,credit_refunded_at,media_asset_id,video_storage_path,workflow_started_at,workflow_completed_at,updated_at")
      .eq("workspace_id", input.workspaceId)
      .eq("id", input.projectId)
      .maybeSingle();
    if (byId.error) throw new Error(byId.error.message);
    return (byId.data as VideoProjectRow | null) || null;
  }
  if (input.workflowKey) {
    const byWorkflow = await input.supabase
      .from("video_projects")
      .select("id,workspace_id,content_draft_id,workflow_key,credit_request_id,title,channel,objective,prompt,script,caption,hashtags,call_to_action,scenes,duration_seconds,voice,music_mode,provider,routing_tier,provider_model,provider_job_id,provider_job_status,provider_progress,status,failure_reason,failure_reference_id,workflow_stage,workflow_percentage,credit_status,credit_refunded_at,media_asset_id,video_storage_path,workflow_started_at,workflow_completed_at,updated_at")
      .eq("workspace_id", input.workspaceId)
      .eq("workflow_key", input.workflowKey)
      .maybeSingle();
    if (byWorkflow.error) throw new Error(byWorkflow.error.message);
    return (byWorkflow.data as VideoProjectRow | null) || null;
  }
  return null;
}

async function updateProjectWorkflow(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  projectId: string;
  workflowKey: string;
  stage: VideoWorkflowStage;
  progress: number;
  status?: string;
  providerStatus?: string | null;
  creditStatus?: VideoCreditStatusState;
  failureReason?: string | null;
  failureReferenceId?: string | null;
  creditRefundedAt?: string | null;
  mediaAssetId?: string | null;
  videoStoragePath?: string | null;
  contentDraftId?: string | null;
  providerProgress?: number | null;
  providerJobId?: string | null;
  workflowCompletedAt?: string | null;
}) {
  const payload: Record<string, unknown> = {
    workflow_stage: input.stage,
    workflow_percentage: Math.max(0, Math.min(100, Math.round(input.progress))),
    updated_at: new Date().toISOString(),
  };
  if (input.status !== undefined) payload.status = input.status;
  if (input.providerStatus !== undefined) payload.provider_job_status = input.providerStatus;
  if (input.creditStatus !== undefined) payload.credit_status = input.creditStatus;
  if (input.failureReason !== undefined) payload.failure_reason = input.failureReason;
  if (input.failureReferenceId !== undefined) payload.failure_reference_id = input.failureReferenceId;
  if (input.creditRefundedAt !== undefined) payload.credit_refunded_at = input.creditRefundedAt;
  if (input.mediaAssetId !== undefined) payload.media_asset_id = input.mediaAssetId;
  if (input.videoStoragePath !== undefined) payload.video_storage_path = input.videoStoragePath;
  if (input.contentDraftId !== undefined) payload.content_draft_id = input.contentDraftId;
  if (input.providerProgress !== undefined) payload.provider_progress = input.providerProgress;
  if (input.providerJobId !== undefined) payload.provider_job_id = input.providerJobId;
  if (input.workflowCompletedAt !== undefined) payload.workflow_completed_at = input.workflowCompletedAt;
  if (input.providerStatus !== undefined) payload.last_provider_poll_at = new Date().toISOString();

  const { error } = await input.supabase
    .from("video_projects")
    .update(payload as never)
    .eq("id", input.projectId);
  if (error) throw new Error(error.message);

  logStageTransition({
    projectId: input.projectId,
    workflowKey: input.workflowKey,
    stage: input.stage,
    progress: Number(payload.workflow_percentage),
    status: String(payload.status || "GENERATING"),
    providerStatus: (payload.provider_job_status as string | null) || null,
  });
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
  mediaStoragePath: string;
}) {
  const existing = await input.supabase
    .from("content_drafts")
    .select("id")
    .eq("video_project_id", input.projectId)
    .maybeSingle();
  if (existing.error) {
    throw new Error(existing.error.message);
  }

  const metadata = {
    hashtags: input.hashtags,
    callToAction: input.callToAction,
    workflow: "short-video",
    videoProjectId: input.projectId,
  };

  if (existing.data?.id) {
    const { error } = await input.supabase
      .from("content_drafts")
      .update({
        copy: input.copy,
        original_copy: input.copy,
        media_storage_path: input.mediaStoragePath,
        metadata,
      } as never)
      .eq("id", existing.data.id);
    if (error) throw new Error(error.message);
    return String(existing.data.id);
  }

  const { data, error } = await input.supabase
    .from("content_drafts")
    .insert({
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
      media_storage_path: input.mediaStoragePath,
      metadata,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return String((data as { id?: string } | null)?.id || "");
}

async function ensureGeneratedMediaAsset(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  workspaceId: string;
  userId: string;
  project: VideoProjectRow;
  outputUrl: string;
}): Promise<MediaAssetRow> {
  const existing = await input.supabase
    .from("media_assets")
    .select("id,storage_path")
    .eq("workspace_id", input.workspaceId)
    .eq("generation_job_id", String(input.project.provider_job_id || ""))
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    return existing.data as MediaAssetRow;
  }

  const upstream = await fetch(input.outputUrl, { cache: "no-store" });
  if (!upstream.ok) {
    throw new Error("VIDEO_OUTPUT_UNAVAILABLE");
  }

  const bytes = new Uint8Array(await upstream.arrayBuffer());
  const storagePath = `${input.workspaceId}/${input.userId}/generated-${input.project.id}.mp4`;
  const upload = await input.supabase
    .storage
    .from("brand-media")
    .upload(storagePath, bytes, { upsert: false, contentType: "video/mp4" });

  if (upload.error) {
    throw new Error(upload.error.message);
  }

  const inserted = await input.supabase
    .from("media_assets")
    .insert({
      workspace_id: input.workspaceId,
      uploaded_by: input.userId,
      storage_path: storagePath,
      file_name: `${input.project.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 60) || "video"}.mp4`,
      asset_type: "video",
      mime_type: "video/mp4",
      size_bytes: bytes.byteLength,
      tags: ["video", "ai-generated", "vertical"],
      source: "GENERATED",
      generation_status: "READY",
      generation_job_id: input.project.provider_job_id,
      duration_seconds: input.project.duration_seconds,
      metadata: {
        videoProjectId: input.project.id,
        workflowKey: input.project.workflow_key,
      },
    } as never)
    .select("id,storage_path")
    .maybeSingle();

  if (inserted.error) {
    const collision = await input.supabase
      .from("media_assets")
      .select("id,storage_path")
      .eq("workspace_id", input.workspaceId)
      .eq("generation_job_id", String(input.project.provider_job_id || ""))
      .maybeSingle();
    if (!collision.error && collision.data) {
      return collision.data as MediaAssetRow;
    }
    throw new Error(inserted.error.message);
  }

  if (!inserted.data) {
    throw new Error("MEDIA_INSERT_FAILED");
  }
  return inserted.data as MediaAssetRow;
}

async function finalizeCompletedProject(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  project: VideoProjectRow;
  workspaceId: string;
  userId: string;
  providerOutputUrl: string;
  workflowKey: string;
}) {
  const existingMedia = input.project.media_asset_id && input.project.video_storage_path
    ? { id: input.project.media_asset_id, storage_path: input.project.video_storage_path }
    : await ensureGeneratedMediaAsset({
        supabase: input.supabase,
        workspaceId: input.workspaceId,
        userId: input.userId,
        project: input.project,
        outputUrl: input.providerOutputUrl,
      });

  await updateProjectWorkflow({
    supabase: input.supabase,
    projectId: input.project.id,
    workflowKey: input.workflowKey,
    stage: "SAVING_TO_MEDIA_LIBRARY",
    progress: toStageProgress("SAVING_TO_MEDIA_LIBRARY", input.project.workflow_percentage),
    status: "GENERATING",
    providerStatus: "completed",
    providerProgress: 100,
    mediaAssetId: existingMedia.id,
    videoStoragePath: existingMedia.storage_path,
    creditStatus: input.project.credit_status || "RESERVED",
  });

  const draftCopy = [
    `Caption: ${input.project.caption || ""}`,
    `CTA: ${input.project.call_to_action || ""}`,
    Array.isArray(input.project.hashtags) && input.project.hashtags.length
      ? `Hashtags: ${input.project.hashtags.join(" ")}`
      : "",
    `Script: ${input.project.script || ""}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const draftId = await upsertDraft({
    supabase: input.supabase,
    workspaceId: input.workspaceId,
    userId: input.userId,
    projectId: input.project.id,
    title: input.project.title,
    objective: input.project.objective,
    channel: input.project.channel,
    copy: draftCopy,
    hashtags: Array.isArray(input.project.hashtags) ? input.project.hashtags : [],
    callToAction: input.project.call_to_action || "",
    mediaStoragePath: existingMedia.storage_path,
  });

  await updateProjectWorkflow({
    supabase: input.supabase,
    projectId: input.project.id,
    workflowKey: input.workflowKey,
    stage: "COMPLETE",
    progress: 100,
    status: "READY",
    providerStatus: "completed",
    providerProgress: 100,
    mediaAssetId: existingMedia.id,
    videoStoragePath: existingMedia.storage_path,
    contentDraftId: draftId,
    workflowCompletedAt: new Date().toISOString(),
    creditStatus: input.project.credit_status || "RESERVED",
  });

  return { mediaAssetId: existingMedia.id, storagePath: existingMedia.storage_path, draftId };
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthContext();
    if (!user?.sub) {
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
    const requestedWorkflowKey = sanitizeWorkflowKey(body?.workflowKey);
    const requestedProjectId = text(body?.projectId);

    if (
      !durationSeconds
      || !["TikTok", "Instagram Reels", "Facebook Reels", "YouTube Shorts"].includes(channel)
      || !objective
      || !message
      || !callToAction
    ) {
      return NextResponse.json({ error: "Complete the short-video brief first." }, { status: 400 });
    }

    const { data: workspaceId, error: workspaceError } = await supabase.rpc("my_primary_workspace_id");
    if (workspaceError || !workspaceId) {
      return NextResponse.json({ error: "Save Business Setup before generating video." }, { status: 400 });
    }

    const workflowKey = requestedWorkflowKey || buildShortVideoWorkflowKey({
      workspaceId: String(workspaceId),
      channel,
      objective,
      message,
      callToAction,
      durationSeconds,
      voice,
      musicMode,
    });

    const existing = await lookupProject({
      supabase,
      workspaceId: String(workspaceId),
      projectId: requestedProjectId || undefined,
      workflowKey,
    });

    if (existing && ["GENERATING", "READY", "APPROVED"].includes(existing.status)) {
      return NextResponse.json({
        ok: true,
        status: existing.status,
        projectId: existing.id,
        draftId: existing.content_draft_id,
        workflowKey: existing.workflow_key || workflowKey,
        progress: existing.workflow_percentage ?? existing.provider_progress ?? 0,
        stage: existing.workflow_stage || "GENERATING_SCENES",
      });
    }

    const projectId = existing?.id || crypto.randomUUID();
    const creditRequestId = existing?.credit_request_id || crypto.randomUUID();

    await updateProjectWorkflow({
      supabase,
      projectId,
      workflowKey,
      stage: "PREPARING_VIDEO_PLAN",
      progress: toStageProgress("PREPARING_VIDEO_PLAN", existing?.workflow_percentage),
      status: "GENERATING",
      providerStatus: existing?.provider_job_status || "queued",
      creditStatus: (existing?.credit_status || "NONE") as VideoCreditStatusState,
      failureReason: null,
      failureReferenceId: null,
      providerJobId: existing?.provider_job_id || null,
      providerProgress: existing?.provider_progress ?? 0,
    }).catch(async () => {
      if (!existing) {
        const { error: insertError } = await supabase.from("video_projects").insert({
          id: projectId,
          workspace_id: workspaceId,
          content_draft_id: null,
          workflow_key: workflowKey,
          credit_request_id: creditRequestId,
          created_by: user.sub,
          title: "Creating video plan",
          channel,
          objective,
          prompt: "",
          script: "",
          caption: "",
          hashtags: [],
          call_to_action: callToAction,
          scenes: [],
          duration_seconds: durationSeconds,
          aspect_ratio: "9:16",
          voice,
          voice_disclosure: true,
          music_mode: musicMode,
          licensed_music_asset_id: null,
          provider: "REPLICATE",
          routing_tier: null,
          provider_model: null,
          provider_job_id: null,
          provider_progress: 0,
          provider_job_status: "queued",
          workflow_stage: "PREPARING_VIDEO_PLAN",
          workflow_percentage: STAGE_PROGRESS.PREPARING_VIDEO_PLAN,
          credit_status: "NONE",
          status: "GENERATING",
          failure_reason: null,
          failure_reference_id: null,
          workflow_started_at: new Date().toISOString(),
        } as never);
        if (insertError) throw new Error(insertError.message);
      }
    });

    const plan = await generatePlan({
      workspace: {
        businessName: existing?.title || "",
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

    await updateProjectWorkflow({
      supabase,
      projectId,
      workflowKey,
      stage: "RESERVING_CREDITS",
      progress: toStageProgress("RESERVING_CREDITS"),
      status: "GENERATING",
      providerStatus: existing?.provider_job_status || "queued",
    });

    const shouldReserve = !existing?.credit_request_id || existing.credit_status !== "RESERVED";
    if (shouldReserve) {
      const reservation = await supabase.rpc("reserve_my_video_credits", {
        video_seconds: durationSeconds,
        credit_request_id: creditRequestId,
      });
      if (reservation.error) {
        return NextResponse.json({ error: reservation.error.message }, { status: 402 });
      }
    }

    await updateProjectWorkflow({
      supabase,
      projectId,
      workflowKey,
      stage: "STARTING_VIDEO_GENERATOR",
      progress: toStageProgress("STARTING_VIDEO_GENERATOR"),
      status: "GENERATING",
      providerStatus: existing?.provider_job_status || "queued",
      creditStatus: "RESERVED",
    });

    const routerSettings = await loadVideoRouterSettings();
    const profile = resolveVideoRouterProfile({
      requestedTier: null,
      mode: routerSettings.mode,
      seconds: durationSeconds,
      settings: routerSettings,
    });

    if (existing?.provider_job_id && existing.provider_job_status && ["queued", "in_progress"].includes(existing.provider_job_status)) {
      return NextResponse.json({
        ok: true,
        status: "queued",
        projectId,
        draftId: existing.content_draft_id,
        workflowKey,
        providerJobId: existing.provider_job_id,
        tier: profile.tier,
        stage: "GENERATING_SCENES",
        progress: Math.max(40, existing.workflow_percentage ?? existing.provider_progress ?? 40),
      });
    }

    const providerJob = await startVideoProviderJob({
      providerKey: profile.providerKey,
      model: profile.model,
      prompt: plan.renderPrompt,
      seconds: durationSeconds,
    });

    const { error: projectError } = await supabase.from("video_projects").upsert({
      id: projectId,
      workspace_id: workspaceId,
      content_draft_id: existing?.content_draft_id || null,
      workflow_key: workflowKey,
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
      provider: providerJob.providerKey,
      routing_tier: profile.tier,
      provider_model: providerJob.model,
      provider_job_id: providerJob.providerJobId,
      provider_job_status: providerJob.status,
      provider_progress: providerJob.progress,
      status: "GENERATING",
      workflow_stage: "GENERATING_SCENES",
      workflow_percentage: Math.max(40, STAGE_PROGRESS.GENERATING_SCENES),
      credit_status: "RESERVED",
      failure_reason: null,
      failure_reference_id: null,
      workflow_started_at: existing?.workflow_started_at || new Date().toISOString(),
      workflow_completed_at: null,
      credit_refunded_at: null,
    } as never);

    if (projectError) {
      return NextResponse.json({ error: SAFE_TRANSIENT_ERROR }, { status: 503 });
    }

    logStageTransition({
      projectId,
      workflowKey,
      stage: "GENERATING_SCENES",
      progress: Math.max(40, STAGE_PROGRESS.GENERATING_SCENES),
      status: "GENERATING",
      providerStatus: providerJob.status,
    });

    return NextResponse.json({
      ok: true,
      status: providerJob.status,
      projectId,
      draftId: existing?.content_draft_id || null,
      workflowKey,
      providerJobId: providerJob.providerJobId,
      tier: profile.tier,
      stage: "GENERATING_SCENES",
      progress: Math.max(40, STAGE_PROGRESS.GENERATING_SCENES),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    return NextResponse.json(
      { ok: false, error: message.includes("temporarily unavailable") ? SAFE_TRANSIENT_ERROR : safeError(message) },
      { status: 503 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getAuthContext();
    if (!user?.sub) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const params = new URL(request.url).searchParams;
    const projectId = text(params.get("projectId"));
    const workflowKey = sanitizeWorkflowKey(params.get("workflowKey"));

    if (!projectId && !workflowKey) {
      return NextResponse.json({ error: "Video project ID is required." }, { status: 400 });
    }

    const { data: workspaceId, error: workspaceError } = await supabase.rpc("my_primary_workspace_id");
    if (workspaceError || !workspaceId) {
      return NextResponse.json({ error: "Save Business Setup before generating video." }, { status: 400 });
    }

    const project = await lookupProject({
      supabase,
      workspaceId: String(workspaceId),
      projectId: projectId || undefined,
      workflowKey: workflowKey || undefined,
    });

    if (!project) {
      return NextResponse.json({ error: "Video project not found." }, { status: 404 });
    }

    const stableWorkflowKey = project.workflow_key || workflowKey || "";

    if (project.status === "READY" || project.status === "APPROVED") {
      return NextResponse.json({
        ok: true,
        projectId: project.id,
        workflowKey: stableWorkflowKey,
        status: "completed",
        stage: "COMPLETE",
        progress: 100,
        providerStatus: "completed",
        creditStatus: project.credit_status || "RESERVED",
        refunded: false,
        mediaAssetId: project.media_asset_id,
        draftId: project.content_draft_id,
      });
    }

    if (project.status === "FAILED") {
      return NextResponse.json({
        ok: true,
        projectId: project.id,
        workflowKey: stableWorkflowKey,
        status: "failed",
        stage: "FAILED",
        progress: Math.max(0, Math.min(89, project.workflow_percentage ?? project.provider_progress ?? 0)),
        providerStatus: project.provider_job_status || "failed",
        creditStatus: project.credit_status || "REFUNDED",
        refunded: (project.credit_status || "") === "REFUNDED",
        failureReferenceId: project.failure_reference_id || newFailureReferenceId(),
        error: SAFE_FAILURE_MESSAGE,
      });
    }

    if (!project.provider_job_id) {
      return NextResponse.json({
        ok: true,
        projectId: project.id,
        workflowKey: stableWorkflowKey,
        status: "in_progress",
        stage: project.workflow_stage || "STARTING_VIDEO_GENERATOR",
        progress: Math.max(0, Math.min(89, project.workflow_percentage ?? 0)),
        providerStatus: project.provider_job_status || "queued",
        creditStatus: project.credit_status || "NONE",
      });
    }

    const providerJob = await fetchVideoProviderJob({
      providerKey: project.provider,
      model: project.provider_model || "",
      providerJobId: project.provider_job_id,
    });

    if (providerJob.status === "failed") {
      if (project.credit_status !== "REFUNDED") {
        await supabase.rpc("refund_my_video_credits", {
          credit_request_id: project.credit_request_id,
          refund_reason: "workflow-provider-failed",
        });
      }

      const failureReferenceId = project.failure_reference_id || newFailureReferenceId();
      await updateProjectWorkflow({
        supabase,
        projectId: project.id,
        workflowKey: stableWorkflowKey,
        stage: "FAILED",
        progress: Math.max(0, Math.min(89, project.workflow_percentage ?? project.provider_progress ?? 0)),
        status: "FAILED",
        providerStatus: "failed",
        providerProgress: project.provider_progress ?? 0,
        creditStatus: "REFUNDED",
        creditRefundedAt: project.credit_refunded_at || new Date().toISOString(),
        failureReason: SAFE_FAILURE_MESSAGE,
        failureReferenceId,
      });

      return NextResponse.json({
        ok: true,
        projectId: project.id,
        workflowKey: stableWorkflowKey,
        status: "failed",
        stage: "FAILED",
        progress: Math.max(0, Math.min(89, project.workflow_percentage ?? project.provider_progress ?? 0)),
        providerStatus: "failed",
        creditStatus: "REFUNDED",
        refunded: true,
        failureReferenceId,
        error: SAFE_FAILURE_MESSAGE,
      });
    }

    if (providerJob.status === "completed") {
      if (!providerJob.outputUrl) {
        throw new Error("VIDEO_OUTPUT_UNAVAILABLE");
      }

      const finalized = await finalizeCompletedProject({
        supabase,
        project,
        workspaceId: String(workspaceId),
        userId: user.sub,
        providerOutputUrl: providerJob.outputUrl,
        workflowKey: stableWorkflowKey,
      });

      return NextResponse.json({
        ok: true,
        projectId: project.id,
        workflowKey: stableWorkflowKey,
        status: "completed",
        stage: "COMPLETE",
        progress: 100,
        providerStatus: "completed",
        creditStatus: project.credit_status || "RESERVED",
        refunded: false,
        mediaAssetId: finalized.mediaAssetId,
        draftId: finalized.draftId,
      });
    }

    const providerProgress = Number.isFinite(providerJob.progress)
      ? Math.max(0, Math.min(100, providerJob.progress))
      : (project.provider_progress || 0);
    const stage: VideoWorkflowStage = providerProgress >= 70
      ? "RENDERING_FINAL_VIDEO"
      : "GENERATING_SCENES";
    const workflowProgress = computeGenerationProgress(providerProgress, project.workflow_percentage);

    await updateProjectWorkflow({
      supabase,
      projectId: project.id,
      workflowKey: stableWorkflowKey,
      stage,
      progress: workflowProgress,
      status: "GENERATING",
      providerStatus: providerJob.status,
      providerProgress,
      creditStatus: project.credit_status || "RESERVED",
    });

    return NextResponse.json({
      ok: true,
      projectId: project.id,
      workflowKey: stableWorkflowKey,
      status: "in_progress",
      stage,
      progress: workflowProgress,
      providerStatus: providerJob.status,
      creditStatus: project.credit_status || "RESERVED",
      refunded: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    console.error("[video-workflow] status-failure", {
      reason: message.slice(0, 120),
    });
    return NextResponse.json(
      { ok: false, error: message.includes("didn't complete") ? SAFE_FAILURE_MESSAGE : getVideoProviderUnavailableMessage() },
      { status: 503 },
    );
  }
}
