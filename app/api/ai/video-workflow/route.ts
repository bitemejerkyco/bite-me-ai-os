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
  validateStructuredVideoPlanText,
  VIDEO_PROMPT_VERSION,
  type VideoCreditStatusState,
  type VideoPlanParseFailureCategory,
  type VideoProject,
  type VideoWorkflowStage,
} from "@/features/core/video-project";
import { normalizeRequestedVideoQualityTier } from "@/features/core/video-generation-quality";
import { buildTextlessFrameConstraint } from "@/features/core/creative-spec";
import {
  fetchVideoProviderJob,
  getVideoProviderUnavailableMessage,
  mapProviderErrorCodeToMessage,
  type SafeVideoProviderErrorCode,
  startVideoProviderJob,
} from "@/features/core/video-provider";
import { buildShortVideoWorkflowKey } from "@/features/core/video-idempotency";
import { composeVideoWithExactProduct, type ProductLayerScene, type VideoCompositionManifest } from "@/features/core/video-compositor";

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
  productAsset?: unknown;
  exactProductMode?: unknown;
  allowAiProductMotion?: unknown;
  qualityTier?: unknown;
  model?: unknown;
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
  metadata?: Record<string, unknown> | null;
  file_name?: string;
  mime_type?: string | null;
  size_bytes?: number | null;
};

type ProductMetadata = {
  productId?: string;
  productName?: string;
  assetRole?: "PRIMARY" | "ALTERNATE" | "REFERENCE";
  isPrimaryProductImage?: boolean;
  role?: "PRIMARY" | "ALTERNATE" | "REFERENCE";
  angle?: string;
  locked?: boolean;
  approvedForGeneration?: boolean;
  transparentBackground?: boolean;
  originalAssetId?: string;
  exactProductMode?: boolean;
  allowAiMotion?: boolean;
  preserveOriginalAsset?: boolean;
  originalStoragePath?: string;
  background?: string;
  position?: string;
  scale?: string;
  safeArea?: string;
  notes?: string;
};

const SAFE_FAILURE_MESSAGE = "Video generation didn't complete.";
const SAFE_TRANSIENT_ERROR = "Video generation is temporarily unavailable.";
const SAFE_COMPOSITION_BLOCKED_MESSAGE = "Exact Product Mode is temporarily unavailable in this runtime. Product image compositing could not run.";
const MAX_PROVIDER_OUTPUT_BYTES = 250 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_COMPOSED_VIDEO_BYTES = 300 * 1024 * 1024;
const SUPPORTED_PRODUCT_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const SAFE_FALLBACK_COMPLIANCE_NOTE =
  "Human review required before publishing. Verify claims, visuals, captions, and rights compliance.";
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

function isSafeStoragePathForWorkspace(workspaceId: string, storagePath: string): boolean {
  const normalized = storagePath.replace(/\\/g, "/").trim();
  if (!normalized) return false;
  if (normalized.includes("..")) return false;
  if (normalized.startsWith("/") || normalized.startsWith("./")) return false;
  return normalized.startsWith(`${workspaceId}/`);
}

function mapCompositionErrorToSafeReason(error: unknown): {
  reasonCode: string;
  message: string;
  blockedExactProduct: boolean;
} {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (
    raw === "FFMPEG_RUNTIME_UNAVAILABLE"
    || raw === "FFMPEG_NOT_AVAILABLE"
    || raw === "FFMPEG_START_FAILED"
    || raw === "FFMPEG_TIMEOUT"
    || raw === "FFMPEG_MEMORY_LIMIT"
    || raw === "FFMPEG_COMPOSE_FAILED"
  ) {
    return {
      reasonCode: raw,
      message: SAFE_COMPOSITION_BLOCKED_MESSAGE,
      blockedExactProduct: true,
    };
  }
  if (
    raw === "PRODUCT_ASSET_MIME_UNSUPPORTED"
    || raw === "PRODUCT_ASSET_TOO_LARGE"
    || raw === "PRODUCT_ASSET_UNAVAILABLE"
    || raw === "PRODUCT_ASSET_NOT_APPROVED"
    || raw === "PRODUCT_ASSET_PATH_INVALID"
    || raw === "EXACT_PRODUCT_LAYER_MISSING"
  ) {
    return {
      reasonCode: raw,
      message: "The selected product image cannot be used for exact product rendering.",
      blockedExactProduct: false,
    };
  }
  return {
    reasonCode: "VIDEO_PROVIDER_UNAVAILABLE",
    message: SAFE_TRANSIENT_ERROR,
    blockedExactProduct: false,
  };
}

function normalizeProductMetadata(raw: unknown): ProductMetadata {
  if (!raw || typeof raw !== "object") return {};
  const metadata = raw as Record<string, unknown>;
  const role =
    metadata.role === "PRIMARY" || metadata.role === "ALTERNATE" || metadata.role === "REFERENCE"
      ? metadata.role
      : metadata.assetRole === "PRIMARY" || metadata.assetRole === "ALTERNATE" || metadata.assetRole === "REFERENCE"
        ? metadata.assetRole
        : undefined;
  return {
    productId: typeof metadata.productId === "string" ? metadata.productId : undefined,
    productName: typeof metadata.productName === "string" ? metadata.productName : undefined,
    role,
    assetRole: role,
    isPrimaryProductImage:
      typeof metadata.isPrimaryProductImage === "boolean"
        ? metadata.isPrimaryProductImage
        : role === "PRIMARY"
          ? true
          : undefined,
    angle: typeof metadata.angle === "string" ? metadata.angle : undefined,
    locked: typeof metadata.locked === "boolean" ? metadata.locked : undefined,
    approvedForGeneration: typeof metadata.approvedForGeneration === "boolean" ? metadata.approvedForGeneration : undefined,
    transparentBackground:
      typeof metadata.transparentBackground === "boolean"
        ? metadata.transparentBackground
        : undefined,
    originalAssetId: typeof metadata.originalAssetId === "string" ? metadata.originalAssetId : undefined,
    exactProductMode: typeof metadata.exactProductMode === "boolean" ? metadata.exactProductMode : undefined,
    allowAiMotion: typeof metadata.allowAiMotion === "boolean" ? metadata.allowAiMotion : undefined,
    preserveOriginalAsset:
      typeof metadata.preserveOriginalAsset === "boolean" ? metadata.preserveOriginalAsset : undefined,
    originalStoragePath: typeof metadata.originalStoragePath === "string" ? metadata.originalStoragePath : undefined,
    background: typeof metadata.background === "string" ? metadata.background : undefined,
    position: typeof metadata.position === "string" ? metadata.position : undefined,
    scale: typeof metadata.scale === "string" ? metadata.scale : undefined,
    safeArea: typeof metadata.safeArea === "string" ? metadata.safeArea : undefined,
    notes: typeof metadata.notes === "string" ? metadata.notes : undefined,
  };
}

function readSceneProductLayer(scenes: unknown): {
  assetId: string;
  mode: "EXACT_PRODUCT" | "AI_PRODUCT_MOTION";
  scenes: ProductLayerScene[];
} | null {
  if (!Array.isArray(scenes)) return null;
  let elapsed = 0;
  let assetId = "";
  let mode: "EXACT_PRODUCT" | "AI_PRODUCT_MOTION" = "EXACT_PRODUCT";

  const mapped = scenes
    .map((scene, index) => {
      const item = scene && typeof scene === "object" ? (scene as Record<string, unknown>) : {};
      const seconds = Math.max(0.2, Number(item.seconds) || 1);
      const startSeconds = elapsed;
      const endSeconds = elapsed + seconds;
      elapsed = endSeconds;
      const sceneAssetId = typeof item.productAssetId === "string" ? item.productAssetId : "";
      if (!assetId && sceneAssetId) assetId = sceneAssetId;

      const sceneMode = item.productMode === "AI_PRODUCT_MOTION" ? "AI_PRODUCT_MOTION" : "EXACT_PRODUCT";
      if (sceneMode === "AI_PRODUCT_MOTION") mode = "AI_PRODUCT_MOTION";

      return {
        order: Number(item.order) || index + 1,
        startSeconds,
        endSeconds,
        position: typeof item.productPlacement === "string" ? item.productPlacement : undefined,
        scale: typeof item.productScale === "string" ? item.productScale : undefined,
        opacity: Number.isFinite(Number(item.productOpacity)) ? Number(item.productOpacity) : 1,
        shadow: typeof item.productShadow === "boolean" ? item.productShadow : true,
        rotationDegrees: Number.isFinite(Number(item.productRotation)) ? Number(item.productRotation) : undefined,
        entrance:
          item.productEntrance === "FADE_IN" || item.productEntrance === "SLIDE_UP"
            ? item.productEntrance
            : "NONE",
        exit: item.productExit === "FADE_OUT" ? "FADE_OUT" : "NONE",
        zoom:
          item.productZoom === "ZOOM_IN" || item.productZoom === "ZOOM_OUT"
            ? item.productZoom
            : "NONE",
      } satisfies ProductLayerScene;
    })
    .filter((scene) => scene.endSeconds > scene.startSeconds);

  if (!assetId || !mapped.length) return null;
  return { assetId, mode, scenes: mapped };
}

async function resolveSignedMediaUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string,
): Promise<string> {
  const signed = await supabase.storage
    .from("brand-media")
    .createSignedUrl(storagePath, 60 * 60);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error("PRODUCT_ASSET_URL_UNAVAILABLE");
  }
  return signed.data.signedUrl;
}

async function buildCompositionOutput(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  workspaceId: string;
  project: VideoProjectRow;
  providerOutputUrl: string;
}): Promise<{ videoBytes: Uint8Array; manifest: VideoCompositionManifest }> {
  const expectsExactLayer = Array.isArray(input.project.scenes)
    && input.project.scenes.some((scene) => {
      const item = scene && typeof scene === "object" ? (scene as Record<string, unknown>) : null;
      return item
        && (item.productMode === "EXACT_PRODUCT"
          || (typeof item.productAssetId === "string" && item.productAssetId.trim().length > 0));
    });

  const productLayer = readSceneProductLayer(input.project.scenes);
  if (expectsExactLayer && !productLayer) {
    throw new Error("EXACT_PRODUCT_LAYER_MISSING");
  }
  if (!productLayer || productLayer.mode !== "EXACT_PRODUCT") {
    return composeVideoWithExactProduct({ providerOutputUrl: input.providerOutputUrl });
  }

  const { data: productAsset, error: productError } = await input.supabase
    .from("media_assets")
    .select("id,storage_path,metadata,file_name,mime_type,size_bytes")
    .eq("workspace_id", input.workspaceId)
    .eq("id", productLayer.assetId)
    .maybeSingle();
  if (productError || !productAsset?.storage_path) {
    throw new Error("PRODUCT_ASSET_UNAVAILABLE");
  }
  if (!isSafeStoragePathForWorkspace(input.workspaceId, productAsset.storage_path)) {
    throw new Error("PRODUCT_ASSET_PATH_INVALID");
  }

  const productMimeType = String(productAsset.mime_type || "").toLowerCase();
  if (!SUPPORTED_PRODUCT_IMAGE_MIME_TYPES.has(productMimeType)) {
    throw new Error("PRODUCT_ASSET_MIME_UNSUPPORTED");
  }
  if (Number(productAsset.size_bytes || 0) > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error("PRODUCT_ASSET_TOO_LARGE");
  }

  const productMetadata = normalizeProductMetadata(
    productAsset.metadata && typeof productAsset.metadata === "object"
      ? ((productAsset.metadata as Record<string, unknown>).productAsset && typeof (productAsset.metadata as Record<string, unknown>).productAsset === "object"
        ? (productAsset.metadata as Record<string, unknown>).productAsset
        : productAsset.metadata)
      : null,
  );

  if (productMetadata.approvedForGeneration !== true) {
    throw new Error("PRODUCT_ASSET_NOT_APPROVED");
  }

  const productAssetUrl = await resolveSignedMediaUrl(input.supabase, productAsset.storage_path);
  return composeVideoWithExactProduct({
    providerOutputUrl: input.providerOutputUrl,
    providerOutputSizeBytes: MAX_PROVIDER_OUTPUT_BYTES,
    expectedDurationSeconds: Number(input.project.duration_seconds || 0),
    productLayer: {
      assetId: productAsset.id,
      assetUrl: productAssetUrl,
      assetMimeType: productMimeType,
      assetSizeBytes: Number(productAsset.size_bytes || 0),
      originalAssetId: productMetadata.originalAssetId || productAsset.id,
      locked: productMetadata.locked ?? true,
      approvedForGeneration: productMetadata.approvedForGeneration ?? false,
      transparentBackground: productMetadata.transparentBackground ?? true,
      scenes: productLayer.scenes,
    },
  });
}

function buildFallbackPlan(input: {
  channel: VideoProject["channel"];
  objective: string;
  message: string;
  callToAction: string;
  durationSeconds: VideoProject["durationSeconds"];
  productAsset?: {
    id: string;
    name: string;
    storagePath: string;
    productMetadata?: {
      productId?: string;
      productName?: string;
      role?: "PRIMARY" | "ALTERNATE" | "REFERENCE";
      angle?: string;
      locked?: boolean;
      approvedForGeneration?: boolean;
      exactProductMode?: boolean;
      allowAiMotion?: boolean;
      preserveOriginalAsset?: boolean;
      originalStoragePath?: string;
      background?: string;
      position?: string;
      scale?: string;
      safeArea?: string;
      notes?: string;
    };
  };
  exactProductMode?: boolean;
  allowAiProductMotion?: boolean;
}) {
  const total = input.durationSeconds;
  const first = Math.max(2, Math.floor(total * 0.35));
  const second = Math.max(2, Math.floor(total * 0.4));
  const third = Math.max(2, total - first - second);
  const productMode: VideoProject["scenes"][number]["productMode"] = input.allowAiProductMotion
    ? "AI_PRODUCT_MOTION"
    : "EXACT_PRODUCT";
  const defaultEntrance: NonNullable<VideoProject["scenes"][number]["productEntrance"]> = "FADE_IN";
  const defaultExit: NonNullable<VideoProject["scenes"][number]["productExit"]> = "FADE_OUT";
  const defaultZoom: NonNullable<VideoProject["scenes"][number]["productZoom"]> = "NONE";
  const title = `${input.channel} video: ${input.objective}`.slice(0, 120);
  const caption = `${input.objective}. ${input.callToAction}`.trim();

  return {
    title,
    script: `${input.message}. ${input.callToAction}`.trim(),
    caption,
    renderPrompt: [
      "Create an original 9:16 commercial video with no logos, copyrighted characters, or third-party marks.",
      `Core message: ${input.message}`,
      `Objective: ${input.objective}`,
      `Channel style: ${input.channel}`,
      `Duration: ${input.durationSeconds} seconds.`,
      "Use clean typography, readable overlays, and product-focused visuals.",
      input.productAsset ? `Product asset: ${input.productAsset.name} (${input.productAsset.id})` : "",
      input.exactProductMode ? "Exact product mode is required. Preserve the real product asset and keep logos and packaging copy unchanged." : "",
    ].join(" "),
    complianceNote: SAFE_FALLBACK_COMPLIANCE_NOTE,
    hashtags: ["#PostMotive", "#VideoMarketing"],
    callToAction: input.callToAction,
    scenes: [
      {
        order: 1,
        seconds: first,
        visual: input.productAsset ? `Open with ${input.productAsset.name} as the exact product reference and clear subject framing.` : "Open with a striking product moment and clear subject framing.",
        narration: input.message,
        onScreenText: input.objective,
        productAssetId: input.productAsset?.id,
        productAssetName: input.productAsset?.name,
        productMode,
        productPlacement: input.productAsset?.productMetadata?.position || "center frame",
        productScale: input.productAsset?.productMetadata?.scale || "large and readable",
        productOpacity: 1,
        productShadow: true,
        productEntrance: defaultEntrance,
        productExit: defaultExit,
        productZoom: defaultZoom,
        productBackground: input.productAsset?.productMetadata?.background || "brand-safe neutral background",
        productSafeArea: input.productAsset?.productMetadata?.safeArea || "leave room for overlays",
        productLocked: input.productAsset?.productMetadata?.locked ?? true,
        preserveOriginalAsset: input.productAsset?.productMetadata?.preserveOriginalAsset ?? true,
      },
      {
        order: 2,
        seconds: second,
        visual: "Show benefits in motion with quick cuts and close details.",
        narration: "Show authentic use and practical value.",
        onScreenText: "Built for real moments",
        productAssetId: input.productAsset?.id,
        productAssetName: input.productAsset?.name,
        productMode,
        productPlacement: input.productAsset?.productMetadata?.position || "center frame",
        productScale: input.productAsset?.productMetadata?.scale || "large and readable",
        productOpacity: 1,
        productShadow: true,
        productEntrance: defaultEntrance,
        productExit: defaultExit,
        productZoom: defaultZoom,
        productBackground: input.productAsset?.productMetadata?.background || "brand-safe neutral background",
        productSafeArea: input.productAsset?.productMetadata?.safeArea || "leave room for overlays",
        productLocked: input.productAsset?.productMetadata?.locked ?? true,
        preserveOriginalAsset: input.productAsset?.productMetadata?.preserveOriginalAsset ?? true,
      },
      {
        order: 3,
        seconds: third,
        visual: "Close with brand shot and direct call-to-action frame.",
        narration: input.callToAction,
        onScreenText: input.callToAction,
        productAssetId: input.productAsset?.id,
        productAssetName: input.productAsset?.name,
        productMode,
        productPlacement: input.productAsset?.productMetadata?.position || "center frame",
        productScale: input.productAsset?.productMetadata?.scale || "large and readable",
        productOpacity: 1,
        productShadow: true,
        productEntrance: defaultEntrance,
        productExit: defaultExit,
        productZoom: defaultZoom,
        productBackground: input.productAsset?.productMetadata?.background || "brand-safe neutral background",
        productSafeArea: input.productAsset?.productMetadata?.safeArea || "leave room for overlays",
        productLocked: input.productAsset?.productMetadata?.locked ?? true,
        preserveOriginalAsset: input.productAsset?.productMetadata?.preserveOriginalAsset ?? true,
      },
    ],
  };
}

function toSafeProviderMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (!raw) return getVideoProviderUnavailableMessage();
  if (/^[A-Z_]+$/.test(raw)) {
    return mapProviderErrorCodeToMessage(raw as SafeVideoProviderErrorCode);
  }
  return getVideoProviderUnavailableMessage();
}

function toSafeProviderErrorCode(error: unknown): SafeVideoProviderErrorCode {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (
    raw === "REPLICATE_NOT_CONFIGURED"
    || raw === "REPLICATE_AUTH_FAILED"
    || raw === "REPLICATE_BILLING_REQUIRED"
    || raw === "REPLICATE_MODEL_NOT_FOUND"
    || raw === "REPLICATE_RATE_LIMITED"
    || raw === "REPLICATE_BAD_REQUEST"
    || raw === "REPLICATE_START_FAILED"
    || raw === "REPLICATE_STATUS_FAILED"
    || raw === "REPLICATE_CANCEL_FAILED"
  ) {
    return raw;
  }
  return "VIDEO_PROVIDER_UNAVAILABLE";
}

async function failProviderStart(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  projectId: string;
  workflowKey: string;
  creditRequestId: string | null;
  currentCreditStatus: VideoCreditStatusState | null;
  currentFailureReferenceId: string | null;
  currentWorkflowPercentage: number | null;
  currentProviderProgress: number | null;
  currentProviderJobId: string | null;
  providerError: unknown;
}) {
  const safeErrorCode = toSafeProviderErrorCode(input.providerError);
  const failureReferenceId = input.currentFailureReferenceId || newFailureReferenceId();
  let creditStatus: VideoCreditStatusState = input.currentCreditStatus || "RESERVED";

  if (input.currentCreditStatus !== "REFUNDED" && input.creditRequestId) {
    const refund = await input.supabase.rpc("refund_my_video_credits", {
      credit_request_id: input.creditRequestId,
      refund_reason: "workflow-provider-start-failed",
    });
    if (!refund.error) {
      creditStatus = "REFUNDED";
    }
  }

  await updateProjectWorkflow({
    supabase: input.supabase,
    projectId: input.projectId,
    workflowKey: input.workflowKey,
    stage: "FAILED",
    progress: Math.min(30, Math.max(0, input.currentWorkflowPercentage ?? input.currentProviderProgress ?? 30)),
    status: "FAILED",
    providerStatus: "failed",
    providerProgress: input.currentProviderProgress ?? 0,
    providerJobId: input.currentProviderJobId || null,
    creditStatus,
    creditRefundedAt: creditStatus === "REFUNDED" ? new Date().toISOString() : null,
    failureReason: safeErrorCode,
    failureReferenceId,
  });

  console.error("[video-workflow] provider-start-failure", {
    projectId: input.projectId,
    workflowKey: input.workflowKey,
    safeErrorCode,
  });

  return NextResponse.json(
    {
      ok: false,
      errorCode: safeErrorCode,
      error: mapProviderErrorCodeToMessage(safeErrorCode),
      projectId: input.projectId,
      workflowKey: input.workflowKey,
      failureReferenceId,
    },
    { status: 503 },
  );
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
  productAsset?: {
    id: string;
    name: string;
    storagePath: string;
    productMetadata?: {
      productId?: string;
      productName?: string;
      role?: "PRIMARY" | "ALTERNATE" | "REFERENCE";
      angle?: string;
      locked?: boolean;
      approvedForGeneration?: boolean;
      exactProductMode?: boolean;
      allowAiMotion?: boolean;
      preserveOriginalAsset?: boolean;
      originalStoragePath?: string;
      background?: string;
      position?: string;
      scale?: string;
      safeArea?: string;
      notes?: string;
    };
  };
  exactProductMode?: boolean;
  allowAiProductMotion?: boolean;
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
  const textlessFrameConstraint = buildTextlessFrameConstraint();
  if (!env.openAiApiKey) {
    return buildFallbackPlan(input);
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
            input.productAsset ? `Product asset: ${input.productAsset.name} (${input.productAsset.id})` : "Product asset: none supplied",
          ],
          constraints: [
            "Create original 9:16 vertical-video material.",
            textlessFrameConstraint,
            "Leave clean visual space for deterministic overlays.",
            "Do not use real-person likenesses, celebrities, copyrighted characters, copyrighted music, or third-party watermarks.",
            "Never invent prices, discounts, certifications, testimonials, legal approval, or product claims.",
            "Include readable on-screen captions and a safe human-review note.",
            input.productAsset ? "Use the supplied product asset as the authoritative visual reference and preserve packaging copy exactly." : "",
          ],
          requiredOutput: [
            "Return strict JSON only.",
            "Do not output React, Remotion, JavaScript, TypeScript, or executable code.",
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
            productAsset: input.productAsset,
            exactProductMode: input.exactProductMode,
            allowAiProductMotion: input.allowAiProductMotion,
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
    return buildFallbackPlan(input);
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
    return buildFallbackPlan(input);
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
    return buildFallbackPlan(input);
  }

  const validated = validateStructuredVideoPlanText({
    title: plan.title,
    script: plan.script,
    caption: plan.caption,
    renderPrompt: plan.renderPrompt,
    complianceNote: plan.complianceNote,
    callToAction: plan.callToAction,
    hashtags: plan.hashtags,
    scenes: plan.scenes,
    immutableBrandName: text(input.workspace.businessName),
    immutableProductName: input.productAsset?.productMetadata?.productName,
  });
  if (!validated.valid || !validated.plan) {
    logVideoPlanFailure({
      stage: "plan_parse_failed",
      openAiStatus: response.status,
      openAiRequestId: requestId,
      extractedTextEmpty: extractedText.trim().length === 0,
      parseFailureCategory: "text_validation_failed",
      model: env.openAiModel,
    });
    return buildFallbackPlan(input);
  }

  return {
    ...validated.plan,
    hashtags: normalizeHashtags((validated.plan as { hashtags?: unknown }).hashtags),
    callToAction: validated.plan.callToAction || input.callToAction,
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
  finalVideoBytes: Uint8Array;
  manifest: VideoCompositionManifest;
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

  const bytes = input.finalVideoBytes;
  if (bytes.byteLength > MAX_COMPOSED_VIDEO_BYTES) {
    throw new Error("COMPOSITION_OUTPUT_TOO_LARGE");
  }
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
        textOverlaySource: "STRUCTURED_PLAN",
        compositionManifest: input.manifest,
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

async function failFinalizationAndRefund(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  project: VideoProjectRow;
  workflowKey: string;
  error: unknown;
}): Promise<{ failureReferenceId: string; reasonCode: string; message: string; refunded: boolean; blockedExactProduct: boolean }> {
  const mapped = mapCompositionErrorToSafeReason(input.error);
  let refunded = false;

  if (input.project.credit_status !== "REFUNDED" && input.project.credit_request_id) {
    const refund = await input.supabase.rpc("refund_my_video_credits", {
      credit_request_id: input.project.credit_request_id,
      refund_reason: "workflow-composition-failed",
    });
    refunded = !refund.error;
  }

  const failureReferenceId = input.project.failure_reference_id || newFailureReferenceId();
  await updateProjectWorkflow({
    supabase: input.supabase,
    projectId: input.project.id,
    workflowKey: input.workflowKey,
    stage: "FAILED",
    progress: Math.max(0, Math.min(89, input.project.workflow_percentage ?? input.project.provider_progress ?? 0)),
    status: "FAILED",
    providerStatus: "failed",
    providerProgress: input.project.provider_progress ?? 0,
    creditStatus: refunded || input.project.credit_status === "REFUNDED" ? "REFUNDED" : (input.project.credit_status || "RESERVED"),
    creditRefundedAt: refunded ? new Date().toISOString() : input.project.credit_refunded_at,
    failureReason: mapped.reasonCode,
    failureReferenceId,
  });

  return {
    failureReferenceId,
    reasonCode: mapped.reasonCode,
    message: mapped.message,
    refunded: refunded || input.project.credit_status === "REFUNDED",
    blockedExactProduct: mapped.blockedExactProduct,
  };
}

async function finalizeCompletedProject(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  project: VideoProjectRow;
  workspaceId: string;
  userId: string;
  providerOutputUrl: string;
  workflowKey: string;
}) {
  const composedOutput = await buildCompositionOutput({
    supabase: input.supabase,
    workspaceId: input.workspaceId,
    project: input.project,
    providerOutputUrl: input.providerOutputUrl,
  });

  const existingMedia = input.project.media_asset_id && input.project.video_storage_path
    ? { id: input.project.media_asset_id, storage_path: input.project.video_storage_path }
    : await ensureGeneratedMediaAsset({
        supabase: input.supabase,
        workspaceId: input.workspaceId,
        userId: input.userId,
        project: input.project,
        finalVideoBytes: composedOutput.videoBytes,
        manifest: composedOutput.manifest,
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
    const requestedQualityTier = normalizeRequestedVideoQualityTier(body?.qualityTier);
    const requestedProductAsset = body?.productAsset && typeof body.productAsset === "object"
      ? (body.productAsset as {
          id?: unknown;
          name?: unknown;
          storagePath?: unknown;
          productMetadata?: unknown;
        })
      : null;

    if (body?.model !== undefined) {
      return NextResponse.json({ error: "Client-specified model overrides are not allowed." }, { status: 400 });
    }

    if (
      !durationSeconds
      || !["TikTok", "Instagram Reels", "Facebook Reels", "YouTube Shorts"].includes(channel)
      || !objective
      || !message
      || !callToAction
    ) {
      return NextResponse.json({ error: "Complete the short-video brief first." }, { status: 400 });
    }
    if (body?.qualityTier !== undefined && !requestedQualityTier) {
      return NextResponse.json({ error: "Select Economy, Standard, or Premium quality." }, { status: 400 });
    }

    const { data: workspaceId, error: workspaceError } = await supabase.rpc("my_primary_workspace_id");
    if (workspaceError || !workspaceId) {
      return NextResponse.json({ error: "Save Business Setup before generating video." }, { status: 400 });
    }

    let planProductAsset:
      | {
          id: string;
          name: string;
          storagePath: string;
          productMetadata?: {
            productId?: string;
            productName?: string;
            role?: "PRIMARY" | "ALTERNATE" | "REFERENCE";
            angle?: string;
            locked?: boolean;
            approvedForGeneration?: boolean;
            exactProductMode?: boolean;
            allowAiMotion?: boolean;
            preserveOriginalAsset?: boolean;
            originalStoragePath?: string;
            background?: string;
            position?: string;
            scale?: string;
            safeArea?: string;
            notes?: string;
          };
        }
      | undefined;
    const exactProductMode = Boolean(body?.exactProductMode ?? requestedProductAsset);
    const allowAiProductMotion = Boolean(body?.allowAiProductMotion);

    if (requestedProductAsset?.id) {
      const { data: mediaRow, error: mediaError } = await supabase
        .from("media_assets")
        .select("id,file_name,storage_path,metadata,mime_type,size_bytes")
        .eq("workspace_id", String(workspaceId))
        .eq("id", text(requestedProductAsset.id))
        .maybeSingle();
      if (mediaError) {
        const safeMessage = safeError((mediaError as { message?: string } | null | undefined)?.message) || "Selected product image could not be validated.";
        return NextResponse.json({ error: safeMessage }, { status: 400 });
      }
      if (!mediaRow?.storage_path || !isSafeStoragePathForWorkspace(String(workspaceId), mediaRow.storage_path)) {
        return NextResponse.json({ error: "Selected product image path is invalid." }, { status: 400 });
      }
      const mimeType = String(mediaRow.mime_type || "").toLowerCase();
      if (!SUPPORTED_PRODUCT_IMAGE_MIME_TYPES.has(mimeType)) {
        return NextResponse.json({ error: "Unsupported product image type. Use PNG, JPEG, or WEBP." }, { status: 400 });
      }
      if (Number(mediaRow.size_bytes || 0) > MAX_PRODUCT_IMAGE_BYTES) {
        return NextResponse.json({ error: "Product image is too large for exact product rendering." }, { status: 400 });
      }
      const rawMetadata = mediaRow?.metadata && typeof mediaRow.metadata === "object"
        ? (mediaRow.metadata.productAsset && typeof mediaRow.metadata.productAsset === "object"
          ? mediaRow.metadata.productAsset
          : mediaRow.metadata)
        : null;
      const requestMetadata = (requestedProductAsset.productMetadata && typeof requestedProductAsset.productMetadata === "object")
        ? requestedProductAsset.productMetadata as {
            productId?: string;
            productName?: string;
            role?: "PRIMARY" | "ALTERNATE" | "REFERENCE";
            angle?: string;
            locked?: boolean;
            approvedForGeneration?: boolean;
            exactProductMode?: boolean;
            allowAiMotion?: boolean;
            preserveOriginalAsset?: boolean;
            originalStoragePath?: string;
            background?: string;
            position?: string;
            scale?: string;
            safeArea?: string;
            notes?: string;
          }
        : {};
      const productMetadata = {
        ...(rawMetadata && typeof rawMetadata === "object" ? rawMetadata : {}),
        ...requestMetadata,
      } as {
        productId?: string;
        productName?: string;
        role?: "PRIMARY" | "ALTERNATE" | "REFERENCE";
        angle?: string;
        locked?: boolean;
        approvedForGeneration?: boolean;
        exactProductMode?: boolean;
        allowAiMotion?: boolean;
        preserveOriginalAsset?: boolean;
        originalStoragePath?: string;
        background?: string;
        position?: string;
        scale?: string;
        safeArea?: string;
        notes?: string;
      };
      if (!productMetadata?.approvedForGeneration) {
        return NextResponse.json({ error: "Select an approved product image before generating an exact product video." }, { status: 400 });
      }
      if (allowAiProductMotion && productMetadata.allowAiMotion !== true) {
        return NextResponse.json({ error: "AI product motion needs explicit approval on the selected product image." }, { status: 400 });
      }
      planProductAsset = mediaRow
        ? {
            id: mediaRow.id,
            name: mediaRow.file_name,
            storagePath: mediaRow.storage_path,
            productMetadata,
          }
        : undefined;
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
        tier: existing.routing_tier || requestedQualityTier || "ECONOMY",
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
          routing_tier: requestedQualityTier || "ECONOMY",
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
      productAsset: planProductAsset,
      exactProductMode,
      allowAiProductMotion,
    });
    const defaultSceneEntrance: NonNullable<VideoProject["scenes"][number]["productEntrance"]> = "FADE_IN";
    const defaultSceneExit: NonNullable<VideoProject["scenes"][number]["productExit"]> = "FADE_OUT";
    const defaultSceneZoom: NonNullable<VideoProject["scenes"][number]["productZoom"]> = "NONE";
    const scenes = plan.scenes.map((scene) =>
      planProductAsset
        ? {
            ...scene,
            productAssetId: planProductAsset.id,
            productAssetName: planProductAsset.name,
            productMode: allowAiProductMotion ? "AI_PRODUCT_MOTION" : "EXACT_PRODUCT",
            productPlacement: planProductAsset.productMetadata?.position || "center frame",
            productScale: planProductAsset.productMetadata?.scale || "large and readable",
            productOpacity: Number.isFinite(Number((scene as { productOpacity?: unknown }).productOpacity))
              ? Number((scene as { productOpacity?: unknown }).productOpacity)
              : 1,
            productShadow: typeof (scene as { productShadow?: unknown }).productShadow === "boolean"
              ? Boolean((scene as { productShadow?: boolean }).productShadow)
              : true,
            productEntrance: (scene as { productEntrance?: unknown }).productEntrance === "FADE_IN"
              || (scene as { productEntrance?: unknown }).productEntrance === "SLIDE_UP"
              ? ((scene as { productEntrance?: "FADE_IN" | "SLIDE_UP" }).productEntrance)
              : defaultSceneEntrance,
            productExit: (scene as { productExit?: unknown }).productExit === "FADE_OUT"
              ? "FADE_OUT"
              : defaultSceneExit,
            productZoom: (scene as { productZoom?: unknown }).productZoom === "ZOOM_IN"
              || (scene as { productZoom?: unknown }).productZoom === "ZOOM_OUT"
              ? ((scene as { productZoom?: "ZOOM_IN" | "ZOOM_OUT" }).productZoom)
              : defaultSceneZoom,
            productBackground: planProductAsset.productMetadata?.background || "brand-safe neutral background",
            productSafeArea: planProductAsset.productMetadata?.safeArea || "leave room for overlays",
            productLocked: planProductAsset.productMetadata?.locked ?? true,
            preserveOriginalAsset: planProductAsset.productMetadata?.preserveOriginalAsset ?? true,
          }
        : scene,
    );

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
      requestedTier: requestedQualityTier || undefined,
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

    let providerJob: Awaited<ReturnType<typeof startVideoProviderJob>>;
    try {
      providerJob = await startVideoProviderJob({
        providerKey: profile.providerKey,
        model: profile.model,
        prompt: plan.renderPrompt,
        seconds: durationSeconds,
      });
    } catch (providerError) {
      return failProviderStart({
        supabase,
        projectId,
        workflowKey,
        creditRequestId: existing?.credit_request_id || creditRequestId,
        currentCreditStatus: existing?.credit_status || "RESERVED",
        currentFailureReferenceId: existing?.failure_reference_id || null,
        currentWorkflowPercentage: existing?.workflow_percentage ?? null,
        currentProviderProgress: existing?.provider_progress ?? null,
        currentProviderJobId: existing?.provider_job_id || null,
        providerError,
      });
    }

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
      scenes,
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
      return NextResponse.json({ ok: false, error: SAFE_TRANSIENT_ERROR, errorCode: "VIDEO_PROVIDER_UNAVAILABLE" }, { status: 503 });
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
      {
        ok: false,
        error: message.includes("temporarily unavailable") ? SAFE_TRANSIENT_ERROR : safeError(message),
        errorCode: message.includes("temporarily unavailable") ? "VIDEO_PROVIDER_UNAVAILABLE" : toSafeProviderErrorCode(message),
      },
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

    let providerJob: Awaited<ReturnType<typeof fetchVideoProviderJob>>;
    try {
      providerJob = await fetchVideoProviderJob({
        providerKey: project.provider,
        model: project.provider_model || "",
        providerJobId: project.provider_job_id,
      });
    } catch (providerError) {
      return NextResponse.json(
        {
          ok: false,
          error: toSafeProviderMessage(providerError),
          errorCode: toSafeProviderErrorCode(providerError),
        },
        { status: 503 },
      );
    }

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

      let finalized: Awaited<ReturnType<typeof finalizeCompletedProject>>;
      try {
        finalized = await finalizeCompletedProject({
          supabase,
          project,
          workspaceId: String(workspaceId),
          userId: user.sub,
          providerOutputUrl: providerJob.outputUrl,
          workflowKey: stableWorkflowKey,
        });
      } catch (finalizeError) {
        const failed = await failFinalizationAndRefund({
          supabase,
          project,
          workflowKey: stableWorkflowKey,
          error: finalizeError,
        });
        return NextResponse.json({
          ok: true,
          projectId: project.id,
          workflowKey: stableWorkflowKey,
          status: "failed",
          stage: "FAILED",
          progress: Math.max(0, Math.min(89, project.workflow_percentage ?? project.provider_progress ?? 0)),
          providerStatus: "failed",
          creditStatus: failed.refunded ? "REFUNDED" : (project.credit_status || "RESERVED"),
          refunded: failed.refunded,
          failureReferenceId: failed.failureReferenceId,
          error: failed.message,
          blockedExactProduct: failed.blockedExactProduct,
        });
      }

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
        videoStoragePath: finalized.storagePath,
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
