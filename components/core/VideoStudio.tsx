"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadCloudVideoProjects,
  loadCloudCreativeVersions,
  resolveCloudMediaUrl,
  saveCloudCreativeVersion,
  saveCloudDraft,
  saveCloudVideoProject,
  uploadCloudMedia,
} from "@/features/core/cloud-store";
import {
  generateContent,
  loadLocal,
  saveLocal,
  STORAGE_KEYS,
  workspaceStorageKey,
  type ContentDraft,
  type WorkspaceProfile,
} from "@/features/core/local-os";
import { buildCalendarDraftUrl } from "@/features/content/content-navigation";
import {
  DEFAULT_VIDEO_DURATION_SECONDS,
  VIDEO_DURATION_OPTIONS,
  VIDEO_VOICES,
  type CreativeVersion,
  type VideoMusicMode,
  type VideoProject,
  type VideoRenderTier,
  type VideoWorkflowStage,
  type VideoVoice,
} from "@/features/core/video-project";
import {
  canStartVideoRender,
  quoteVideoCredits,
  type VideoCreditStatus,
} from "@/features/core/video-credits";
import {
  getOverlaySpellingIssues,
  type CreationMode,
} from "@/features/core/creative-spec";
import {
  EXACT_PRODUCT_REQUIRED_MESSAGE,
  applyProductSceneMetadata,
  buildProductAssetChoices,
  deriveSelectedProductAssetFromProject,
  describeAssetDimensions,
  isApprovedProductAsset,
  isExplicitProductAsset,
  validateProductImageUpload,
  type ProductAssetChoice,
} from "@/features/core/product-asset-selector";
import {
  createEmptyTimeline,
  createMemeStarterTimeline,
  type CreatorTimeline,
} from "@/features/core/creator-timeline";
import { resolveCreatorTemplate } from "@/features/core/creator-template-catalog";
import { buildCreativeSpecFromVideoProject } from "@/features/core/creative-spec-builder";
import { validateCreativeSpec } from "@/features/core/creative-spec";
import CreativeSpecPreviewPlayer from "@/components/core/remotion/CreativeSpecPreviewPlayer";

type VideoPlanPayload = {
  title?: string;
  script?: string;
  caption?: string;
  renderPrompt?: string;
  complianceNote?: string;
  scenes?: VideoProject["scenes"];
  error?: string;
};

type WorkflowStatusPayload = {
  ok?: boolean;
  projectId?: string;
  workflowKey?: string;
  status?: "in_progress" | "completed" | "failed";
  stage?: VideoWorkflowStage;
  progress?: number;
  providerStatus?: "queued" | "in_progress" | "completed" | "failed";
  creditStatus?: "NONE" | "RESERVED" | "REFUNDED";
  refunded?: boolean;
  failureReferenceId?: string;
  mediaAssetId?: string;
  draftId?: string;
  error?: string;
};

type VideoQualityEstimatePayload = {
  ok?: boolean;
  tier?: VideoRenderTier;
  tierLabel?: string;
  description?: string;
  estimatedCredits?: number;
  estimatedProviderCostUsd?: number;
  expectedGenerationTime?: { label?: string };
  providerDisplayName?: string;
  estimateDisclaimer?: string;
  error?: string;
};

type ProductAssetsApiPayload = {
  ok?: boolean;
  assets?: Array<{
    id: string;
    workspaceId?: string;
    name: string;
    storagePath: string;
    type: string;
    width?: number;
    height?: number;
    tags?: string[];
    approvedForGeneration?: boolean;
    productMetadata?: ProductAssetChoice["productMetadata"];
  }>;
  error?: string;
};

const WORKFLOW_STAGE_LABELS: Record<VideoWorkflowStage, string> = {
  PREPARING_VIDEO_PLAN: "Preparing your video plan",
  RESERVING_CREDITS: "Reserving credits",
  STARTING_VIDEO_GENERATOR: "Starting video generator",
  GENERATING_SCENES: "Generating scenes",
  RENDERING_FINAL_VIDEO: "Rendering final video",
  SAVING_TO_MEDIA_LIBRARY: "Saving to Media Library",
  CREATING_CONTENT_LIBRARY_DRAFT: "Creating Content Library draft",
  COMPLETE: "Complete",
  FAILED: "Video generation didn't complete",
};

function nextPollDelay(attempt: number): number {
  const delay = Math.min(30_000, 2_500 * Math.pow(1.8, Math.max(0, attempt)));
  return Math.round(delay);
}

function composeRenderPrompt(project: VideoProject): string {
  const scenePlan = project.scenes
    .map(
      (scene) =>
        `Scene ${scene.order} (${scene.seconds}s): ${scene.visual}. Narration: ${scene.narration || "none"}. On-screen text: ${scene.onScreenText || "none"}.`,
    )
    .join("\n");
  return [
    project.prompt,
    "Follow this approved scene plan exactly:",
    scenePlan,
    `Spoken script: ${project.script}`,
    `Post caption context: ${project.caption}`,
  ].join("\n");
}

export function isDatabaseUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function createPendingVideoProject(input: {
  project: VideoProject | null;
  channel: VideoProject["channel"];
  objective: string;
  message: string;
  callToAction: string;
  duration: VideoProject["durationSeconds"];
  voice: VideoVoice;
  musicMode: VideoMusicMode;
  qualityTier: VideoRenderTier;
  workflowKey: string;
}): VideoProject {
  const now = new Date().toISOString();
  return {
    id: input.project?.id || `pending-${crypto.randomUUID()}`,
    title: input.project?.title || `Creating ${input.channel} video`,
    channel: input.channel,
    objective: input.objective,
    prompt: input.project?.prompt || "",
    script: input.project?.script || "",
    caption: input.project?.caption || "",
    hashtags: input.project?.hashtags || [],
    callToAction: input.callToAction,
    scenes: input.project?.scenes || [],
    durationSeconds: input.duration,
    aspectRatio: "9:16",
    voice: input.voice,
    voiceDisclosure: true,
    musicMode: input.musicMode,
    routingTier: input.qualityTier,
    provider: "OPENAI_SORA_TEMPORARY",
    providerJobStatus: "queued",
    providerProgress: 5,
    workflowKey: input.workflowKey,
    workflowStage: "PREPARING_VIDEO_PLAN",
    workflowProgress: 5,
    creditStatus: input.project?.creditStatus || "NONE",
    status: "GENERATING",
    failureReason: undefined,
    failureReferenceId: undefined,
    workflowStartedAt: input.project?.workflowStartedAt || now,
    createdAt: input.project?.createdAt || now,
    updatedAt: now,
  };
}

export function markPendingWorkflowFailed(input: {
  project: VideoProject;
  errorMessage: string;
}): VideoProject {
  return {
    ...input.project,
    status: "FAILED",
    providerJobStatus: "failed",
    providerProgress: Math.min(30, Math.max(0, input.project.providerProgress || 5)),
    workflowStage: "FAILED",
    workflowProgress: Math.min(30, Math.max(0, input.project.workflowProgress || 5)),
    failureReason: input.errorMessage,
    failureReferenceId: input.project.failureReferenceId || `vf-${crypto.randomUUID().slice(0, 8)}`,
    updatedAt: new Date().toISOString(),
  };
}

export function shouldPollVideoWorkflow(project: VideoProject | null): boolean {
  return Boolean(project && project.status === "GENERATING" && isDatabaseUuid(project.id));
}

export function resolveRetryProjectId(project: VideoProject | null, retry: boolean): string | undefined {
  if (!retry) return undefined;
  return isDatabaseUuid(project?.id) ? project?.id : undefined;
}

export function removePendingVideoProjects(projects: VideoProject[]): VideoProject[] {
  return projects.filter((item) => isDatabaseUuid(item.id));
}

function formatWorkflowElapsed(startedAt?: string): string {
  if (!startedAt) return "";
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return "";
  const elapsedMs = Math.max(0, Date.now() - start);
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s elapsed`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s elapsed`;
}

export default function VideoStudio({
  workspace,
  creatorFoundation,
}: {
  workspace: WorkspaceProfile;
  creatorFoundation?: {
    creationMode: CreationMode;
    templateId: string;
    concept: string;
  };
}) {
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [versions, setVersions] = useState<CreativeVersion[]>([]);
  const [channel, setChannel] =
    useState<VideoProject["channel"]>("TikTok");
  const [objective, setObjective] = useState("Drive engagement");
  const [message, setMessage] = useState("");
  const [cta, setCta] = useState("Shop now");
  const [duration, setDuration] =
    useState<VideoProject["durationSeconds"]>(DEFAULT_VIDEO_DURATION_SECONDS);
  const [voice, setVoice] = useState<VideoVoice>("marin");
  const [musicMode, setMusicMode] =
    useState<VideoMusicMode>("GENERATED_AMBIENT");
  const [qualityTier, setQualityTier] = useState<VideoRenderTier>("ECONOMY");
  const [qualityEstimate, setQualityEstimate] = useState<VideoQualityEstimatePayload | null>(null);
  const [project, setProject] = useState<VideoProject | null>(null);
  const [complianceNote, setComplianceNote] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [voiceoverUrl, setVoiceoverUrl] = useState("");
  const [voiceInstructions, setVoiceInstructions] = useState(
    "Natural, energetic, confident, and conversational. Moderate pace with a strong opening hook.",
  );
  const [revisionRequest, setRevisionRequest] = useState("");
  const [providerStatus, setProviderStatus] = useState("");
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pollAttempt, setPollAttempt] = useState(0);
  const [workflowKey, setWorkflowKey] = useState("");
  const [creditStatus, setCreditStatus] =
    useState<VideoCreditStatus | null>(null);
  const [creditError, setCreditError] = useState("");
  const [productAssets, setProductAssets] = useState<ProductAssetChoice[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerShowAllImages, setPickerShowAllImages] = useState(false);
  const [pickerActionError, setPickerActionError] = useState("");
  const [productUploadWorking, setProductUploadWorking] = useState(false);
  const [productApproveWorkingId, setProductApproveWorkingId] = useState("");
  const [productSelectionWarning, setProductSelectionWarning] = useState("");
  const [pickerPreviewUrls, setPickerPreviewUrls] = useState<Record<string, string>>({});
  const [selectedProductAssetId, setSelectedProductAssetId] = useState("");
  const [selectedProductPreviewUrl, setSelectedProductPreviewUrl] = useState("");
  const [exactProductMode, setExactProductMode] = useState(true);
  const [lockProductAppearance, setLockProductAppearance] = useState(true);
  const [allowAiProductMotion, setAllowAiProductMotion] = useState(false);
  const [productPlacement, setProductPlacement] = useState("center frame");
  const [productScale, setProductScale] = useState("large and readable");
  const [productBackground, setProductBackground] = useState("brand-safe neutral background");
  const [productSafeArea, setProductSafeArea] = useState("leave room for overlays");
  const checkRenderRef = useRef<() => Promise<void>>(async () => undefined);
  const renderCheckInFlightRef = useRef(false);
  const sceneEditorRef = useRef<HTMLDivElement | null>(null);
  const productUploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadCloudVideoProjects()
        .then((items) => {
          setProjects(items);
          const params = new URLSearchParams(window.location.search);
          const requestedProjectId = params.get("projectId") || "";
          const active = items.find((item) => item.status === "GENERATING");
          const newest = items[0] || null;
          const completedNewest = items.find((item) => item.status === "READY" || item.status === "APPROVED") || null;
          const savedSelectedId = window.localStorage.getItem("postmotive:last-video-project-id") || "";
          const savedSelected = savedSelectedId
            ? items.find((item) => item.id === savedSelectedId) || null
            : null;
          const requested = requestedProjectId
            ? items.find((item) => item.id === requestedProjectId) || null
            : null;
          const resumed =
            requested || active || savedSelected || completedNewest || (newest?.status === "FAILED" ? newest : null);
          if (resumed) {
            setProject(resumed);
            setWorkflowKey(resumed.workflowKey || "");
            setVoice(resumed.voice);
            setQualityTier(resumed.routingTier || "ECONOMY");
            if (resumed.status === "GENERATING") {
              setNotice(
                "You may safely leave this page. Generation will continue.",
              );
            }
          } else {
            setProject(null);
            setWorkflowKey("");
          }
        })
        .catch((caught: unknown) =>
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load video projects.",
          ),
        );
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const syncSelectedProductAsset = (asset: ProductAssetChoice | null) => {
    if (!asset) return;
    setSelectedProductAssetId(asset.id);
    setExactProductMode(true);
    setLockProductAppearance(true);
    setAllowAiProductMotion(
      Boolean(
        asset.productMetadata?.allowAiMotion
          && asset.productMetadata?.exactProductMode === false,
      ),
    );
    setProductPlacement(asset.productMetadata?.position || "center frame");
    setProductScale(asset.productMetadata?.scale || "large and readable");
    setProductBackground(
      asset.productMetadata?.background || "brand-safe neutral background",
    );
    setProductSafeArea(
      asset.productMetadata?.safeArea || "leave room for overlays",
    );
    setProductSelectionWarning("");
  };

  const refreshProductAssets = useCallback(async (includeAll: boolean) => {
    setPickerLoading(true);
    setPickerActionError("");
    try {
      const response = await fetch(includeAll ? "/api/media/product-assets?includeAll=true" : "/api/media/product-assets", {
        cache: "no-store",
      });
      const payload = (await response.json()) as ProductAssetsApiPayload;
      if (!response.ok || !payload.ok || !Array.isArray(payload.assets)) {
        throw new Error(payload.error || "Unable to load product images.");
      }

      const choices = buildProductAssetChoices(
        payload.assets.map((asset) => ({
          id: asset.id,
          workspaceId: asset.workspaceId,
          name: asset.name,
          storagePath: asset.storagePath,
          type: asset.type,
          width: asset.width,
          height: asset.height,
          size: 0,
          tags: asset.tags || [],
          createdAt: "",
          productMetadata: asset.productMetadata,
        })),
        { includeUnapproved: includeAll, activeWorkspaceId: workspace.id },
      );

      setProductAssets(choices);
    } catch (caught) {
      setProductAssets([]);
      setPickerActionError(
        caught instanceof Error
          ? caught.message
          : "Unable to load product images.",
      );
    } finally {
      setPickerLoading(false);
    }
  }, [workspace.id]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void refreshProductAssets(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [refreshProductAssets]);

  useEffect(() => {
    if (!pickerOpen) return;
    const frame = requestAnimationFrame(() => {
      void refreshProductAssets(pickerShowAllImages);
    });
    return () => cancelAnimationFrame(frame);
  }, [pickerOpen, pickerShowAllImages, refreshProductAssets]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!selectedProductAssetId) return;
      const selected = productAssets.find((item) => item.id === selectedProductAssetId) || null;
      if (!selected || !isExplicitProductAsset(selected, workspace.id)) {
        setSelectedProductAssetId("");
        setProductSelectionWarning(
          "The selected product image is no longer accessible. Choose or upload an approved product image.",
        );
        return;
      }
      if (!isApprovedProductAsset(selected)) {
        setSelectedProductAssetId("");
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [productAssets, selectedProductAssetId, workspace.id]);

  const refreshCreditStatus = async () => {
    try {
      const response = await fetch("/api/ai/video-credits", {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | VideoCreditStatus
        | { error?: string };
      if (!response.ok || "error" in payload) {
        throw new Error(
          "error" in payload
            ? payload.error || "Unable to load video credits."
            : "Unable to load video credits.",
        );
      }
      setCreditStatus(payload as VideoCreditStatus);
      setCreditError("");
    } catch (caught) {
      setCreditStatus(null);
      setCreditError(
        caught instanceof Error
          ? caught.message
          : "Unable to load video credits.",
      );
    }
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void refreshCreditStatus();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const frame = requestAnimationFrame(() => {
      void fetch(`/api/ai/video-generation-estimate?durationSeconds=${duration}&tier=${qualityTier}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = (await response.json()) as VideoQualityEstimatePayload;
          if (!response.ok || !payload?.ok) {
            throw new Error(payload?.error || "Unable to load generation estimate.");
          }
          setQualityEstimate(payload);
        })
        .catch(() => {
          setQualityEstimate(null);
        });
    });
    return () => {
      controller.abort();
      cancelAnimationFrame(frame);
    };
  }, [duration, qualityTier]);

  useEffect(() => {
    if (!project?.videoStoragePath) return;
    void resolveCloudMediaUrl(project.videoStoragePath)
      .then(setPreviewUrl)
      .catch(() => undefined);
  }, [project?.videoStoragePath]);

  useEffect(() => {
    if (!project?.voiceoverStoragePath) return;
    void resolveCloudMediaUrl(project.voiceoverStoragePath)
      .then(setVoiceoverUrl)
      .catch(() => undefined);
  }, [project?.voiceoverStoragePath]);

  useEffect(() => {
    const projectId = project?.id;
    if (!isDatabaseUuid(projectId)) return;
    const frame = requestAnimationFrame(() => {
      void loadCloudCreativeVersions(projectId)
        .then((items) => {
          setVersions(items);
          const latestVoice = items.find(
            (item) => item.assetKind === "VOICEOVER",
          );
          if (latestVoice?.voiceInstructions) {
            setVoiceInstructions(latestVoice.voiceInstructions);
          }
        })
        .catch(() => setVersions([]));
    });
    return () => cancelAnimationFrame(frame);
  }, [project?.id]);

  const totalSceneSeconds = useMemo(
    () =>
      project?.scenes.reduce((sum, scene) => sum + scene.seconds, 0) || 0,
    [project?.scenes],
  );
  const timelineFoundation = useMemo<CreatorTimeline>(() => {
    if (creatorFoundation?.creationMode === "MEME") {
      return createMemeStarterTimeline(project?.durationSeconds || duration);
    }

    const timeline = createEmptyTimeline(project?.durationSeconds || duration);
    if (!project?.scenes.length) return timeline;

    const videoTrack = timeline.tracks.find((track) => track.type === "VIDEO");
    const captionTrack = timeline.tracks.find((track) => track.type === "CAPTION");
    if (!videoTrack || !captionTrack) return timeline;

    let cursor = 0;
    for (const scene of project.scenes) {
      videoTrack.clips.push({
        id: `scene-${scene.order}`,
        trackType: "VIDEO",
        startSeconds: cursor,
        durationSeconds: scene.seconds,
        label: `Scene ${scene.order}`,
        content: scene.visual,
      });
      captionTrack.clips.push({
        id: `caption-${scene.order}`,
        trackType: "CAPTION",
        startSeconds: cursor,
        durationSeconds: scene.seconds,
        label: `Overlay ${scene.order}`,
        content: scene.onScreenText,
      });
      cursor += scene.seconds;
    }

    return timeline;
  }, [creatorFoundation, duration, project]);
  const renderSeconds = project?.durationSeconds || duration;
  const renderQuote = useMemo(
    () => quoteVideoCredits(renderSeconds),
    [renderSeconds],
  );
  const renderPermission = creditStatus
    ? canStartVideoRender(creditStatus, renderSeconds)
    : { allowed: false, reason: "Video credit balance is unavailable." };

  const applyCreditUsage = (usage?: {
    chargedCredits?: number;
    remainingCredits?: number;
    monthlyUsedCredits?: number;
    monthlyLimitCredits?: number;
    billingExempt?: boolean;
  }) => {
    if (!usage || !creditStatus) return;
    setCreditStatus({
      ...creditStatus,
      balanceCredits: Number(
        usage.remainingCredits ?? creditStatus.balanceCredits,
      ),
      monthlyUsedCredits: Number(
        usage.monthlyUsedCredits ?? creditStatus.monthlyUsedCredits,
      ),
      monthlyLimitCredits: Number(
        usage.monthlyLimitCredits ?? creditStatus.monthlyLimitCredits,
      ),
      billingExempt: Boolean(
        usage.billingExempt ?? creditStatus.billingExempt,
      ),
    });
  };

  const updateProject = async (next: VideoProject) => {
    if (isDatabaseUuid(next.id)) {
      window.localStorage.setItem("postmotive:last-video-project-id", next.id);
    }
    setProject(next);
    setProjects((current) => {
      const exists = current.some((item) => item.id === next.id);
      return exists
        ? current.map((item) => (item.id === next.id ? next : item))
        : [next, ...current];
    });
    if (!isDatabaseUuid(next.id)) {
      return;
    }
    await saveCloudVideoProject(next);
  };

  const nextVersionNumber = (
    assetKind: CreativeVersion["assetKind"],
  ): number =>
    Math.max(
      0,
      ...versions
        .filter((item) => item.assetKind === assetKind)
        .map((item) => item.versionNumber),
    ) + 1;

  const selectedProductAsset =
    productAssets.find((item) => item.id === selectedProductAssetId) || null;

  const canGenerateInExactMode =
    !exactProductMode || Boolean(selectedProductAsset && isExplicitProductAsset(selectedProductAsset, workspace.id) && isApprovedProductAsset(selectedProductAsset));

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      const queryAssetId = params.get("assetId") || "";
      if (!queryAssetId || selectedProductAssetId) return;

      const matched = productAssets.find((item) => item.id === queryAssetId) || null;
      if (matched && isExplicitProductAsset(matched, workspace.id) && isApprovedProductAsset(matched)) {
        syncSelectedProductAsset(matched);
        return;
      }

      if (matched && !isApprovedProductAsset(matched)) {
        setProductSelectionWarning(
          "This product image must be approved for product use before selection.",
        );
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [productAssets, selectedProductAssetId, workspace.id]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!project) return;
      const derived = deriveSelectedProductAssetFromProject(project);
      if (!derived?.assetId) return;

      if (selectedProductAssetId && selectedProductAssetId === derived.assetId) {
        return;
      }

      const matched = productAssets.find((item) => item.id === derived.assetId) || null;
      if (matched && isExplicitProductAsset(matched, workspace.id) && isApprovedProductAsset(matched)) {
        syncSelectedProductAsset(matched);
        return;
      }

      setProductSelectionWarning(
        "The previously selected product image is no longer available. Choose or upload an approved product image to continue.",
      );
      setSelectedProductAssetId("");
    });

    return () => cancelAnimationFrame(frame);
  }, [project, productAssets, selectedProductAssetId, workspace.id]);

  useEffect(() => {
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (!selectedProductAsset?.storagePath) {
        if (!cancelled) setSelectedProductPreviewUrl("");
        return;
      }
      void resolveCloudMediaUrl(selectedProductAsset.storagePath)
        .then((url) => {
          if (!cancelled) setSelectedProductPreviewUrl(url);
        })
        .catch(() => {
          if (!cancelled) setSelectedProductPreviewUrl("");
        });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [selectedProductAsset?.storagePath]);

  const selectedProductAssetPayload = selectedProductAsset
    ? {
        id: selectedProductAsset.id,
        name: selectedProductAsset.name,
        storagePath: selectedProductAsset.storagePath,
        productMetadata: {
          ...selectedProductAsset.productMetadata,
          assetRole: selectedProductAsset.productMetadata?.assetRole || selectedProductAsset.productMetadata?.role || "PRIMARY",
          isPrimaryProductImage: selectedProductAsset.productMetadata?.isPrimaryProductImage ?? true,
          approvedForGeneration: selectedProductAsset.productMetadata?.approvedForGeneration ?? true,
          locked: lockProductAppearance,
          transparentBackground: selectedProductAsset.productMetadata?.transparentBackground ?? true,
          originalAssetId: selectedProductAsset.productMetadata?.originalAssetId || selectedProductAsset.id,
          exactProductMode,
          allowAiMotion: allowAiProductMotion,
          preserveOriginalAsset: selectedProductAsset.productMetadata?.preserveOriginalAsset ?? true,
          originalStoragePath: selectedProductAsset.productMetadata?.originalStoragePath || selectedProductAsset.storagePath,
          position: productPlacement,
          scale: productScale,
          background: productBackground,
          safeArea: productSafeArea,
        },
      }
    : undefined;

  const visibleProductAssets = useMemo(() => productAssets, [productAssets]);

  useEffect(() => {
    if (!pickerOpen || !visibleProductAssets.length) return;
    const unresolved = visibleProductAssets
      .filter((asset) => !pickerPreviewUrls[asset.id])
      .slice(0, 24);
    if (!unresolved.length) return;

    let cancelled = false;
    void Promise.all(
      unresolved.map(async (asset) => {
        if (!asset.storagePath) return [asset.id, ""] as const;
        try {
          const url = await resolveCloudMediaUrl(asset.storagePath);
          return [asset.id, url] as const;
        } catch {
          return [asset.id, ""] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setPickerPreviewUrls((current) => {
        const next = { ...current };
        for (const [assetId, url] of entries) {
          if (url) next[assetId] = url;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [pickerOpen, pickerPreviewUrls, visibleProductAssets]);

  const selectApprovedProductAsset = (asset: ProductAssetChoice) => {
    if (!isApprovedProductAsset(asset)) {
      setPickerActionError(
        "Approve this image for product use before selecting it in Exact Product Mode.",
      );
      return;
    }
    syncSelectedProductAsset(asset);
    setPickerOpen(false);
    setPickerActionError("");
  };

  const approveProductAssetForUse = async (asset: ProductAssetChoice) => {
    setProductApproveWorkingId(asset.id);
    setPickerActionError("");
    try {
      const response = await fetch("/api/media/product-assets", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId: asset.id }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        asset?: {
          id: string;
          name: string;
          storagePath: string;
          type: string;
          width?: number;
          height?: number;
          tags?: string[];
          productMetadata?: ProductAssetChoice["productMetadata"];
        };
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to approve product image.");
      }
      await refreshProductAssets(pickerShowAllImages);
      const approvedAsset = payload.asset
        ? buildProductAssetChoices(
          [{
            id: payload.asset.id,
            workspaceId: workspace.id,
            name: payload.asset.name,
            storagePath: payload.asset.storagePath,
            type: payload.asset.type,
            width: payload.asset.width,
            height: payload.asset.height,
            size: 0,
            tags: payload.asset.tags || [],
            createdAt: "",
            productMetadata: payload.asset.productMetadata,
          }],
          { includeUnapproved: true, activeWorkspaceId: workspace.id },
        )[0] || null
        : null;
      if (approvedAsset && isApprovedProductAsset(approvedAsset)) {
        syncSelectedProductAsset(approvedAsset);
        setPickerOpen(false);
      }
    } catch (caught) {
      setPickerActionError(
        caught instanceof Error
          ? caught.message
          : "Unable to approve product image.",
      );
    } finally {
      setProductApproveWorkingId("");
    }
  };

  const inferImageDimensions = async (file: File): Promise<{ width?: number; height?: number }> => {
    if (!file.type.startsWith("image/")) return {};
    const objectUrl = URL.createObjectURL(file);
    try {
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.width, height: image.height });
        image.onerror = () => reject(new Error("Unable to read image dimensions."));
        image.src = objectUrl;
      });
      return dimensions;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const uploadAndSelectProductImage = async (file: File) => {
    const validationError = validateProductImageUpload(file);
    if (validationError) {
      setPickerActionError(validationError);
      return;
    }

    setProductUploadWorking(true);
    setPickerActionError("");
    try {
      const dimensions = await inferImageDimensions(file);
      const uploaded = await uploadCloudMedia(
        file,
        ["product", "exact-product"],
        undefined,
        {
          source: "UPLOADED",
          generationStatus: "READY",
          width: dimensions.width,
          height: dimensions.height,
          productMetadata: {
            approvedForGeneration: false,
            role: "PRIMARY",
            assetRole: "PRIMARY",
            isPrimaryProductImage: true,
            locked: true,
            exactProductMode: true,
            allowAiMotion: false,
            preserveOriginalAsset: true,
          },
        },
      );

      const uploadedChoice = buildProductAssetChoices([uploaded], { includeUnapproved: true })[0] || null;
      if (!uploadedChoice) {
        throw new Error("Uploaded image is not supported for exact product mode.");
      }

      await approveProductAssetForUse(uploadedChoice);
      await refreshProductAssets(pickerShowAllImages);
    } catch (caught) {
      setPickerActionError(
        caught instanceof Error
          ? caught.message
          : "Unable to upload product image.",
      );
    } finally {
      setProductUploadWorking(false);
      if (productUploadInputRef.current) {
        productUploadInputRef.current.value = "";
      }
    }
  };

  const overlaySpellingIssues = useMemo(
    () => (project?.scenes || []).flatMap((scene, index) =>
      getOverlaySpellingIssues(scene.onScreenText).map((issue) => `Scene ${index + 1}: ${issue}`),
    ),
    [project?.scenes],
  );

  const ensureOverlaySpellingIsValid = (): boolean => {
    if (!overlaySpellingIssues.length) return true;
    setError(`Fix on-screen text spelling before continuing. ${overlaySpellingIssues[0]}`);
    return false;
  };

  const addVersion = async (version: CreativeVersion) => {
    await saveCloudCreativeVersion(version);
    setVersions((current) => [version, ...current]);
  };

  const refreshVideoProjects = async (preferredId?: string) => {
    const items = await loadCloudVideoProjects();
    setProjects(items);
    const active = items.find((item) => item.status === "GENERATING") || null;
    const newest = items[0] || null;
    const nextProject =
      items.find((item) => item.id === preferredId) ||
      active ||
      (newest?.status === "FAILED" ? newest : null) ||
      null;
    if (nextProject) {
      setProject(nextProject);
      setWorkflowKey(nextProject.workflowKey || "");
      setVoice(nextProject.voice);
      if (nextProject.status === "GENERATING") {
        setNotice(
          "You may safely leave this page. Generation will continue.",
        );
      }
    } else {
      setProject(null);
      setWorkflowKey("");
    }
  };

  const createWorkflowKey = () =>
    [workspace.id, channel, duration, selectedProductAssetId || "no-product", exactProductMode ? "exact" : "motion", crypto.randomUUID()].join("|").toLowerCase();

  const startNewVideo = () => {
    setProject(null);
    setProjects((current) => removePendingVideoProjects(current));
    setWorkflowKey("");
    setProviderStatus("");
    setNotice("");
    setError("");
    setPollAttempt(0);
    setPreviewUrl("");
    setVoiceoverUrl("");
    setRevisionRequest("");
    setComplianceNote("");
    renderCheckInFlightRef.current = false;
  };

  const startWorkflow = async (options?: { retry?: boolean }) => {
    setWorking("workflow");
    setError("");
    setNotice("");
    try {
      if (project?.scenes.length && !ensureOverlaySpellingIsValid()) {
        return;
      }
      if (!canGenerateInExactMode) {
        throw new Error(EXACT_PRODUCT_REQUIRED_MESSAGE);
      }
      const retry = Boolean(options?.retry);
      const activeWorkflowKey = retry
        ? (project?.workflowKey || workflowKey || "")
        : (workflowKey || createWorkflowKey());
      if (!workflowKey) {
        setWorkflowKey(activeWorkflowKey);
      }

      const optimisticProject = createPendingVideoProject({
        project,
        channel,
        objective,
        message,
        callToAction: cta,
        duration,
        voice,
        musicMode,
        qualityTier,
        workflowKey: activeWorkflowKey,
      });
      setProject(optimisticProject);
      setProjects((current) => {
        const exists = current.some((item) => item.id === optimisticProject.id);
        return exists
          ? current.map((item) => (item.id === optimisticProject.id ? optimisticProject : item))
          : [optimisticProject, ...current];
      });

      const response = await fetch("/api/ai/video-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          objective,
          message,
          callToAction: cta,
          durationSeconds: duration,
          voice,
          musicMode,
          workflowKey: activeWorkflowKey,
          projectId: resolveRetryProjectId(project, retry),
          retry,
          productAsset: selectedProductAssetPayload,
          exactProductMode,
          allowAiProductMotion,
          qualityTier,
          creationMode: creatorFoundation?.creationMode,
          templateId: creatorFoundation?.templateId,
          concept: creatorFoundation?.concept,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        projectId?: string;
        draftId?: string;
        workflowKey?: string;
        stage?: VideoWorkflowStage;
        progress?: number;
      } | null;
      if (!response.ok || !payload?.ok || !payload.projectId) {
        throw new Error(payload?.error || "Video generation could not start.");
      }
      await refreshVideoProjects(payload.projectId);
      setPollAttempt(0);
      setNotice(
        "You may safely leave this page. Generation will continue.",
      );
    } catch (caught) {
      if (project) {
        setProject(markPendingWorkflowFailed({
          project,
          errorMessage:
            caught instanceof Error
              ? caught.message
              : "Video generation could not start.",
        }));
      }
      setPollAttempt(0);
      renderCheckInFlightRef.current = false;
      setError(
        caught instanceof Error
          ? caught.message
          : "Video generation could not start.",
      );
    } finally {
      setWorking("");
    }
  };

  const generatePlan = async () => {
    setWorking("plan");
    setError("");
    setNotice("");
    try {
      if (!canGenerateInExactMode) {
        throw new Error(EXACT_PRODUCT_REQUIRED_MESSAGE);
      }
      const response = await fetch("/api/ai/video-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace,
          channel,
          objective,
          message,
          callToAction: cta,
          durationSeconds: duration,
          voice,
          musicMode,
          productAsset: selectedProductAssetPayload,
          exactProductMode,
          allowAiProductMotion,
          creationMode: creatorFoundation?.creationMode,
          templateId: creatorFoundation?.templateId,
          concept: creatorFoundation?.concept,
        }),
      });
      const payload = (await response.json()) as VideoPlanPayload;
      if (
        !response.ok ||
        !payload.title ||
        !payload.script ||
        !payload.caption ||
        !payload.renderPrompt ||
        !payload.scenes
      ) {
        throw new Error(payload.error || "Video planning failed.");
      }
      const now = new Date().toISOString();
      const scenes = applyProductSceneMetadata(payload.scenes || [], selectedProductAsset, allowAiProductMotion);
      const next: VideoProject = {
        id: crypto.randomUUID(),
        title: payload.title,
        channel,
        objective,
        prompt: payload.renderPrompt,
        script: payload.script,
        caption: payload.caption,
        hashtags: [],
        callToAction: cta,
        scenes,
        durationSeconds: duration,
        aspectRatio: "9:16",
        voice,
        voiceDisclosure: true,
        musicMode,
        routingTier: qualityTier,
        provider: "OPENAI_SORA_TEMPORARY",
        status: "DRAFT",
        createdAt: now,
        updatedAt: now,
      };
      await updateProject(next);
      setComplianceNote(payload.complianceNote || "");
      setPreviewUrl("");
      setVoiceoverUrl("");
      setNotice("Video plan created. Review the scenes before generating media.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Video planning failed.",
      );
    } finally {
      setWorking("");
    }
  };

  const generateVoiceover = async () => {
    if (!project) return;
    setWorking("voice");
    setError("");
    try {
      const response = await fetch("/api/ai/voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: project.script,
          voice: project.voice,
          instructions: `${voiceInstructions} Use a ${workspace.voice || "clear, confident"} brand voice. Do not imitate a real person.`,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "Voiceover generation failed.");
      }
      const blob = await response.blob();
      const file = new File(
        [blob],
        `${project.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 80)}-voiceover.mp3`,
        { type: "audio/mpeg" },
      );
      const asset = await uploadCloudMedia(file, [
        "voiceover",
        "ai-generated",
        project.channel.toLowerCase(),
      ]);
      if (voiceoverUrl.startsWith("blob:")) URL.revokeObjectURL(voiceoverUrl);
      setVoiceoverUrl(URL.createObjectURL(blob));
      const voiceVersion: CreativeVersion = {
        id: crypto.randomUUID(),
        videoProjectId: project.id,
        assetKind: "VOICEOVER",
        versionNumber: nextVersionNumber("VOICEOVER"),
        storagePath: asset.storagePath || "",
        prompt: project.script,
        voice: project.voice,
        voiceInstructions,
        createdAt: new Date().toISOString(),
      };
      await addVersion(voiceVersion);
      await updateProject({
        ...project,
        voiceoverStoragePath: asset.storagePath,
        updatedAt: new Date().toISOString(),
      });
      setNotice(
        `Voiceover version ${voiceVersion.versionNumber} created and saved. The published video must disclose that the voice is AI-generated.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Voiceover generation failed.",
      );
    } finally {
      setWorking("");
    }
  };

  const startRender = async () => {
    if (!project) return;
    if (!ensureOverlaySpellingIsValid()) return;
    if (!renderPermission.allowed) {
      setError(renderPermission.reason || "Video credits are unavailable.");
      return;
    }
    setWorking("render");
    setError("");
    try {
      const response = await fetch("/api/ai/video-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: composeRenderPrompt(project),
          seconds: project.durationSeconds,
        }),
      });
      const payload = (await response.json()) as {
        id?: string;
        status?: string;
        progress?: number;
        creditUsage?: {
          chargedCredits?: number;
          remainingCredits?: number;
          monthlyUsedCredits?: number;
          monthlyLimitCredits?: number;
          billingExempt?: boolean;
        };
        error?: string;
      };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error || "Video generation could not start.");
      }
      applyCreditUsage(payload.creditUsage);
      await updateProject({
        ...project,
        providerJobId: payload.id,
        providerProgress: payload.progress || 0,
        status: "GENERATING",
        failureReason: undefined,
        updatedAt: new Date().toISOString(),
      });
      setProviderStatus(payload.status || "queued");
      setNotice(
        "Video generation started. It may take 5–10 minutes. You can leave this page and return while it continues processing.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Video generation could not start.",
      );
    } finally {
      setWorking("");
    }
  };

  const startRevision = async (
    mode: "edit" | "fresh" = "edit",
    requestOverride?: string,
  ) => {
    if (!project?.videoStoragePath) return;
    if (!ensureOverlaySpellingIsValid()) return;
    const requestedChange = (requestOverride || revisionRequest).trim();
    if (!requestedChange) {
      setError("Describe the video change you want first.");
      return;
    }
    const sourceVersion = versions.find(
      (item) =>
        item.assetKind === "VIDEO" &&
        item.storagePath === project.videoStoragePath,
    );
    const sourceVideoId = sourceVersion?.providerJobId || project.providerJobId;
    if (mode === "edit" && !sourceVideoId) {
      setError(
        "The source video ID is unavailable. Use Generate fresh revision instead.",
      );
      return;
    }
    if (!renderPermission.allowed) {
      setError(renderPermission.reason || "Video credits are unavailable.");
      return;
    }
    setWorking("revision");
    setError("");
    try {
      if (
        !versions.some(
          (item) =>
            item.assetKind === "VIDEO" &&
            item.storagePath === project.videoStoragePath,
        )
      ) {
        await addVersion({
          id: crypto.randomUUID(),
          videoProjectId: project.id,
          assetKind: "VIDEO",
          versionNumber: nextVersionNumber("VIDEO"),
          providerJobId: project.providerJobId,
          storagePath: project.videoStoragePath,
          prompt: project.prompt,
          createdAt: new Date().toISOString(),
        });
      }
      const response = await fetch("/api/ai/video-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceVideoId: mode === "edit" ? sourceVideoId : undefined,
          prompt: [
            `Requested revision: ${requestedChange}`,
            composeRenderPrompt(project),
          ].join("\n"),
          seconds: project.durationSeconds,
        }),
      });
      const payload = (await response.json()) as {
        id?: string;
        status?: string;
        progress?: number;
        creditUsage?: {
          chargedCredits?: number;
          remainingCredits?: number;
          monthlyUsedCredits?: number;
          monthlyLimitCredits?: number;
          billingExempt?: boolean;
        };
        error?: string;
      };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error || "Video revision could not start.");
      }
      applyCreditUsage(payload.creditUsage);
      await updateProject({
        ...project,
        providerJobId: payload.id,
        providerProgress: payload.progress || 0,
        status: "GENERATING",
        failureReason: undefined,
        updatedAt: new Date().toISOString(),
      });
      setProviderStatus(payload.status || "queued");
      setNotice(
        mode === "edit"
          ? "Targeted video revision is queued at the provider. The current version remains saved."
          : "Fresh revised video is queued at the provider. The current version remains saved.",
      );
      if (!requestOverride) setRevisionRequest("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Video revision could not start.",
      );
    } finally {
      setWorking("");
    }
  };

  const checkRender = async (silent = false) => {
    const activeProject = project;
    if (!activeProject || !shouldPollVideoWorkflow(activeProject)) return;
    if (renderCheckInFlightRef.current) {
      if (!silent) {
        setNotice("A render status check is already in progress.");
      }
      return;
    }
    renderCheckInFlightRef.current = true;
    if (!silent) setWorking("status");
    setError("");
    try {
      const response = await fetch(
        `/api/ai/video-workflow?projectId=${encodeURIComponent(activeProject.id)}&workflowKey=${encodeURIComponent(activeProject.workflowKey || workflowKey)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as WorkflowStatusPayload | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error || "Unable to check video status.");
      }

      const providerProgress = Math.max(0, Math.min(100, Number(payload.progress || 0)));
      const nextProviderStatus = payload.providerStatus || "in_progress";
      setProviderStatus(nextProviderStatus);

      if (payload.status === "failed") {
        await updateProject({
          ...activeProject,
          status: "FAILED",
          providerJobStatus: nextProviderStatus,
          providerProgress: Math.min(94, providerProgress),
          workflowStage: payload.stage || "FAILED",
          workflowProgress: Math.min(94, providerProgress),
          creditStatus: payload.creditStatus || activeProject.creditStatus || "REFUNDED",
          failureReferenceId: payload.failureReferenceId || activeProject.failureReferenceId,
          failureReason: payload.error || "Video generation didn't complete.",
          updatedAt: new Date().toISOString(),
        });
        throw new Error(payload.error || "Video generation didn't complete.");
      }

      if (payload.status === "completed") {
        await updateProject({
          ...activeProject,
          status: "READY",
          providerJobStatus: "completed",
          providerProgress: 100,
          workflowStage: "COMPLETE",
          workflowProgress: 100,
          creditStatus: payload.creditStatus || activeProject.creditStatus || "RESERVED",
          mediaAssetId: payload.mediaAssetId || activeProject.mediaAssetId,
          contentDraftId: payload.draftId || activeProject.contentDraftId,
          updatedAt: new Date().toISOString(),
        });
        setPollAttempt(0);
        setNotice("Video generation complete. Your video and draft are ready.");
        return;
      }

      await updateProject({
        ...activeProject,
        status: "GENERATING",
        providerJobStatus: nextProviderStatus,
        providerProgress,
        workflowStage: payload.stage || (providerProgress >= 70 ? "RENDERING_FINAL_VIDEO" : "GENERATING_SCENES"),
        workflowProgress: Math.min(94, Math.max(providerProgress, Number(payload.progress || 0))),
        creditStatus: payload.creditStatus || activeProject.creditStatus || "RESERVED",
        updatedAt: new Date().toISOString(),
      });
      setNotice("You may safely leave this page. Generation will continue.");
      setPollAttempt(0);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to finish the video.",
      );
      setPollAttempt((current) => current + 1);
    } finally {
      renderCheckInFlightRef.current = false;
      if (!silent) setWorking("");
    }
  };

  const cancelRender = async () => {
    if (!project?.providerJobId) return;
    setWorking("cancel");
    setError("");
    try {
      const response = await fetch(
        `/api/ai/video-render?id=${encodeURIComponent(project.providerJobId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "Unable to cancel this render.");
      }
      const sourceVersion = versions.find(
        (item) =>
          item.assetKind === "VIDEO" &&
          item.storagePath === project.videoStoragePath,
      );
      await updateProject({
        ...project,
        providerJobId: sourceVersion?.providerJobId,
        providerProgress: undefined,
        status: project.videoStoragePath ? "READY" : "DRAFT",
        failureReason: undefined,
        updatedAt: new Date().toISOString(),
      });
      setProviderStatus("");
      setNotice(
        "Queued render canceled. Your previous video is still safe and ready.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to cancel this render.",
      );
    } finally {
      setWorking("");
    }
  };

  const savePlanEdits = async () => {
    if (!project) return;
    if (!ensureOverlaySpellingIsValid()) return;
    setWorking("save");
    setError("");
    try {
      await updateProject({
        ...project,
        updatedAt: new Date().toISOString(),
      });
      setNotice("Script, caption, scenes, and voice settings saved.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save edits.",
      );
    } finally {
      setWorking("");
    }
  };

  const moveScene = async (sceneIndex: number, direction: -1 | 1) => {
    if (!project) return;
    const nextIndex = sceneIndex + direction;
    if (nextIndex < 0 || nextIndex >= project.scenes.length) return;
    const nextScenes = [...project.scenes];
    const [scene] = nextScenes.splice(sceneIndex, 1);
    nextScenes.splice(nextIndex, 0, scene);
    await updateProject({
      ...project,
      scenes: nextScenes.map((item, index) => ({ ...item, order: index + 1 })),
      updatedAt: new Date().toISOString(),
    });
  };

  const trimScene = async (sceneIndex: number, direction: -1 | 1) => {
    if (!project) return;
    const nextScenes = project.scenes.map((item, index) =>
      index === sceneIndex
        ? {
            ...item,
            seconds: Math.max(1, Math.min(15, item.seconds + direction)),
          }
        : item,
    );
    const nextTotal = nextScenes.reduce((sum, scene) => sum + scene.seconds, 0);
    if (nextTotal > project.durationSeconds) {
      setError("Scene timing cannot exceed the total video length.");
      return;
    }
    await updateProject({
      ...project,
      scenes: nextScenes,
      updatedAt: new Date().toISOString(),
    });
  };

  const replaceSceneMedia = async (sceneIndex: number, mediaStoragePath: string) => {
    if (!project) return;
    await updateProject({
      ...project,
      scenes: project.scenes.map((item, index) =>
        index === sceneIndex
          ? {
              ...item,
              mediaStoragePath: mediaStoragePath || undefined,
            }
          : item,
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  const regenerateScene = async (sceneIndex: number) => {
    if (!project) return;
    const scene = project.scenes[sceneIndex];
    if (!scene) return;
    await startRevision(
      "edit",
      `Regenerate scene ${scene.order}: ${scene.visual}. Keep the duration at ${scene.seconds} seconds and preserve the overall message.`,
    );
  };

  const restoreVersion = async (version: CreativeVersion) => {
    if (!project) return;
    setWorking("restore");
    setError("");
    try {
      const url = await resolveCloudMediaUrl(version.storagePath);
      if (version.assetKind === "VIDEO") {
        setPreviewUrl(url);
        await updateProject({
          ...project,
          providerJobId: version.providerJobId || project.providerJobId,
          videoStoragePath: version.storagePath,
          status: "READY",
          updatedAt: new Date().toISOString(),
        });
      } else {
        setVoiceoverUrl(url);
        setVoice(version.voice || project.voice);
        setVoiceInstructions(
          version.voiceInstructions || voiceInstructions,
        );
        await updateProject({
          ...project,
          voice: version.voice || project.voice,
          voiceoverStoragePath: version.storagePath,
          updatedAt: new Date().toISOString(),
        });
      }
      setNotice(
        `${version.assetKind === "VIDEO" ? "Video" : "Voiceover"} version ${version.versionNumber} restored.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to restore version.",
      );
    } finally {
      setWorking("");
    }
  };

  useEffect(() => {
    checkRenderRef.current = () => checkRender(true);
  });

  useEffect(() => {
    const activeProject = project;
    if (!activeProject || !shouldPollVideoWorkflow(activeProject)) {
      return;
    }
    if (activeProject.creditStatus === "REFUNDED") {
      return;
    }
    const timeout = window.setTimeout(
      () => void checkRenderRef.current(),
      nextPollDelay(pollAttempt),
    );
    return () => {
      window.clearTimeout(timeout);
    };
  }, [project, pollAttempt]);

  const schedule = async () => {
    if (!project?.videoStoragePath) {
      setError("Finish the video before scheduling it.");
      return;
    }
    setWorking("schedule");
    setError("");
    try {
      const draftId = project.contentDraftId || crypto.randomUUID();
      const generated = generateContent({
        workspace,
        entryType: "POST",
        channel: "tiktok",
        objective: project.objective,
        offer: project.caption,
        callToAction: cta,
      });
      const draft: ContentDraft = {
        id: draftId,
        title: project.title,
        copy: project.caption || generated.copy,
        complianceNote:
          complianceNote ||
          "Review the video, captions, music rights, claims, and TikTok settings before publishing.",
        status: "DRAFT",
        createdAt: new Date().toISOString(),
        entryType: "POST",
        channel: "tiktok",
        objective: project.objective,
        originalCopy: project.caption,
        model: "video-studio",
        promptVersion: "postmotive-video-v1",
        contentFormat: "VERTICAL_VIDEO",
        videoProjectId: project.id,
        mediaStoragePath: project.videoStoragePath,
      };
      await saveCloudDraft(draft);
      await updateProject({
        ...project,
        contentDraftId: draftId,
        status: "APPROVED",
        updatedAt: new Date().toISOString(),
      });
      const localDrafts = loadLocal<ContentDraft[]>(workspaceStorageKey(STORAGE_KEYS.drafts, workspace.id), []);
      saveLocal(workspaceStorageKey(STORAGE_KEYS.drafts, workspace.id), [
        draft,
        ...localDrafts.filter((item) => item.id !== draft.id),
      ]);
      window.location.assign(buildCalendarDraftUrl(draft.id));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to send video to the calendar.",
      );
      setWorking("");
    }
  };

  const postNow = async () => {
    if (!project || !project.videoStoragePath) {
      setError("Finish the video before posting now.");
      return;
    }
    if (project.status !== "APPROVED") {
      setError("Approve the video before posting now.");
      return;
    }
    if (!window.confirm("Post this approved video now?")) return;

    setWorking("post-now");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/publishing/post-now/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          videoProjectId: project.id,
          channel: project.channel,
          idempotencyKey: `${project.id}:${new Date().toISOString().slice(0, 16)}`,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        duplicate?: boolean;
        setupRedirect?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        if (payload.setupRedirect) {
          window.location.assign(payload.setupRedirect);
          return;
        }
        throw new Error(payload.error || "Unable to post now.");
      }
      setNotice(
        payload.duplicate
          ? "This video was already queued or published. Duplicate posting was prevented."
          : "Video queued for immediate publishing.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to post now.");
    } finally {
      setWorking("");
    }
  };

  const createRevisionVersion = async () => {
    if (!project?.videoStoragePath) {
      setError("Generate a completed video first.");
      return;
    }
    setWorking("revision");
    setError("");
    try {
      const version: CreativeVersion = {
        id: crypto.randomUUID(),
        videoProjectId: project.id,
        assetKind: "VIDEO",
        versionNumber: nextVersionNumber("VIDEO"),
        providerJobId: project.providerJobId,
        storagePath: project.videoStoragePath,
        prompt: composeRenderPrompt(project),
        createdAt: new Date().toISOString(),
      };
      await addVersion(version);
      setNotice(`Revision version v${version.versionNumber} created.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create revision.");
    } finally {
      setWorking("");
    }
  };

  const duplicateProject = async () => {
    if (!project) return;
    setWorking("duplicate");
    setError("");
    try {
      const now = new Date().toISOString();
      const duplicated: VideoProject = {
        ...project,
        id: crypto.randomUUID(),
        title: `${project.title} (copy)`,
        status: "DRAFT",
        providerJobId: undefined,
        providerJobStatus: undefined,
        providerProgress: undefined,
        workflowStage: undefined,
        workflowProgress: undefined,
        workflowKey: undefined,
        contentDraftId: undefined,
        createdAt: now,
        updatedAt: now,
      };
      await saveCloudVideoProject(duplicated);
      setProject(duplicated);
      setProjects((current) => [duplicated, ...current]);
      setNotice("Project duplicated. You can edit and render this revision independently.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to duplicate project.");
    } finally {
      setWorking("");
    }
  };

  const openEditor = () => {
    sceneEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const downloadCompletedVideo = () => {
    if (!previewUrl) {
      setError("Video preview is still loading.");
      return;
    }
    const link = document.createElement("a");
    link.href = previewUrl;
    link.download = `${(project?.title || "video").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.mp4`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const approveCompletedVideo = async () => {
    if (!project || project.status !== "READY") return;
    setWorking("approve");
    setError("");
    try {
      await updateProject({
        ...project,
        status: "APPROVED",
        updatedAt: new Date().toISOString(),
      });
      setNotice("Video approved. You can now schedule or post it.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to approve video.");
    } finally {
      setWorking("");
    }
  };

  const activeJob = project?.status === "GENERATING";
  const inferredStage: VideoWorkflowStage =
    project?.status === "READY"
      ? "COMPLETE"
      : project?.status === "FAILED"
        ? "FAILED"
        : project?.workflowStage
          || ((project?.providerProgress || 0) >= 70
            ? "RENDERING_FINAL_VIDEO"
            : "GENERATING_SCENES");
  const workflowPercent = project
    ? (project.status === "READY" || project.status === "APPROVED"
      ? 100
      : project.status === "FAILED"
        ? Math.min(94, Math.max(0, Math.round(project.workflowProgress ?? project.providerProgress ?? 0)))
        : Math.min(94, Math.max(5, Math.round(project.workflowProgress ?? project.providerProgress ?? 5))))
    : 0;
  const workflowStageLabel = project ? WORKFLOW_STAGE_LABELS[inferredStage] : WORKFLOW_STAGE_LABELS.PREPARING_VIDEO_PLAN;
  const workflowElapsed = project?.status === "GENERATING"
    ? formatWorkflowElapsed(project.workflowStartedAt || project.createdAt)
    : "";
  const workflowStatusText = project?.status === "FAILED"
    ? "Please retry this project or create a new video workflow."
    : project?.status === "READY" || project?.status === "APPROVED"
      ? "Generation complete. Your video is saved and ready for editing."
      : "You may safely leave this page. Generation will continue.";
  const currentVideoVersion = useMemo(
    () => Math.max(1, ...versions.filter((item) => item.assetKind === "VIDEO").map((item) => item.versionNumber)),
    [versions],
  );

  const creativePreviewSpec = useMemo(() => {
    if (!project) return null;
    try {
      const template = resolveCreatorTemplate(creatorFoundation?.templateId);
      const spec = buildCreativeSpecFromVideoProject({
        workspaceId: workspace.id || "workspace-local",
        project,
        creationMode: creatorFoundation?.creationMode || "PRODUCT_DEMO",
        template,
        concept: creatorFoundation?.concept || project.objective,
      });
      const validation = validateCreativeSpec(spec);
      return validation.valid ? validation.spec : null;
    } catch {
      return null;
    }
  }, [creatorFoundation, project, workspace.id]);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Create a vertical video</h2>
            <p className="mt-1 text-sm text-slate-500">
              TikTok first. The same 9:16 project will later work for Reels and
              Shorts.
            </p>
            {creatorFoundation ? (
              <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Mode: {creatorFoundation.creationMode.replaceAll("_", " ")} · Template: {creatorFoundation.templateId}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={startNewVideo}
            className="rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"
          >
            Create new video
          </button>
        </div>
        <div className="mt-6 space-y-4">
          <label className="block text-sm text-slate-700">
            Channel
            <select
              value={channel}
              onChange={(event) =>
                setChannel(event.target.value as VideoProject["channel"])
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <option>TikTok</option>
              <option>Instagram Reels</option>
              <option>Facebook Reels</option>
              <option>YouTube Shorts</option>
            </select>
          </label>
          <label className="block text-sm text-slate-700">
            Objective
            <select
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <option>Drive engagement</option>
              <option>Generate sales</option>
              <option>Build trust</option>
              <option>Educate customers</option>
            </select>
          </label>
          <label className="block text-sm text-slate-700">
            What should the video communicate?
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Example: Show premium beef jerky paired with real fruit on a trail ride"
              className="mt-1 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            />
          </label>
          <label className="block text-sm text-slate-700">
            Call to action
            <input
              value={cta}
              onChange={(event) => setCta(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-slate-700">
              Length
              <select
                value={duration}
                onChange={(event) =>
                  setDuration(
                    Number(event.target.value) as VideoProject["durationSeconds"],
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              >
                {VIDEO_DURATION_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds} seconds
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-700">
              Voice
              <select
                value={voice}
                onChange={(event) =>
                  setVoice(event.target.value as VideoVoice)
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              >
                {VIDEO_VOICES.map((item) => (
                  <option key={item} value={item}>
                    {item[0].toUpperCase() + item.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-900">Generation quality</p>
              <p className="mt-1 text-xs text-slate-500">Estimates only. Final usage and provider cost can vary.</p>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-1">
                {([
                  { tier: "ECONOMY", label: "Economy" },
                  { tier: "BALANCED", label: "Standard" },
                  { tier: "PREMIUM", label: "Premium" },
                ] as const).map((item) => (
                  <button
                    key={item.tier}
                    type="button"
                    onClick={() => setQualityTier(item.tier)}
                    className={`rounded-md px-2 py-1.5 text-xs font-semibold ${qualityTier === item.tier ? "bg-white text-violet-700 shadow" : "text-slate-600"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {qualityEstimate ? (
                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <p>{qualityEstimate.description}</p>
                  <p>Estimated credits: <strong>{qualityEstimate.estimatedCredits ?? "-"}</strong></p>
                  <p>Estimated provider cost: <strong>{typeof qualityEstimate.estimatedProviderCostUsd === "number" ? `$${qualityEstimate.estimatedProviderCostUsd.toFixed(2)}` : "-"}</strong></p>
                  <p>Expected generation time: <strong>{qualityEstimate.expectedGenerationTime?.label || "-"}</strong></p>
                  <p>Provider/model: <strong>{qualityEstimate.providerDisplayName || "-"}</strong></p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-500">Loading quality estimate…</p>
              )}
            </div>
          </div>
          <label className="block text-sm text-slate-700">
            Music
            <select
              value={musicMode}
              onChange={(event) =>
                setMusicMode(event.target.value as VideoMusicMode)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <option value="GENERATED_AMBIENT">
                Original generated ambient audio
              </option>
              <option value="NONE">No music</option>
              <option value="LICENSED_LIBRARY" disabled>
                Licensed Media Library track — next
              </option>
            </select>
          </label>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Actual Product Image</p>
                <p className="mt-1 text-xs text-slate-600">
                  Choose or upload an approved product image from this workspace before generating in Exact Product Mode.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPickerOpen(true);
                    setPickerActionError("");
                  }}
                  className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                >
                  Choose from Media Library
                </button>
                <button
                  type="button"
                  disabled={productUploadWorking}
                  onClick={() => productUploadInputRef.current?.click()}
                  className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-60"
                >
                  {productUploadWorking ? "Uploading..." : "Upload product image"}
                </button>
                <input
                  ref={productUploadInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void uploadAndSelectProductImage(file);
                  }}
                />
              </div>
            </div>

            {selectedProductAsset ? (
              <div className="mt-4 rounded-2xl border border-sky-300 bg-sky-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {selectedProductPreviewUrl ? (
                      <img
                        src={selectedProductPreviewUrl}
                        alt={selectedProductAsset.name}
                        className="h-16 w-16 rounded-lg border border-sky-200 object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-lg border border-sky-200 bg-white" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{selectedProductAsset.name}</p>
                      <p className="mt-1 text-xs text-slate-600">{describeAssetDimensions(selectedProductAsset)}</p>
                      <p className="mt-1 inline-flex rounded-full bg-sky-700 px-2 py-0.5 text-xs font-bold tracking-wide text-white">
                        Approved product image
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProductAssetId("");
                        setSelectedProductPreviewUrl("");
                        setProductSelectionWarning("");
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {EXACT_PRODUCT_REQUIRED_MESSAGE}
              </p>
            )}

            {productSelectionWarning ? (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {productSelectionWarning}
              </p>
            ) : null}
            {pickerActionError ? (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {pickerActionError}
              </p>
            ) : null}
          </div>

          {pickerOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
              <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Select Product Image</p>
                    <p className="text-xs text-slate-500">Workspace-scoped Media Library images only.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(false)}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600"
                  >
                    Close
                  </button>
                </div>
                <div className="border-b border-slate-200 px-4 py-3">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={pickerShowAllImages}
                      onChange={(event) => setPickerShowAllImages(event.target.checked)}
                      className="h-4 w-4"
                    />
                    Show all workspace images
                  </label>
                </div>
                <div className="max-h-[58vh] overflow-y-auto px-4 py-3">
                  {pickerLoading ? (
                    <p className="text-sm text-slate-500">Loading product images...</p>
                  ) : visibleProductAssets.length ? (
                    <div className="space-y-3">
                      {visibleProductAssets.map((asset) => {
                        const approved = isApprovedProductAsset(asset);
                        const preview = pickerPreviewUrls[asset.id] || "";
                        return (
                          <div key={asset.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                            <div className="flex items-center gap-3">
                              {preview ? (
                                <img src={preview} alt={asset.name} className="h-14 w-14 rounded-lg border border-slate-200 object-cover" />
                              ) : (
                                <div className="h-14 w-14 rounded-lg border border-slate-200 bg-slate-50" />
                              )}
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{asset.name}</p>
                                <p className="text-xs text-slate-500">{describeAssetDimensions(asset)}</p>
                                <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                  {approved ? "Approved" : "Approval required"}
                                </p>
                              </div>
                            </div>
                            {approved ? (
                              <button
                                type="button"
                                onClick={() => selectApprovedProductAsset(asset)}
                                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                              >
                                Select
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={productApproveWorkingId === asset.id}
                                onClick={() => void approveProductAssetForUse(asset)}
                                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-60"
                              >
                                {productApproveWorkingId === asset.id ? "Approving..." : "Approve for product use"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      {pickerShowAllImages
                        ? "No workspace images are available yet. Upload a PNG, JPEG, or WEBP image."
                        : "No approved product images yet. Toggle \"Show all workspace images\" to approve one."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
          <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:grid-cols-2">
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={exactProductMode}
                onChange={(event) => {
                  if (!event.target.checked && selectedProductAsset) {
                    return;
                  }
                  setExactProductMode(event.target.checked);
                }}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="block font-semibold text-slate-900">Exact product mode</span>
                <span className="block text-xs text-slate-500">Default production method. Preserve the real product exactly.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={allowAiProductMotion}
                onChange={(event) => {
                  if (event.target.checked && !window.confirm("Allow AI product motion only if the product can stay visually faithful. Continue?")) {
                    return;
                  }
                  setAllowAiProductMotion(event.target.checked);
                }}
                className="mt-1 h-4 w-4"
                disabled={!selectedProductAsset}
              />
              <span>
                <span className="block font-semibold text-slate-900">AI product motion</span>
                <span className="block text-xs text-slate-500">Optional and only with explicit confirmation.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={lockProductAppearance}
                onChange={(event) => {
                  if (!event.target.checked && selectedProductAsset) {
                    return;
                  }
                  setLockProductAppearance(event.target.checked);
                }}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="block font-semibold text-slate-900">Lock product appearance</span>
                <span className="block text-xs text-slate-500">Keep product pixels, label, logo, and proportions unchanged.</span>
              </span>
            </label>
            <label className="block text-sm text-slate-700">
              Product placement
              <input
                value={productPlacement}
                onChange={(event) => setProductPlacement(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              />
            </label>
            <label className="block text-sm text-slate-700">
              Product scale
              <input
                value={productScale}
                onChange={(event) => setProductScale(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              />
            </label>
            <label className="block text-sm text-slate-700">
              Background
              <input
                value={productBackground}
                onChange={(event) => setProductBackground(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              />
            </label>
            <label className="block text-sm text-slate-700">
              Safe area
              <input
                value={productSafeArea}
                onChange={(event) => setProductSafeArea(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              />
            </label>
          </div>
          <button
            disabled={Boolean(working) || activeJob || !canGenerateInExactMode}
            onClick={() => void startWorkflow()}
            className="w-full rounded-xl bg-violet-600 px-5 py-3 font-semibold hover:bg-violet-500 disabled:opacity-60"
          >
            {working === "workflow"
              ? "Generating video…"
              : "Generate full video"}
          </button>
          {!canGenerateInExactMode ? (
            <p className="text-xs text-amber-700">
              {EXACT_PRODUCT_REQUIRED_MESSAGE}
            </p>
          ) : null}
          <button
            type="button"
            disabled={Boolean(working) || activeJob}
            onClick={() => void generatePlan()}
            className="w-full rounded-xl border border-violet-200 bg-white px-5 py-3 font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-60"
          >
            {working === "plan" ? "Planning video…" : "Create video plan"}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 md:p-7">
        <h2 className="text-xl font-bold">Video production</h2>
        <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm font-medium text-amber-800">
          Video generation may take 5–10 minutes. You can leave this page and
          return while it continues processing.
        </p>
        {project ? (
          <div className="mt-3 rounded-2xl border border-blue-500/25 bg-blue-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">{workflowStageLabel}</p>
              <p className="text-sm font-semibold text-blue-700">
                {project.status === "READY" || project.status === "APPROVED"
                  ? 100
                  : workflowPercent}
                %
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-600">{workflowStatusText}</p>
            {workflowElapsed ? (
              <p className="mt-1 text-xs text-slate-500">{workflowElapsed}</p>
            ) : null}
            <div
              className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-label="Video generation progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={project.status === "READY" || project.status === "APPROVED" ? 100 : workflowPercent}
            >
              <div
                className="h-full rounded-full bg-blue-500 transition-[width] duration-700 ease-out"
                style={{
                  width: `${project.status === "READY" || project.status === "APPROVED" ? 100 : workflowPercent}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              You may safely leave this page. Generation will continue.
            </p>
          </div>
        ) : null}
        <div className="mt-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-cyan-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">Video credits</p>
              <p className="mt-1 text-sm text-slate-600">
                This {renderSeconds}-second video requires{" "}
                <strong>{renderQuote.requiredCredits} credits</strong>.
                Credits are only charged when the provider accepts the render.
              </p>
            </div>
            {creditStatus?.billingExempt ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                Unlimited · Super Admin
              </span>
            ) : creditStatus ? (
              <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-violet-700 shadow-sm">
                {creditStatus.balanceCredits} credits available
              </span>
            ) : (
              <span className="rounded-full bg-white px-3 py-1 text-sm text-slate-500">
                Loading balance…
              </span>
            )}
          </div>
          {creditStatus ? (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
              <span>
                Monthly use: {creditStatus.monthlyUsedCredits}/
                {creditStatus.monthlyLimitCredits} credits
              </span>
            </div>
          ) : null}
          {creditError ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-sm text-rose-700">{creditError}</p>
              <button
                type="button"
                onClick={() => void refreshCreditStatus()}
                className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm text-rose-700"
              >
                Retry
              </button>
            </div>
          ) : !renderPermission.allowed && renderPermission.reason ? (
            <p className="mt-3 text-sm text-rose-700">
              {renderPermission.reason}
            </p>
          ) : null}
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Timeline foundation</h3>
            <span className="text-xs text-slate-500">{timelineFoundation.durationSeconds}s</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Baseline track model for deterministic editing. Captions are rendered through overlay tracks instead of generated frames.
          </p>
          <div className="mt-3 space-y-2">
            {timelineFoundation.tracks.map((track) => (
              <div key={track.type} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-700">{track.type}</p>
                  <p className="text-xs text-slate-500">{track.clips.length} clip{track.clips.length === 1 ? "" : "s"}</p>
                </div>
                {track.clips.length ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {track.clips.map((clip) => `${clip.startSeconds}s-${clip.startSeconds + clip.durationSeconds}s ${clip.label}`).join(" · ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        {!project ? (
          <div className="mt-6">
            <p className="text-slate-500">
              Create a plan to see the script, scenes, voiceover, and video
              preview.
            </p>
            {projects.length ? (
              <label className="mt-5 block text-sm text-slate-700">
                Or reopen a saved video
                <select
                  defaultValue=""
                  onChange={(event) => {
                    const saved = projects.find(
                      (item) => item.id === event.target.value,
                    );
                    if (saved) {
                      setProject(saved);
                      setVoice(saved.voice);
                      if (!saved.voiceoverStoragePath) setVoiceoverUrl("");
                    }
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                >
                  <option value="">Choose a video project</option>
                  {projects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} · {item.status}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div>
              <p className="font-semibold">{project.title}</p>
              <p className="mt-1 text-sm text-slate-500">
                {project.channel} · 9:16 · {project.durationSeconds}s ·{" "}
                {project.status}
                {project.status === "GENERATING"
                  ? providerStatus === "queued"
                    ? " · Queued at provider"
                    : ` · Processing ${project.providerProgress || 0}%`
                  : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                  Quality {project.routingTier || qualityTier}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                  Version v{currentVideoVersion}
                </span>
                {project.scenes.some((scene) => scene.productMode === "EXACT_PRODUCT") ? (
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                    Exact Product Mode
                  </span>
                ) : null}
              </div>
              {project.status === "FAILED" ? (
                <div className="mt-4 rounded-2xl border border-rose-300/40 bg-rose-50 p-4">
                  <p className="text-sm font-semibold text-rose-800">
                    Video generation didn&apos;t complete.
                  </p>
                  <p className="mt-1 text-xs text-rose-700">
                    Credits refunded: {project.creditStatus === "REFUNDED" ? "Yes" : "Pending"}
                  </p>
                  <p className="mt-1 text-xs text-rose-700">
                    Reference ID: {project.failureReferenceId || "pending"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={Boolean(working)}
                      onClick={() => void startWorkflow({ retry: true })}
                      className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {working === "workflow" ? "Retrying…" : "Try again"}
                    </button>
                    <button
                      type="button"
                      onClick={startNewVideo}
                      className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700"
                    >
                      Create new video
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            {previewUrl ? (
              <video
                src={previewUrl}
                controls
                playsInline
                className="mx-auto max-h-[520px] rounded-2xl bg-black"
              />
            ) : null}
            {creativePreviewSpec ? (
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Deterministic composition preview
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Final readable text, captions, CTA, and overlays are rendered by composition tracks.
                </p>
                <div className="mt-3">
                  <CreativeSpecPreviewPlayer spec={creativePreviewSpec} />
                </div>
              </div>
            ) : null}
            <div ref={sceneEditorRef} className="rounded-2xl border border-slate-200/80 bg-white/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Editable scene plan</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Adjust what viewers see, hear, and read in every scene.
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  Planned time: {totalSceneSeconds}s / {project.durationSeconds}s
                </p>
              </div>
              <div className="mt-4 space-y-4">
                {project.scenes.map((scene, sceneIndex) => (
                  <div
                    key={scene.order}
                    className="rounded-xl border border-slate-200/80 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        Scene {scene.order} · {scene.seconds}s
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <button
                          type="button"
                          disabled={sceneIndex === 0}
                          onClick={() => void moveScene(sceneIndex, -1)}
                          className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40"
                        >
                          Move up
                        </button>
                        <button
                          type="button"
                          disabled={sceneIndex === project.scenes.length - 1}
                          onClick={() => void moveScene(sceneIndex, 1)}
                          className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40"
                        >
                          Move down
                        </button>
                        <button
                          type="button"
                          onClick={() => void trimScene(sceneIndex, -1)}
                          className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40"
                        >
                          -1s
                        </button>
                        <button
                          type="button"
                          onClick={() => void trimScene(sceneIndex, 1)}
                          className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40"
                        >
                          +1s
                        </button>
                      </div>
                    </div>
                    <label className="mt-3 block text-xs text-slate-700">
                      Visual direction
                      <textarea
                        value={scene.visual}
                        onChange={(event) =>
                          setProject({
                            ...project,
                            scenes: project.scenes.map((item, index) =>
                              index === sceneIndex
                                ? { ...item, visual: event.target.value }
                                : item,
                            ),
                          })
                        }
                        className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                      />
                    </label>
                    <label className="mt-3 block text-xs text-slate-700">
                      Narration for this scene
                      <textarea
                        value={scene.narration}
                        onChange={(event) =>
                          setProject({
                            ...project,
                            scenes: project.scenes.map((item, index) =>
                              index === sceneIndex
                                ? { ...item, narration: event.target.value }
                                : item,
                            ),
                          })
                        }
                        className="mt-1 min-h-16 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                      />
                    </label>
                    <label className="mt-3 block text-xs text-slate-700">
                      On-screen text
                      <input
                        value={scene.onScreenText}
                        onChange={(event) =>
                          setProject({
                            ...project,
                            scenes: project.scenes.map((item, index) =>
                              index === sceneIndex
                                ? { ...item, onScreenText: event.target.value }
                                : item,
                            ),
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                      />
                      {getOverlaySpellingIssues(scene.onScreenText).length ? (
                        <p className="mt-1 text-[11px] text-amber-700">
                          {getOverlaySpellingIssues(scene.onScreenText).join(" · ")}
                        </p>
                      ) : null}
                    </label>
                  </div>
                ))}
              </div>
              <details className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                  Advanced controls
                </summary>
                <div className="mt-4 space-y-4">
                  {project.scenes.map((scene, sceneIndex) => (
                    <div
                      key={`${scene.order}-advanced`}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          Scene {scene.order} media and regen
                        </p>
                        <button
                          type="button"
                          disabled={Boolean(working)}
                          onClick={() => void regenerateScene(sceneIndex)}
                          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          Regenerate scene
                        </button>
                      </div>
                      <label className="mt-3 block text-xs text-slate-700">
                        Replace scene media
                        <input
                          value={scene.mediaStoragePath || ""}
                          onChange={(event) =>
                            setProject({
                              ...project,
                              scenes: project.scenes.map((item, index) =>
                                index === sceneIndex
                                  ? {
                                      ...item,
                                      mediaStoragePath:
                                        event.target.value || undefined,
                                    }
                                  : item,
                              ),
                            })
                          }
                          onBlur={(event) =>
                            void replaceSceneMedia(
                              sceneIndex,
                              event.target.value,
                            )
                          }
                          placeholder="Paste a media storage path or asset reference"
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                        />
                      </label>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="block text-xs text-slate-700">
                          Overlay font family
                          <input
                            value={scene.overlayFontFamily || "Inter"}
                            onChange={(event) =>
                              setProject({
                                ...project,
                                scenes: project.scenes.map((item, itemIndex) =>
                                  itemIndex === sceneIndex
                                    ? { ...item, overlayFontFamily: event.target.value }
                                    : item,
                                ),
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                          />
                        </label>
                        <label className="block text-xs text-slate-700">
                          Overlay color
                          <input
                            type="color"
                            value={scene.overlayColor || "#ffffff"}
                            onChange={(event) =>
                              setProject({
                                ...project,
                                scenes: project.scenes.map((item, itemIndex) =>
                                  itemIndex === sceneIndex
                                    ? { ...item, overlayColor: event.target.value }
                                    : item,
                                ),
                              })
                            }
                            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-2 py-1"
                          />
                        </label>
                        <label className="block text-xs text-slate-700">
                          Overlay font size
                          <input
                            type="number"
                            min={18}
                            max={96}
                            step={1}
                            value={scene.overlayFontSize ?? 42}
                            onChange={(event) =>
                              setProject({
                                ...project,
                                scenes: project.scenes.map((item, itemIndex) =>
                                  itemIndex === sceneIndex
                                    ? { ...item, overlayFontSize: Number(event.target.value) }
                                    : item,
                                ),
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                          />
                        </label>
                        <label className="block text-xs text-slate-700">
                          Overlay animation
                          <select
                            value={scene.overlayAnimation || "WORD_BY_WORD"}
                            onChange={(event) =>
                              setProject({
                                ...project,
                                scenes: project.scenes.map((item, itemIndex) =>
                                  itemIndex === sceneIndex
                                    ? {
                                        ...item,
                                        overlayAnimation: event.target.value as NonNullable<typeof scene.overlayAnimation>,
                                      }
                                    : item,
                                ),
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                          >
                            <option value="WORD_BY_WORD">Word by word</option>
                            <option value="FADE">Fade</option>
                            <option value="POP">Pop</option>
                            <option value="SLIDE">Slide</option>
                            <option value="TYPEWRITER">Typewriter</option>
                            <option value="NONE">None</option>
                          </select>
                        </label>
                        <label className="block text-xs text-slate-700">
                          Audio cue
                          <input
                            value={scene.audioCue || ""}
                            onChange={(event) =>
                              setProject({
                                ...project,
                                scenes: project.scenes.map((item, itemIndex) =>
                                  itemIndex === sceneIndex
                                    ? { ...item, audioCue: event.target.value }
                                    : item,
                                ),
                              })
                            }
                            placeholder="e.g. subtle whoosh + soft riser"
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                          />
                        </label>
                        <label className="block text-xs text-slate-700">
                          Audio volume (0-1)
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.05}
                            value={scene.audioVolume ?? 0.75}
                            onChange={(event) =>
                              setProject({
                                ...project,
                                scenes: project.scenes.map((item, itemIndex) =>
                                  itemIndex === sceneIndex
                                    ? { ...item, audioVolume: Number(event.target.value) }
                                    : item,
                                ),
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                          />
                        </label>
                        <label className="block text-xs text-slate-700">
                          Product position
                          <input
                            value={scene.productPlacement || "center frame"}
                            onChange={(event) =>
                              setProject({
                                ...project,
                                scenes: project.scenes.map((item, itemIndex) =>
                                  itemIndex === sceneIndex
                                    ? { ...item, productPlacement: event.target.value }
                                    : item,
                                ),
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                          />
                        </label>
                        <label className="block text-xs text-slate-700">
                          Product scale
                          <input
                            value={scene.productScale || "0.35"}
                            onChange={(event) =>
                              setProject({
                                ...project,
                                scenes: project.scenes.map((item, itemIndex) =>
                                  itemIndex === sceneIndex
                                    ? { ...item, productScale: event.target.value }
                                    : item,
                                ),
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                          />
                        </label>
                        <label className="block text-xs text-slate-700">
                          Product opacity (0-1)
                          <input
                            type="number"
                            min={0.05}
                            max={1}
                            step={0.05}
                            value={scene.productOpacity ?? 1}
                            onChange={(event) =>
                              setProject({
                                ...project,
                                scenes: project.scenes.map((item, itemIndex) =>
                                  itemIndex === sceneIndex
                                    ? { ...item, productOpacity: Number(event.target.value) }
                                    : item,
                                ),
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                          />
                        </label>
                        <label className="block text-xs text-slate-700">
                          Product shadow
                          <select
                            value={scene.productShadow === false ? "OFF" : "ON"}
                            onChange={(event) =>
                              setProject({
                                ...project,
                                scenes: project.scenes.map((item, itemIndex) =>
                                  itemIndex === sceneIndex
                                    ? { ...item, productShadow: event.target.value === "ON" }
                                    : item,
                                ),
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                          >
                            <option value="ON">ON</option>
                            <option value="OFF">OFF</option>
                          </select>
                        </label>
                        <label className="block text-xs text-slate-700">
                          Product rotation (-12 to 12 deg)
                          <input
                            type="number"
                            min={-12}
                            max={12}
                            step={0.5}
                            value={scene.productRotation ?? 0}
                            onChange={(event) =>
                              setProject({
                                ...project,
                                scenes: project.scenes.map((item, itemIndex) =>
                                  itemIndex === sceneIndex
                                    ? { ...item, productRotation: Number(event.target.value) }
                                    : item,
                                ),
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                          />
                        </label>
                        <label className="block text-xs text-slate-700">
                          Entrance
                          <select
                            value={scene.productEntrance || "FADE_IN"}
                            onChange={(event) =>
                              setProject({
                                ...project,
                                scenes: project.scenes.map((item, itemIndex) =>
                                  itemIndex === sceneIndex
                                    ? { ...item, productEntrance: event.target.value as VideoProject["scenes"][number]["productEntrance"] }
                                    : item,
                                ),
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                          >
                            <option value="NONE">None</option>
                            <option value="FADE_IN">Fade in</option>
                            <option value="SLIDE_UP">Slide up</option>
                          </select>
                        </label>
                        <label className="block text-xs text-slate-700">
                          Exit
                          <select
                            value={scene.productExit || "FADE_OUT"}
                            onChange={(event) =>
                              setProject({
                                ...project,
                                scenes: project.scenes.map((item, itemIndex) =>
                                  itemIndex === sceneIndex
                                    ? { ...item, productExit: event.target.value as VideoProject["scenes"][number]["productExit"] }
                                    : item,
                                ),
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                          >
                            <option value="NONE">None</option>
                            <option value="FADE_OUT">Fade out</option>
                          </select>
                        </label>
                        <label className="block text-xs text-slate-700">
                          Zoom
                          <select
                            value={scene.productZoom || "NONE"}
                            onChange={(event) =>
                              setProject({
                                ...project,
                                scenes: project.scenes.map((item, itemIndex) =>
                                  itemIndex === sceneIndex
                                    ? { ...item, productZoom: event.target.value as VideoProject["scenes"][number]["productZoom"] }
                                    : item,
                                ),
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                          >
                            <option value="NONE">None</option>
                            <option value="ZOOM_IN">Zoom in</option>
                            <option value="ZOOM_OUT">Zoom out</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold">Full-video regen</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Use the current scene plan, caption, hashtags, and CTA to
                      regenerate the whole video.
                    </p>
                    <button
                      type="button"
                      disabled={Boolean(working) || !renderPermission.allowed}
                      onClick={() => void startRender()}
                      className="mt-3 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {working === "render"
                        ? "Starting render…"
                        : `Regenerate full video · ${
                            creditStatus?.billingExempt
                              ? "Included"
                              : `${renderQuote.requiredCredits} credits`
                          }`}
                    </button>
                  </div>
                </div>
              </details>
            </div>
            <label className="block text-sm text-slate-700">
              Voiceover script
              <textarea
                value={project.script}
                onChange={(event) =>
                  setProject({ ...project, script: event.target.value })
                }
                className="mt-1 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              />
            </label>
            <label className="block text-sm text-slate-700">
              Post caption
              <textarea
                value={project.caption}
                onChange={(event) =>
                  setProject({ ...project, caption: event.target.value })
                }
                className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-slate-700">
                Production voice
                <select
                  value={project.voice}
                  onChange={(event) => {
                    const nextVoice = event.target.value as VideoVoice;
                    setVoice(nextVoice);
                    setProject({ ...project, voice: nextVoice });
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                >
                  {VIDEO_VOICES.map((item) => (
                    <option key={item} value={item}>
                      {item[0].toUpperCase() + item.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-700">
                Voice direction
                <textarea
                  value={voiceInstructions}
                  onChange={(event) =>
                    setVoiceInstructions(event.target.value)
                  }
                  placeholder="Example: Warm and trustworthy, medium pace, pause after the opening hook"
                  className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                />
              </label>
            </div>
            {voiceoverUrl ? (
              <audio src={voiceoverUrl} controls className="w-full" />
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                disabled={Boolean(working)}
                onClick={() => void savePlanEdits()}
                className="rounded-xl border border-emerald-500/40 px-4 py-2 text-emerald-700 disabled:opacity-60"
              >
                {working === "save" ? "Saving edits…" : "Save plan edits"}
              </button>
              <button
                disabled={Boolean(working)}
                onClick={() => void generateVoiceover()}
                className="rounded-xl border border-blue-500/40 px-4 py-2 text-blue-700 disabled:opacity-60"
              >
                {working === "voice"
                  ? "Creating voice…"
                  : "Generate voiceover"}
              </button>
              {project.status === "GENERATING" ? (
                <>
                  <button
                    disabled={Boolean(working)}
                    onClick={() => void checkRender(false)}
                    className="rounded-xl bg-violet-600 px-4 py-2 font-semibold disabled:opacity-60"
                  >
                    {working === "status"
                      ? "Checking…"
                      : "Check render status"}
                  </button>
                  <button
                    disabled={Boolean(working)}
                    onClick={() => void cancelRender()}
                    className="rounded-xl border border-violet-300 px-4 py-2 text-rose-700 disabled:opacity-60"
                  >
                    {working === "cancel"
                      ? "Canceling…"
                      : "Cancel queued render"}
                  </button>
                </>
              ) : !project.videoStoragePath ? (
                <button
                  disabled={Boolean(working) || !renderPermission.allowed || activeJob}
                  onClick={() => void startRender()}
                  className="rounded-xl bg-violet-600 px-4 py-2 font-semibold disabled:opacity-60"
                >
                  {working === "render"
                    ? "Starting render…"
                    : `Generate vertical video · ${
                        creditStatus?.billingExempt
                          ? "Included"
                          : `${renderQuote.requiredCredits} credits`
                      }`}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={openEditor}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Edit video
                  </button>
                  <button
                    type="button"
                    onClick={downloadCompletedVideo}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Download
                  </button>
                  {project.status === "READY" ? (
                    <button
                      disabled={Boolean(working)}
                      onClick={() => void approveCompletedVideo()}
                      className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-60"
                    >
                      {working === "approve" ? "Approving…" : "Approve"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={Boolean(working)}
                    onClick={() => void createRevisionVersion()}
                    className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-60"
                  >
                    {working === "revision" ? "Creating revision…" : "Create revision"}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(working)}
                    onClick={() => void duplicateProject()}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  >
                    {working === "duplicate" ? "Duplicating…" : "Duplicate"}
                  </button>
                  <button
                    disabled={Boolean(working) || project.status !== "APPROVED"}
                    onClick={() => void postNow()}
                    className="rounded-xl border border-emerald-300 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {working === "post-now" ? "Posting now…" : "Post now"}
                  </button>
                  <button
                    disabled={Boolean(working)}
                    onClick={() => void schedule()}
                    className="rounded-xl bg-violet-600 px-4 py-2 font-semibold disabled:opacity-60"
                  >
                    Schedule / Post now
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={startNewVideo}
                className="rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700"
              >
                Create new video
              </button>
            </div>
            {project.videoStoragePath &&
            project.status !== "GENERATING" ? (
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                <p className="text-sm font-semibold">Revise this video</p>
                <p className="mt-1 text-xs text-slate-500">
                  Describe the exact change you want. The current version will
                  stay saved for comparison.
                </p>
                <textarea
                  value={revisionRequest}
                  onChange={(event) =>
                    setRevisionRequest(event.target.value)
                  }
                  placeholder="Example: Show the product in the first two seconds, brighten the trail scene, and make the final logo shot longer"
                  className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                />
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    disabled={
                      Boolean(working) ||
                      !revisionRequest.trim() ||
                      !renderPermission.allowed
                    }
                    onClick={() => void startRevision("edit")}
                    className="rounded-xl bg-blue-600 px-4 py-2 font-semibold hover:bg-blue-500 disabled:opacity-60"
                  >
                    {working === "revision"
                      ? "Starting revision…"
                      : `Generate targeted revision · ${
                          creditStatus?.billingExempt
                            ? "Included"
                            : `${renderQuote.requiredCredits} credits`
                        }`}
                  </button>
                  <button
                    disabled={
                      Boolean(working) ||
                      !revisionRequest.trim() ||
                      !renderPermission.allowed
                    }
                    onClick={() => void startRevision("fresh")}
                    className="rounded-xl border border-blue-500/40 px-4 py-2 text-blue-100 hover:bg-blue-500/10 disabled:opacity-60"
                  >
                    Generate fresh revision ·{" "}
                    {creditStatus?.billingExempt
                      ? "Included"
                      : `${renderQuote.requiredCredits} credits`}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Use a fresh revision if a targeted edit remains queued. Your
                  approved original stays in Version History.
                </p>
              </div>
            ) : null}
            {versions.length ? (
              <div className="rounded-2xl border border-slate-200/80 p-4">
                <div>
                  <p className="text-sm font-semibold">Version history</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Compare earlier video and voiceover versions, then restore
                    the one the client approves.
                  </p>
                </div>
                <div className="mt-3 space-y-2">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/70 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {version.assetKind === "VIDEO"
                            ? "Video"
                            : "Voiceover"}{" "}
                          version {version.versionNumber}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(version.createdAt).toLocaleString()}
                          {version.voice
                            ? ` · ${version.voice[0].toUpperCase() + version.voice.slice(1)}`
                            : ""}
                        </p>
                      </div>
                      <button
                        disabled={Boolean(working)}
                        onClick={() => void restoreVersion(version)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-violet-50 disabled:opacity-60"
                      >
                        {working === "restore"
                          ? "Restoring…"
                          : "Preview and restore"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-800">
              AI-generated voice disclosure is required. Copyrighted music,
              celebrities, real-person likenesses, and third-party watermarks
              are not allowed.
            </p>
          </div>
        )}
        {notice ? (
          <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-xl border border-violet-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <p className="mt-5 text-xs text-slate-400">
          {projects.length} video projects saved in this workspace.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          In-progress renders continue at the provider if this page closes.
          Reopening Video Studio automatically resumes status tracking.
        </p>
      </section>
    </div>
  );
}
