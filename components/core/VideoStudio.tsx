"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  type VideoWorkflowStage,
  type VideoVoice,
} from "@/features/core/video-project";
import {
  canStartVideoRender,
  quoteVideoCredits,
  type VideoCreditStatus,
} from "@/features/core/video-credits";

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
}: {
  workspace: WorkspaceProfile;
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
  const checkRenderRef = useRef<() => Promise<void>>(async () => undefined);
  const renderCheckInFlightRef = useRef(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadCloudVideoProjects()
        .then((items) => {
          setProjects(items);
          const active = items.find((item) => item.status === "GENERATING");
          const newest = items[0] || null;
          const resumed =
            active || (newest?.status === "FAILED" ? newest : null);
          if (resumed) {
            setProject(resumed);
            setWorkflowKey(resumed.workflowKey || "");
            setVoice(resumed.voice);
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
    if (!projectId) return;
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
    setProject(next);
    setProjects((current) => {
      const exists = current.some((item) => item.id === next.id);
      return exists
        ? current.map((item) => (item.id === next.id ? next : item))
        : [next, ...current];
    });
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
    [workspace.id, channel, duration, crypto.randomUUID()].join("|").toLowerCase();

  const startNewVideo = () => {
    setProject(null);
    setWorkflowKey("");
    setProviderStatus("");
    setNotice("");
    setError("");
    setPollAttempt(0);
    setPreviewUrl("");
    setVoiceoverUrl("");
    setRevisionRequest("");
    setComplianceNote("");
  };

  const startWorkflow = async (options?: { retry?: boolean }) => {
    setWorking("workflow");
    setError("");
    setNotice("");
    try {
      const retry = Boolean(options?.retry);
      const activeWorkflowKey = retry
        ? (project?.workflowKey || workflowKey || "")
        : (workflowKey || createWorkflowKey());
      if (!workflowKey) {
        setWorkflowKey(activeWorkflowKey);
      }

      const now = new Date().toISOString();
      const optimisticProject: VideoProject = {
        id: project?.id || `pending-${crypto.randomUUID()}`,
        title: project?.title || `Creating ${channel} video`,
        channel,
        objective,
        prompt: project?.prompt || "",
        script: project?.script || "",
        caption: project?.caption || "",
        hashtags: project?.hashtags || [],
        callToAction: cta,
        scenes: project?.scenes || [],
        durationSeconds: duration,
        aspectRatio: "9:16",
        voice,
        voiceDisclosure: true,
        musicMode,
        provider: "OPENAI_SORA_TEMPORARY",
        providerJobStatus: "queued",
        providerProgress: 5,
        workflowKey: activeWorkflowKey,
        workflowStage: "PREPARING_VIDEO_PLAN",
        workflowProgress: 5,
        creditStatus: project?.creditStatus || "NONE",
        status: "GENERATING",
        failureReason: undefined,
        failureReferenceId: undefined,
        workflowStartedAt: project?.workflowStartedAt || now,
        createdAt: project?.createdAt || now,
        updatedAt: now,
      };
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
          projectId: retry ? project?.id : undefined,
          retry,
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
        scenes: payload.scenes,
        durationSeconds: duration,
        aspectRatio: "9:16",
        voice,
        voiceDisclosure: true,
        musicMode,
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
    if (!project?.id) return;
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
        `/api/ai/video-workflow?projectId=${encodeURIComponent(project.id)}&workflowKey=${encodeURIComponent(project.workflowKey || workflowKey)}`,
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
          ...project,
          status: "FAILED",
          providerJobStatus: nextProviderStatus,
          providerProgress: Math.min(94, providerProgress),
          workflowStage: payload.stage || "FAILED",
          workflowProgress: Math.min(94, providerProgress),
          creditStatus: payload.creditStatus || project.creditStatus || "REFUNDED",
          failureReferenceId: payload.failureReferenceId || project.failureReferenceId,
          failureReason: payload.error || "Video generation didn't complete.",
          updatedAt: new Date().toISOString(),
        });
        throw new Error(payload.error || "Video generation didn't complete.");
      }

      if (payload.status === "completed") {
        await updateProject({
          ...project,
          status: "READY",
          providerJobStatus: "completed",
          providerProgress: 100,
          workflowStage: "COMPLETE",
          workflowProgress: 100,
          creditStatus: payload.creditStatus || project.creditStatus || "RESERVED",
          mediaAssetId: payload.mediaAssetId || project.mediaAssetId,
          contentDraftId: payload.draftId || project.contentDraftId,
          updatedAt: new Date().toISOString(),
        });
        setPollAttempt(0);
        setNotice("Video generation complete. Your video and draft are ready.");
        return;
      }

      await updateProject({
        ...project,
        status: "GENERATING",
        providerJobStatus: nextProviderStatus,
        providerProgress,
        workflowStage: payload.stage || (providerProgress >= 70 ? "RENDERING_FINAL_VIDEO" : "GENERATING_SCENES"),
        workflowProgress: Math.min(94, Math.max(providerProgress, Number(payload.progress || 0))),
        creditStatus: payload.creditStatus || project.creditStatus || "RESERVED",
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
    if (!project || project.status !== "GENERATING") {
      return;
    }
    if (project.creditStatus === "REFUNDED") {
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
          <button
            disabled={Boolean(working) || activeJob}
            onClick={() => void startWorkflow()}
            className="w-full rounded-xl bg-violet-600 px-5 py-3 font-semibold hover:bg-violet-500 disabled:opacity-60"
          >
            {working === "workflow"
              ? "Generating video…"
              : "Generate full video"}
          </button>
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
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5">
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
                <button
                  disabled={Boolean(working)}
                  onClick={() => void schedule()}
                  className="rounded-xl bg-violet-600 px-4 py-2 font-semibold disabled:opacity-60"
                >
                  Schedule / Post now
                </button>
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
