import type { WorkspaceProfile } from "@/features/core/local-os";

export const VIDEO_PROMPT_VERSION = "postmotive-video-v1";
export const DEFAULT_VIDEO_DURATION_SECONDS = 12;
export const VIDEO_DURATION_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15] as const;
export const VIDEO_VOICES = [
  "marin",
  "cedar",
  "coral",
  "verse",
  "alloy",
] as const;

export type VideoVoice = (typeof VIDEO_VOICES)[number];
export type VideoMusicMode = "GENERATED_AMBIENT" | "LICENSED_LIBRARY" | "NONE";
export type VideoProvider = "OPENAI" | "OPENAI_SORA_TEMPORARY";
export type VideoRenderTier = "ECONOMY" | "BALANCED" | "PREMIUM";
export type VideoStatus =
  | "DRAFT"
  | "GENERATING"
  | "READY"
  | "FAILED"
  | "APPROVED";

export type VideoWorkflowStage =
  | "PREPARING_VIDEO_PLAN"
  | "RESERVING_CREDITS"
  | "STARTING_VIDEO_GENERATOR"
  | "GENERATING_SCENES"
  | "RENDERING_FINAL_VIDEO"
  | "SAVING_TO_MEDIA_LIBRARY"
  | "CREATING_CONTENT_LIBRARY_DRAFT"
  | "COMPLETE"
  | "FAILED";

export type VideoCreditStatusState = "NONE" | "RESERVED" | "REFUNDED";

export type VideoScene = {
  order: number;
  seconds: number;
  visual: string;
  narration: string;
  onScreenText: string;
  mediaStoragePath?: string;
  mediaAssetId?: string;
  productAssetId?: string;
  productAssetName?: string;
  productMode?: "EXACT_PRODUCT" | "AI_PRODUCT_MOTION";
  productPlacement?: string;
  productScale?: string;
  productOpacity?: number;
  productShadow?: boolean;
  productRotation?: number;
  productEntrance?: "NONE" | "FADE_IN" | "SLIDE_UP";
  productExit?: "NONE" | "FADE_OUT";
  productZoom?: "NONE" | "ZOOM_IN" | "ZOOM_OUT";
  productBackground?: string;
  productSafeArea?: string;
  productLocked?: boolean;
  preserveOriginalAsset?: boolean;
};

export type VideoProject = {
  id: string;
  contentDraftId?: string;
  workflowKey?: string;
  creditRequestId?: string;
  title: string;
  channel: "TikTok" | "Instagram Reels" | "Facebook Reels" | "YouTube Shorts";
  objective: string;
  prompt: string;
  script: string;
  caption: string;
  hashtags: string[];
  callToAction: string;
  scenes: VideoScene[];
  durationSeconds: (typeof VIDEO_DURATION_OPTIONS)[number];
  aspectRatio: "9:16";
  voice: VideoVoice;
  voiceDisclosure: boolean;
  musicMode: VideoMusicMode;
  licensedMusicAssetId?: string;
  provider: VideoProvider;
  routingTier?: VideoRenderTier;
  providerModel?: string;
  providerJobId?: string;
  providerJobStatus?: "queued" | "in_progress" | "completed" | "failed";
  providerProgress?: number;
  workflowStage?: VideoWorkflowStage;
  workflowProgress?: number;
  creditStatus?: VideoCreditStatusState;
  creditRefundedAt?: string;
  failureReferenceId?: string;
  mediaAssetId?: string;
  workflowStartedAt?: string;
  workflowCompletedAt?: string;
  lastProviderPollAt?: string;
  videoStoragePath?: string;
  voiceoverStoragePath?: string;
  status: VideoStatus;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreativeVersion = {
  id: string;
  videoProjectId: string;
  assetKind: "VIDEO" | "VOICEOVER";
  versionNumber: number;
  providerJobId?: string;
  storagePath: string;
  prompt: string;
  voice?: VideoVoice;
  voiceInstructions?: string;
  createdAt: string;
};

export type VideoPlanInput = {
  workspace: WorkspaceProfile;
  channel: VideoProject["channel"];
  objective: string;
  message: string;
  callToAction: string;
  durationSeconds: VideoProject["durationSeconds"];
  voice: VideoVoice;
  musicMode: VideoMusicMode;
  productAsset?: {
    id: string;
    name: string;
    storagePath: string;
    productMetadata?: {
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
  };
  exactProductMode?: boolean;
  allowAiProductMotion?: boolean;
};

export function isVideoVoice(value: unknown): value is VideoVoice {
  return typeof value === "string" &&
    (VIDEO_VOICES as readonly string[]).includes(value);
}

export function isVideoMusicMode(value: unknown): value is VideoMusicMode {
  return value === "GENERATED_AMBIENT" ||
    value === "LICENSED_LIBRARY" ||
    value === "NONE";
}

export function parseVideoPlanInput(value: unknown): VideoPlanInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<VideoPlanInput>;
  const workspace = input.workspace;
  const durationSeconds = Number(input.durationSeconds);
  if (
    !workspace ||
    typeof workspace.businessName !== "string" ||
    typeof workspace.industry !== "string" ||
    typeof input.objective !== "string" ||
    typeof input.message !== "string" ||
    typeof input.callToAction !== "string" ||
    !["TikTok", "Instagram Reels", "Facebook Reels", "YouTube Shorts"].includes(
      String(input.channel),
    ) ||
    !VIDEO_DURATION_OPTIONS.includes(durationSeconds as (typeof VIDEO_DURATION_OPTIONS)[number]) ||
    !isVideoVoice(input.voice) ||
    !isVideoMusicMode(input.musicMode)
  ) {
    return null;
  }
  return input as VideoPlanInput;
}

export function buildVideoPlanningPrompt(input: VideoPlanInput): string {
  const product = input.productAsset;
  const productMetadata = product?.productMetadata;
  return [
    "Create a complete vertical social-video plan as strict JSON.",
    `Brand: ${input.workspace.businessName}`,
    `Website: ${input.workspace.website || "not supplied"}`,
    `Audience: ${input.workspace.audience || "not supplied"}`,
    `Brand voice: ${input.workspace.voice || "clear and confident"}`,
    `Industry: ${input.workspace.industry}`,
    `Channel: ${input.channel}`,
    `Objective: ${input.objective}`,
    `Message: ${input.message}`,
    `Call to action: ${input.callToAction}`,
    `Total duration: ${input.durationSeconds} seconds`,
    `Music mode: ${input.musicMode}`,
    product ? `Product asset: ${product.name} (${product.id})` : "Product asset: none supplied",
    productMetadata?.productName ? `Product name: ${productMetadata.productName}` : "Product name: not supplied",
    productMetadata?.assetRole ? `Product asset role: ${productMetadata.assetRole}` : "Product asset role: not supplied",
    typeof productMetadata?.isPrimaryProductImage === "boolean" ? `Primary product image: ${productMetadata.isPrimaryProductImage ? "yes" : "no"}` : "Primary product image: not supplied",
    productMetadata?.role ? `Product role: ${productMetadata.role}` : "Product role: not supplied",
    productMetadata?.angle ? `Product angle: ${productMetadata.angle}` : "Product angle: not supplied",
    typeof productMetadata?.transparentBackground === "boolean" ? `Transparent background: ${productMetadata.transparentBackground ? "yes" : "no"}` : "Transparent background: not supplied",
    productMetadata?.originalAssetId ? `Original asset ID: ${productMetadata.originalAssetId}` : "Original asset ID: not supplied",
    productMetadata?.background ? `Product background: ${productMetadata.background}` : "Product background: keep brand-safe and neutral",
    productMetadata?.position ? `Product position: ${productMetadata.position}` : "Product position: center it clearly in frame",
    productMetadata?.scale ? `Product scale: ${productMetadata.scale}` : "Product scale: keep the product large enough to read packaging details",
    productMetadata?.safeArea ? `Safe area: ${productMetadata.safeArea}` : "Safe area: leave room for captions and UI overlays",
    input.exactProductMode || productMetadata?.exactProductMode ? "Exact product mode is required: preserve the real product asset exactly and do not redraw packaging or logos." : "Exact product mode is optional.",
    input.allowAiProductMotion || productMetadata?.allowAiMotion ? "AI product motion is allowed only with explicit confirmation and must preserve the original product identity." : "AI product motion is not approved.",
    "Return only JSON with: title, script, caption, renderPrompt, complianceNote, hashtags, callToAction, and scenes.",
    "scenes must be an array of 2-5 objects with order, seconds, visual, narration, and onScreenText.",
    "Scene seconds must total the requested duration.",
    "Keep on-screen text brief and readable. Include burned-in caption wording in the scene plan.",
    "Never invent prices, discounts, certifications, testimonials, legal approval, or product claims.",
    "Do not request real people, celebrities, copyrighted characters, copyrighted music, or third-party watermarks.",
    "If a product asset is supplied, each scene must reference the real product asset, preserve packaging copy exactly, and describe position, scale, opacity, shadow, entrance, exit, zoom, background, and safe area.",
    "Never ask the model to invent or redraw the product. Use the provided product asset as the authoritative visual reference.",
    "The renderPrompt must describe a 9:16 commercial-quality video with original imagery and generated ambient audio only when requested.",
  ].join("\n");
}

export function parseVideoPlanResponse(value: string): {
  title: string;
  script: string;
  caption: string;
  renderPrompt: string;
  complianceNote: string;
  hashtags: string[];
  callToAction: string;
  scenes: VideoScene[];
} | null {
  return parseVideoPlanResponseDetailed(value).plan;
}

export type VideoPlanParseFailureCategory =
  | "empty"
  | "json_parse_error"
  | "validation_failed";

export function parseVideoPlanResponseDetailed(value: string): {
  plan: {
    title: string;
    script: string;
    caption: string;
    renderPrompt: string;
    complianceNote: string;
    hashtags: string[];
    callToAction: string;
    scenes: VideoScene[];
  } | null;
  failureCategory: VideoPlanParseFailureCategory | null;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return { plan: null, failureCategory: "empty" };
  }

  const fenceMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const fenced = fenceMatch ? fenceMatch[1].trim() : trimmed;

  const extractFirstJsonObject = (input: string): string | null => {
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (char === "{") {
        if (start === -1) start = index;
        depth += 1;
      } else if (char === "}") {
        if (depth > 0) depth -= 1;
        if (start !== -1 && depth === 0) {
          return input.slice(start, index + 1);
        }
      }
    }

    return null;
  };

  const candidate = fenced.startsWith("{")
    ? fenced
    : (extractFirstJsonObject(fenced) || fenced);

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    if (
      typeof parsed.title !== "string" ||
      typeof parsed.script !== "string" ||
      typeof parsed.caption !== "string" ||
      typeof parsed.renderPrompt !== "string" ||
      typeof parsed.complianceNote !== "string" ||
      typeof parsed.callToAction !== "string" ||
      !Array.isArray(parsed.hashtags) ||
      !Array.isArray(parsed.scenes)
    ) {
      return { plan: null, failureCategory: "validation_failed" };
    }
    const scenes = parsed.scenes.map((scene, index) => {
      const item = scene as Record<string, unknown>;
      const productMode: VideoScene["productMode"] =
        item.productMode === "EXACT_PRODUCT" || item.productMode === "AI_PRODUCT_MOTION"
          ? item.productMode
          : undefined;
      return {
        order: Number(item.order) || index + 1,
        seconds: Number(item.seconds) || 1,
        visual: String(item.visual || ""),
        narration: String(item.narration || ""),
        onScreenText: String(item.onScreenText || ""),
        mediaStoragePath: typeof item.mediaStoragePath === "string" ? item.mediaStoragePath : undefined,
        mediaAssetId: typeof item.mediaAssetId === "string" ? item.mediaAssetId : undefined,
        productAssetId: typeof item.productAssetId === "string" ? item.productAssetId : undefined,
        productAssetName: typeof item.productAssetName === "string" ? item.productAssetName : undefined,
        productMode,
        productPlacement: typeof item.productPlacement === "string" ? item.productPlacement : undefined,
        productScale: typeof item.productScale === "string" ? item.productScale : undefined,
        productOpacity: Number.isFinite(Number(item.productOpacity)) ? Number(item.productOpacity) : undefined,
        productShadow: typeof item.productShadow === "boolean" ? item.productShadow : undefined,
        productRotation: Number.isFinite(Number(item.productRotation)) ? Number(item.productRotation) : undefined,
        productEntrance:
          item.productEntrance === "NONE" || item.productEntrance === "FADE_IN" || item.productEntrance === "SLIDE_UP"
            ? (item.productEntrance as VideoScene["productEntrance"])
            : undefined,
        productExit:
          item.productExit === "NONE" || item.productExit === "FADE_OUT"
            ? (item.productExit as VideoScene["productExit"])
            : undefined,
        productZoom:
          item.productZoom === "NONE" || item.productZoom === "ZOOM_IN" || item.productZoom === "ZOOM_OUT"
            ? (item.productZoom as VideoScene["productZoom"])
            : undefined,
        productBackground: typeof item.productBackground === "string" ? item.productBackground : undefined,
        productSafeArea: typeof item.productSafeArea === "string" ? item.productSafeArea : undefined,
        productLocked: typeof item.productLocked === "boolean" ? item.productLocked : undefined,
        preserveOriginalAsset: typeof item.preserveOriginalAsset === "boolean" ? item.preserveOriginalAsset : undefined,
      };
    });
    if (!scenes.length || scenes.some((scene) => !scene.visual)) {
      return { plan: null, failureCategory: "validation_failed" };
    }
    return {
      plan: {
        title: parsed.title,
        script: parsed.script,
        caption: parsed.caption,
        renderPrompt: parsed.renderPrompt,
        complianceNote: parsed.complianceNote,
        hashtags: parsed.hashtags.map((item) => String(item).trim()).filter(Boolean),
        callToAction: parsed.callToAction,
        scenes,
      },
      failureCategory: null,
    };
  } catch {
    return { plan: null, failureCategory: "json_parse_error" };
  }
}
