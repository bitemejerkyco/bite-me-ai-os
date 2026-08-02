import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { loadVideoRouterSettings } from "@/features/core/video-router-settings";
import { resolveVideoRouterProfile } from "@/features/core/video-router";
import { buildLegacyRenderWorkflowKey } from "@/features/core/video-idempotency";

const PUBLIC_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{8,200}$/;
const SAFE_PROVIDER_ERROR_MESSAGE =
  "Video generation is temporarily unavailable. Your credits were not charged.";

type VideoProjectLookupRow = {
  id: string;
  provider_job_id: string | null;
  provider_progress: number | null;
  status: string;
  routing_tier: string | null;
  provider_model: string | null;
  video_storage_path: string | null;
  failure_reason: string | null;
  workflow_key: string | null;
  credit_request_id: string | null;
};

type VideoCreditReservation = {
  charged_credits?: number | null;
  remaining_credits?: number | null;
  monthly_used_credits?: number | null;
  monthly_limit_credits?: number | null;
  billing_exempt?: boolean | null;
  estimated_provider_cost_cents?: number | null;
};

function normalizeProgress(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizePublicStatus(row: VideoProjectLookupRow) {
  if (row.status === "READY") {
    return { status: "completed", progress: 100 };
  }
  if (row.status === "FAILED") {
    return {
      status: "failed",
      progress: normalizeProgress(row.provider_progress) ?? 0,
      error: { message: SAFE_PROVIDER_ERROR_MESSAGE },
    };
  }
  return {
    status: row.provider_progress && row.provider_progress >= 100 ? "completed" : "in_progress",
    progress: normalizeProgress(row.provider_progress) ?? 0,
  };
}

function sanitizeIdempotencyKey(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.slice(0, 240);
}

function safeProviderErrorResponse(status = 503) {
  return NextResponse.json({ error: SAFE_PROVIDER_ERROR_MESSAGE }, { status });
}

function logProviderFailure(input: {
  phase: "start" | "status" | "cancel";
  projectId?: string;
  workflowKey?: string;
  providerStatus?: number;
  reason: string;
}) {
  console.error("[video-render] provider-operation-failed", {
    phase: input.phase,
    projectId: input.projectId,
    workflowKey: input.workflowKey,
    providerStatus: input.providerStatus,
    reason: input.reason,
  });
}

async function getAuthedSupabase() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user || null };
}

async function lookupVideoProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
) {
  const byId = await supabase
    .from("video_projects")
    .select(
      "id,provider_job_id,provider_progress,status,routing_tier,provider_model,video_storage_path,failure_reason,workflow_key,credit_request_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (byId.error) throw new Error(byId.error.message);
  if (byId.data) return byId.data as VideoProjectLookupRow;

  const byProviderJobId = await supabase
    .from("video_projects")
    .select(
      "id,provider_job_id,provider_progress,status,routing_tier,provider_model,video_storage_path,failure_reason,workflow_key,credit_request_id",
    )
    .eq("provider_job_id", id)
    .maybeSingle();
  if (byProviderJobId.error) throw new Error(byProviderJobId.error.message);
  return (byProviderJobId.data as VideoProjectLookupRow | null) || null;
}

async function lookupVideoProjectByWorkflow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  workflowKey: string,
) {
  const existing = await supabase
    .from("video_projects")
    .select(
      "id,provider_job_id,provider_progress,status,routing_tier,provider_model,video_storage_path,failure_reason,workflow_key,credit_request_id",
    )
    .eq("workspace_id", workspaceId)
    .eq("workflow_key", workflowKey)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  return (existing.data as VideoProjectLookupRow | null) || null;
}

async function updateVideoProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  updates: Partial<VideoProjectLookupRow>,
) {
  const { error } = await supabase
    .from("video_projects")
    .update(updates as never)
    .eq("id", projectId);
  if (error) throw new Error(error.message);
}

async function reserveCredits(
  supabase: Awaited<ReturnType<typeof createClient>>,
  seconds: number,
  creditRequestId: string,
): Promise<
  | { ok: true; reservation: VideoCreditReservation }
  | { ok: false; error: { message: string } }
> {
  const { data, error } = await supabase.rpc("reserve_my_video_credits", {
    video_seconds: seconds,
    credit_request_id: creditRequestId,
  });
  if (error) {
    return { ok: false, error: { message: error.message } };
  }
  const reservation = (Array.isArray(data)
    ? data[0]
    : data) as VideoCreditReservation | null;
  return {
    ok: true,
    reservation: reservation || {},
  };
}

async function refundCreditsOnce(
  supabase: Awaited<ReturnType<typeof createClient>>,
  creditRequestId: string | null,
  reason: string,
) {
  if (!creditRequestId) return;
  await supabase.rpc("refund_my_video_credits", {
    credit_request_id: creditRequestId,
    refund_reason: reason.slice(0, 250),
  });
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const env = getServerEnv();
  if (!env.openAiApiKey) {
    return NextResponse.json({ error: "OpenAI is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as {
    prompt?: unknown;
    seconds?: unknown;
    sourceVideoId?: unknown;
    tier?: unknown;
    idempotencyKey?: unknown;
    workflowKey?: unknown;
  } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const seconds = Number(body?.seconds);
  const sourceVideoId =
    typeof body?.sourceVideoId === "string" ? body.sourceVideoId.trim() : "";
  const requestedTier =
    typeof body?.tier === "string" ? body.tier.trim() : "";

  if (
    !prompt ||
    prompt.length > 4_000 ||
    ![8, 9, 10, 11, 12, 13, 14, 15].includes(seconds)
  ) {
    return NextResponse.json(
      { error: "Invalid video render request." },
      { status: 400 },
    );
  }
  if (sourceVideoId && !PUBLIC_VIDEO_ID_PATTERN.test(sourceVideoId)) {
    return NextResponse.json({ error: "Invalid source video ID." }, { status: 400 });
  }

  const { data: workspaceId, error: workspaceError } = await supabase.rpc(
    "my_primary_workspace_id",
  );
  if (workspaceError) {
    return NextResponse.json({ error: workspaceError.message }, { status: 400 });
  }
  if (!workspaceId) {
    return NextResponse.json(
      { error: "Save Business Setup before generating video." },
      { status: 400 },
    );
  }

  const workflowKey =
    sanitizeIdempotencyKey(body?.idempotencyKey) ||
    sanitizeIdempotencyKey(body?.workflowKey) ||
    buildLegacyRenderWorkflowKey({
      workspaceId: String(workspaceId),
      prompt,
      seconds,
      sourceVideoId,
      requestedTier,
    });

  const existingProject = await lookupVideoProjectByWorkflow(
    supabase,
    String(workspaceId),
    workflowKey,
  );
  if (existingProject) {
    const publicStatus = normalizePublicStatus(existingProject);
    return NextResponse.json({
      id: existingProject.id,
      projectId: existingProject.id,
      status: publicStatus.status === "in_progress" ? "queued" : publicStatus.status,
      progress: publicStatus.progress,
      tier: existingProject.routing_tier || undefined,
      workflowKey: existingProject.workflow_key || workflowKey,
      error:
        publicStatus.status === "failed"
          ? { message: SAFE_PROVIDER_ERROR_MESSAGE }
          : undefined,
    });
  }

  const routerSettings = await loadVideoRouterSettings();
  if (routerSettings.emergencyDisabled || routerSettings.mode === "DISABLED") {
    return NextResponse.json(
      { error: "Video generation is currently disabled." },
      { status: 503 },
    );
  }

  const profile = resolveVideoRouterProfile({
    requestedTier,
    mode: routerSettings.mode,
    seconds: seconds as 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15,
    sourceVideoId: sourceVideoId || null,
    settings: routerSettings,
  });

  const projectId = crypto.randomUUID();
  const creditRequestId = crypto.randomUUID();
  const reservationResult = await reserveCredits(supabase, seconds, creditRequestId);
  if (!reservationResult.ok) {
    return NextResponse.json({ error: reservationResult.error.message }, { status: 402 });
  }

  const initialTitle = prompt.slice(0, 80) || "Generated video";
  const { error: insertError } = await supabase.from("video_projects").insert({
    id: projectId,
    workspace_id: workspaceId,
    content_draft_id: null,
    workflow_key: workflowKey,
    credit_request_id: creditRequestId,
    created_by: user.id,
    title: initialTitle,
    channel: "TikTok",
    objective: "Video generation",
    prompt,
    script: prompt,
    caption: "",
    scenes: [],
    duration_seconds: seconds,
    aspect_ratio: "9:16",
    voice: "marin",
    voice_disclosure: true,
    music_mode: "NONE",
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
  if (insertError) {
    await refundCreditsOnce(supabase, creditRequestId, "project-create-failed");
    return safeProviderErrorResponse(500);
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      sourceVideoId
        ? "https://api.openai.com/v1/videos/edits"
        : "https://api.openai.com/v1/videos",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          sourceVideoId
            ? {
                video: { id: sourceVideoId },
                prompt,
              }
            : {
                model: profile.model,
                prompt,
                size: "1080x1920",
                seconds: String(seconds),
              },
        ),
        cache: "no-store",
      },
    );
  } catch {
    logProviderFailure({
      phase: "start",
      projectId,
      workflowKey,
      reason: "provider-unreachable",
    });
    await updateVideoProject(supabase, projectId, {
      status: "FAILED",
      failure_reason: SAFE_PROVIDER_ERROR_MESSAGE,
    });
    await refundCreditsOnce(supabase, creditRequestId, "provider-unreachable");
    return safeProviderErrorResponse(502);
  }

  if (!upstream.ok) {
    logProviderFailure({
      phase: "start",
      projectId,
      workflowKey,
      providerStatus: upstream.status,
      reason: "provider-rejected-start",
    });
    await updateVideoProject(supabase, projectId, {
      status: "FAILED",
      provider_progress: 0,
      failure_reason: SAFE_PROVIDER_ERROR_MESSAGE,
    });
    await refundCreditsOnce(
      supabase,
      creditRequestId,
      `provider-start-${upstream.status}`,
    );
    return safeProviderErrorResponse(upstream.status);
  }

  const payload = await upstream.json().catch(() => null);
  const providerJobId =
    payload && typeof payload === "object" && "id" in payload
      ? String((payload as { id?: string }).id || "")
      : "";

  await updateVideoProject(supabase, projectId, {
    provider_job_id: providerJobId || null,
    provider_progress: 0,
    status: "GENERATING",
  });

  return NextResponse.json({
    id: projectId,
    projectId,
    status: "queued",
    tier: profile.tier,
    workflowKey,
    creditUsage: {
      chargedCredits: Number(reservationResult.reservation?.charged_credits || 0),
      remainingCredits: Number(
        reservationResult.reservation?.remaining_credits || 0,
      ),
      monthlyUsedCredits: Number(
        reservationResult.reservation?.monthly_used_credits || 0,
      ),
      monthlyLimitCredits: Number(
        reservationResult.reservation?.monthly_limit_credits || 0,
      ),
      billingExempt: Boolean(reservationResult.reservation?.billing_exempt),
      estimatedProviderCostCents: Number(
        reservationResult.reservation?.estimated_provider_cost_cents || 0,
      ),
    },
  });
}

export async function GET(request: Request) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id") || "";
  if (!PUBLIC_VIDEO_ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid video ID." }, { status: 400 });
  }

  const project = await lookupVideoProject(supabase, id);
  if (!project) {
    return NextResponse.json({ error: "Video project not found." }, { status: 404 });
  }

  const publicStatus = normalizePublicStatus(project);
  if (publicStatus.status === "completed") {
    return NextResponse.json({
      id: project.id,
      status: "completed",
      progress: 100,
      tier: project.routing_tier || undefined,
      videoReady: Boolean(project.video_storage_path),
    });
  }

  if (publicStatus.status === "failed") {
    return NextResponse.json({
      id: project.id,
      status: "failed",
      progress: publicStatus.progress,
      tier: project.routing_tier || undefined,
      error: { message: SAFE_PROVIDER_ERROR_MESSAGE },
    });
  }

  if (!project.provider_job_id) {
    return NextResponse.json({
      id: project.id,
      status: publicStatus.status,
      progress: publicStatus.progress,
      tier: project.routing_tier || undefined,
    });
  }

  const env = getServerEnv();
  if (!env.openAiApiKey) {
    return NextResponse.json({ error: "OpenAI is not configured." }, { status: 503 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`https://api.openai.com/v1/videos/${project.provider_job_id}`, {
      headers: { Authorization: `Bearer ${env.openAiApiKey}` },
      cache: "no-store",
    });
  } catch {
    logProviderFailure({
      phase: "status",
      projectId: project.id,
      workflowKey: project.workflow_key || undefined,
      reason: "provider-status-unreachable",
    });
    return safeProviderErrorResponse(502);
  }

  if (!upstream.ok) {
    logProviderFailure({
      phase: "status",
      projectId: project.id,
      workflowKey: project.workflow_key || undefined,
      providerStatus: upstream.status,
      reason: "provider-status-failed",
    });
    return safeProviderErrorResponse(upstream.status);
  }

  const payload = await upstream.json().catch(() => null);
  const upstreamStatus =
    payload && typeof payload === "object" && "status" in payload
      ? String((payload as { status?: string }).status || "")
      : "";
  const upstreamProgress =
    payload && typeof payload === "object" && "progress" in payload
      ? normalizeProgress((payload as { progress?: unknown }).progress)
      : null;

  const mappedStatus =
    upstreamStatus === "completed" || upstreamStatus === "succeeded"
      ? "completed"
      : upstreamStatus === "failed"
        ? "failed"
        : "in_progress";

  if (mappedStatus === "failed") {
    await updateVideoProject(supabase, project.id, {
      status: "FAILED",
      provider_progress: upstreamProgress ?? project.provider_progress ?? 0,
      failure_reason: SAFE_PROVIDER_ERROR_MESSAGE,
    });
    await refundCreditsOnce(
      supabase,
      project.credit_request_id,
      "provider-generation-failed",
    );
    return NextResponse.json({
      id: project.id,
      status: "failed",
      progress: upstreamProgress ?? publicStatus.progress,
      tier: project.routing_tier || undefined,
      error: { message: SAFE_PROVIDER_ERROR_MESSAGE },
    });
  }

  if (mappedStatus === "completed") {
    await updateVideoProject(supabase, project.id, {
      status: "READY",
      provider_progress: 100,
    });
  } else {
    await updateVideoProject(supabase, project.id, {
      status: "GENERATING",
      provider_progress: upstreamProgress ?? project.provider_progress ?? 0,
    });
  }

  return NextResponse.json({
    id: project.id,
    status: mappedStatus === "completed" ? "completed" : publicStatus.status,
    progress: upstreamProgress ?? publicStatus.progress,
    tier: project.routing_tier || undefined,
  });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id") || "";
  if (!PUBLIC_VIDEO_ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid video ID." }, { status: 400 });
  }

  const project = await lookupVideoProject(supabase, id);
  if (!project) {
    return NextResponse.json({ error: "Video project not found." }, { status: 404 });
  }

  if (!project.provider_job_id) {
    return NextResponse.json({ deleted: true, id: project.id });
  }

  const env = getServerEnv();
  if (!env.openAiApiKey) {
    return NextResponse.json({ error: "OpenAI is not configured." }, { status: 503 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`https://api.openai.com/v1/videos/${project.provider_job_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${env.openAiApiKey}` },
      cache: "no-store",
    });
  } catch {
    logProviderFailure({
      phase: "cancel",
      projectId: project.id,
      workflowKey: project.workflow_key || undefined,
      reason: "provider-cancel-unreachable",
    });
    return safeProviderErrorResponse(502);
  }

  if (!upstream.ok) {
    logProviderFailure({
      phase: "cancel",
      projectId: project.id,
      workflowKey: project.workflow_key || undefined,
      providerStatus: upstream.status,
      reason: "provider-cancel-failed",
    });
    return safeProviderErrorResponse(upstream.status);
  }

  await updateVideoProject(supabase, project.id, {
    status: project.video_storage_path ? "READY" : "DRAFT",
    provider_progress: project.video_storage_path ? 100 : 0,
    provider_job_id: null,
    failure_reason: null,
  });

  return NextResponse.json({ deleted: true, id: project.id });
}
