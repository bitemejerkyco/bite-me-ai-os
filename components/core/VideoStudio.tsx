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
  type ContentDraft,
  type WorkspaceProfile,
} from "@/features/core/local-os";
import {
  VIDEO_VOICES,
  type CreativeVersion,
  type VideoMusicMode,
  type VideoProject,
  type VideoVoice,
} from "@/features/core/video-project";

type VideoPlanPayload = {
  title?: string;
  script?: string;
  caption?: string;
  renderPrompt?: string;
  complianceNote?: string;
  scenes?: VideoProject["scenes"];
  error?: string;
};

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
    useState<VideoProject["durationSeconds"]>(16);
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
  const checkRenderRef = useRef<() => Promise<void>>(async () => undefined);
  const renderCheckInFlightRef = useRef(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadCloudVideoProjects()
        .then((items) => {
          setProjects(items);
          const resumed =
            items.find((item) => item.status === "GENERATING") ||
            items.find((item) => item.status === "READY") ||
            items[0];
          if (resumed) {
            setProject(resumed);
            setVoice(resumed.voice);
            if (resumed.status === "GENERATING") {
              setNotice(
                `Resumed video render at ${resumed.providerProgress || 0}%. PostMotive will keep checking automatically.`,
              );
            }
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
        error?: string;
      };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error || "Video generation could not start.");
      }
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

  const startRevision = async (mode: "edit" | "fresh" = "edit") => {
    if (!project?.videoStoragePath) return;
    if (!revisionRequest.trim()) {
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
            `Requested revision: ${revisionRequest.trim()}`,
            composeRenderPrompt(project),
          ].join("\n"),
          seconds: project.durationSeconds,
        }),
      });
      const payload = (await response.json()) as {
        id?: string;
        status?: string;
        progress?: number;
        error?: string;
      };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error || "Video revision could not start.");
      }
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
    if (!project?.providerJobId) return;
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
        `/api/ai/video-render?id=${encodeURIComponent(project.providerJobId)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as {
        status?: string;
        progress?: number;
        error?: { message?: string } | string;
      };
      if (!response.ok) throw new Error("Unable to check video status.");
      const reportedProgress = Number(payload.progress);
      const confirmedProgress = Number.isFinite(reportedProgress)
        ? Math.max(
            project.providerProgress || 0,
            Math.min(100, Math.max(0, reportedProgress)),
          )
        : project.providerProgress || 0;
      setProviderStatus(
        confirmedProgress > 0 && payload.status === "queued"
          ? "in_progress"
          : payload.status || providerStatus || "queued",
      );
      if (payload.status === "failed") {
        const failure =
          typeof payload.error === "string"
            ? payload.error
            : payload.error?.message || "Video generation failed.";
        await updateProject({
          ...project,
          status: "FAILED",
          failureReason: failure,
          updatedAt: new Date().toISOString(),
        });
        throw new Error(failure);
      }
      if (payload.status !== "completed") {
        await updateProject({
          ...project,
          providerProgress: confirmedProgress,
          status: "GENERATING",
          updatedAt: new Date().toISOString(),
        });
        setNotice(
          payload.status === "queued" && confirmedProgress === 0
            ? "Queued at OpenAI. 0% is normal while the job waits for rendering capacity."
            : `Video is processing at ${confirmedProgress}% complete.`,
        );
        return;
      }
      const mediaResponse = await fetch(
        `/api/ai/video-content?id=${encodeURIComponent(project.providerJobId)}`,
        { cache: "no-store" },
      );
      if (!mediaResponse.ok) throw new Error("Unable to download finished video.");
      const blob = await mediaResponse.blob();
      const file = new File(
        [blob],
        `${project.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 80)}.mp4`,
        { type: "video/mp4" },
      );
      const asset = await uploadCloudMedia(file, [
        "video",
        "vertical",
        "ai-generated",
        project.channel.toLowerCase(),
      ]);
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      const videoVersion: CreativeVersion = {
        id: crypto.randomUUID(),
        videoProjectId: project.id,
        assetKind: "VIDEO",
        versionNumber: nextVersionNumber("VIDEO"),
        providerJobId: project.providerJobId,
        storagePath: asset.storagePath || "",
        prompt: revisionRequest.trim() || project.prompt,
        createdAt: new Date().toISOString(),
      };
      await addVersion(videoVersion);
      await updateProject({
        ...project,
        providerProgress: 100,
        videoStoragePath: asset.storagePath,
        status: "READY",
        updatedAt: new Date().toISOString(),
      });
      setRevisionRequest("");
      setProviderStatus("completed");
      setNotice(
        `Video version ${videoVersion.versionNumber} is ready and saved in PostMotive.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to finish the video.",
      );
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
    if (
      project?.status !== "GENERATING" ||
      !project.providerJobId
    ) {
      return;
    }
    const checkNow = window.setTimeout(
      () => void checkRenderRef.current(),
      1_000,
    );
    const interval = window.setInterval(
      () => void checkRenderRef.current(),
      8_000,
    );
    return () => {
      window.clearTimeout(checkNow);
      window.clearInterval(interval);
    };
  }, [project?.providerJobId, project?.status]);

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
      const localDrafts = loadLocal<ContentDraft[]>(STORAGE_KEYS.drafts, []);
      saveLocal(STORAGE_KEYS.drafts, [
        draft,
        ...localDrafts.filter((item) => item.id !== draft.id),
      ]);
      saveLocal(STORAGE_KEYS.calendarPrefill, draft);
      window.location.assign("/calendar");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to send video to the calendar.",
      );
      setWorking("");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-2xl border border-white/10 bg-[#111827] p-5 md:p-7">
        <h2 className="text-xl font-bold">Create a vertical video</h2>
        <p className="mt-1 text-sm text-zinc-400">
          TikTok first. The same 9:16 project will later work for Reels and
          Shorts.
        </p>
        <div className="mt-6 space-y-4">
          <label className="block text-sm text-zinc-300">
            Channel
            <select
              value={channel}
              onChange={(event) =>
                setChannel(event.target.value as VideoProject["channel"])
              }
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"
            >
              <option>TikTok</option>
              <option disabled>Instagram Reels — next</option>
              <option disabled>YouTube Shorts — next</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-300">
            Objective
            <select
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"
            >
              <option>Drive engagement</option>
              <option>Generate sales</option>
              <option>Build trust</option>
              <option>Educate customers</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-300">
            What should the video communicate?
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Example: Show premium beef jerky paired with real fruit on a trail ride"
              className="mt-1 min-h-28 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"
            />
          </label>
          <label className="block text-sm text-zinc-300">
            Call to action
            <input
              value={cta}
              onChange={(event) => setCta(event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-zinc-300">
              Length
              <select
                value={duration}
                onChange={(event) =>
                  setDuration(
                    Number(event.target.value) as VideoProject["durationSeconds"],
                  )
                }
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"
              >
                <option value={8}>8 seconds</option>
                <option value={16}>16 seconds</option>
                <option value={20}>20 seconds</option>
              </select>
            </label>
            <label className="block text-sm text-zinc-300">
              Voice
              <select
                value={voice}
                onChange={(event) =>
                  setVoice(event.target.value as VideoVoice)
                }
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"
              >
                {VIDEO_VOICES.map((item) => (
                  <option key={item} value={item}>
                    {item[0].toUpperCase() + item.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm text-zinc-300">
            Music
            <select
              value={musicMode}
              onChange={(event) =>
                setMusicMode(event.target.value as VideoMusicMode)
              }
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"
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
            disabled={Boolean(working)}
            onClick={() => void generatePlan()}
            className="w-full rounded-lg bg-red-600 px-5 py-3 font-semibold hover:bg-red-500 disabled:opacity-60"
          >
            {working === "plan" ? "Planning video…" : "Create video plan"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111827] p-5 md:p-7">
        <h2 className="text-xl font-bold">Video production</h2>
        <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm font-medium text-amber-100">
          Video generation may take 5–10 minutes. You can leave this page and
          return while it continues processing.
        </p>
        {!project ? (
          <div className="mt-6">
            <p className="text-zinc-400">
              Create a plan to see the script, scenes, voiceover, and video
              preview.
            </p>
            {projects.length ? (
              <label className="mt-5 block text-sm text-zinc-300">
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
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"
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
              <p className="mt-1 text-sm text-zinc-400">
                {project.channel} · 9:16 · {project.durationSeconds}s ·{" "}
                {project.status}
                {project.status === "GENERATING"
                  ? providerStatus === "queued"
                    ? " · Queued at provider"
                    : ` · Processing ${project.providerProgress || 0}%`
                  : ""}
              </p>
              {project.status === "GENERATING" ? (
                <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-blue-100">
                      {(project.providerProgress || 0) > 0
                        ? "Rendering video"
                        : "Queued for rendering"}
                    </span>
                    <span className="font-semibold text-blue-200">
                      {Math.round(project.providerProgress || 0)}%
                    </span>
                  </div>
                  <div
                    className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-800"
                    role="progressbar"
                    aria-label="Video rendering progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(project.providerProgress || 0)}
                  >
                    <div
                      className="h-full rounded-full bg-blue-500 transition-[width] duration-700 ease-out"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, project.providerProgress || 0),
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">
                    The confirmed progress will only move forward. You can
                    leave this page and return while rendering continues.
                  </p>
                </div>
              ) : null}
            </div>
            {previewUrl ? (
              <video
                src={previewUrl}
                controls
                playsInline
                className="mx-auto max-h-[520px] rounded-xl bg-black"
              />
            ) : null}
            <div className="rounded-xl border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Editable scene plan</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Adjust what viewers see, hear, and read in every scene.
                  </p>
                </div>
                <p className="text-xs text-zinc-400">
                  Planned time: {totalSceneSeconds}s /{" "}
                  {project.durationSeconds}s
                </p>
              </div>
              <div className="mt-4 space-y-4">
                {project.scenes.map((scene, sceneIndex) => (
                  <div
                    key={scene.order}
                    className="rounded-lg border border-white/10 p-4"
                  >
                    <p className="text-sm font-semibold">
                      Scene {scene.order} · {scene.seconds}s
                    </p>
                    <label className="mt-3 block text-xs text-zinc-300">
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
                        className="mt-1 min-h-20 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                      />
                    </label>
                    <label className="mt-3 block text-xs text-zinc-300">
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
                        className="mt-1 min-h-16 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                      />
                    </label>
                    <label className="mt-3 block text-xs text-zinc-300">
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
                        className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <label className="block text-sm text-zinc-300">
              Voiceover script
              <textarea
                value={project.script}
                onChange={(event) =>
                  setProject({ ...project, script: event.target.value })
                }
                className="mt-1 min-h-28 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Post caption
              <textarea
                value={project.caption}
                onChange={(event) =>
                  setProject({ ...project, caption: event.target.value })
                }
                className="mt-1 min-h-24 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-zinc-300">
                Production voice
                <select
                  value={project.voice}
                  onChange={(event) => {
                    const nextVoice = event.target.value as VideoVoice;
                    setVoice(nextVoice);
                    setProject({ ...project, voice: nextVoice });
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"
                >
                  {VIDEO_VOICES.map((item) => (
                    <option key={item} value={item}>
                      {item[0].toUpperCase() + item.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-zinc-300">
                Voice direction
                <textarea
                  value={voiceInstructions}
                  onChange={(event) =>
                    setVoiceInstructions(event.target.value)
                  }
                  placeholder="Example: Warm and trustworthy, medium pace, pause after the opening hook"
                  className="mt-1 min-h-24 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"
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
                className="rounded-lg border border-emerald-500/40 px-4 py-2 text-emerald-200 disabled:opacity-60"
              >
                {working === "save" ? "Saving edits…" : "Save plan edits"}
              </button>
              <button
                disabled={Boolean(working)}
                onClick={() => void generateVoiceover()}
                className="rounded-lg border border-blue-500/40 px-4 py-2 text-blue-200 disabled:opacity-60"
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
                    className="rounded-lg bg-red-600 px-4 py-2 font-semibold disabled:opacity-60"
                  >
                    {working === "status"
                      ? "Checking…"
                      : "Check render status"}
                  </button>
                  <button
                    disabled={Boolean(working)}
                    onClick={() => void cancelRender()}
                    className="rounded-lg border border-red-500/40 px-4 py-2 text-red-200 disabled:opacity-60"
                  >
                    {working === "cancel"
                      ? "Canceling…"
                      : "Cancel queued render"}
                  </button>
                </>
              ) : !project.videoStoragePath ? (
                <button
                  disabled={Boolean(working)}
                  onClick={() => void startRender()}
                  className="rounded-lg bg-red-600 px-4 py-2 font-semibold disabled:opacity-60"
                >
                  {working === "render"
                    ? "Starting render…"
                    : "Generate vertical video"}
                </button>
              ) : (
                <button
                  disabled={Boolean(working)}
                  onClick={() => void schedule()}
                  className="rounded-lg bg-red-600 px-4 py-2 font-semibold disabled:opacity-60"
                >
                  Schedule / Post now
                </button>
              )}
            </div>
            {project.videoStoragePath &&
            project.status !== "GENERATING" ? (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <p className="text-sm font-semibold">Revise this video</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Describe the exact change you want. The current version will
                  stay saved for comparison.
                </p>
                <textarea
                  value={revisionRequest}
                  onChange={(event) =>
                    setRevisionRequest(event.target.value)
                  }
                  placeholder="Example: Show the product in the first two seconds, brighten the trail scene, and make the final logo shot longer"
                  className="mt-3 min-h-24 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"
                />
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    disabled={Boolean(working) || !revisionRequest.trim()}
                    onClick={() => void startRevision("edit")}
                    className="rounded-lg bg-blue-600 px-4 py-2 font-semibold hover:bg-blue-500 disabled:opacity-60"
                  >
                    {working === "revision"
                      ? "Starting revision…"
                      : "Generate targeted revision"}
                  </button>
                  <button
                    disabled={Boolean(working) || !revisionRequest.trim()}
                    onClick={() => void startRevision("fresh")}
                    className="rounded-lg border border-blue-500/40 px-4 py-2 text-blue-100 hover:bg-blue-500/10 disabled:opacity-60"
                  >
                    Generate fresh revision
                  </button>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Use a fresh revision if a targeted edit remains queued. Your
                  approved original stays in Version History.
                </p>
              </div>
            ) : null}
            {versions.length ? (
              <div className="rounded-xl border border-white/10 p-4">
                <div>
                  <p className="text-sm font-semibold">Version history</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Compare earlier video and voiceover versions, then restore
                    the one the client approves.
                  </p>
                </div>
                <div className="mt-3 space-y-2">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {version.assetKind === "VIDEO"
                            ? "Video"
                            : "Voiceover"}{" "}
                          version {version.versionNumber}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {new Date(version.createdAt).toLocaleString()}
                          {version.voice
                            ? ` · ${version.voice[0].toUpperCase() + version.voice.slice(1)}`
                            : ""}
                        </p>
                      </div>
                      <button
                        disabled={Boolean(working)}
                        onClick={() => void restoreVersion(version)}
                        className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-60"
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
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100">
              AI-generated voice disclosure is required. Copyrighted music,
              celebrities, real-person likenesses, and third-party watermarks
              are not allowed.
            </p>
          </div>
        )}
        {notice ? (
          <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <p className="mt-5 text-xs text-zinc-500">
          {projects.length} video projects saved in this workspace.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          In-progress renders continue at the provider if this page closes.
          Reopening Video Studio automatically resumes status tracking.
        </p>
      </section>
    </div>
  );
}
