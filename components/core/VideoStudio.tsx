"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadCloudVideoProjects,
  resolveCloudMediaUrl,
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

export default function VideoStudio({
  workspace,
}: {
  workspace: WorkspaceProfile;
}) {
  const [projects, setProjects] = useState<VideoProject[]>([]);
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
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadCloudVideoProjects()
        .then(setProjects)
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
          instructions: `Use a ${workspace.voice || "clear, confident"} brand voice. Do not imitate a real person.`,
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
      await updateProject({
        ...project,
        voiceoverStoragePath: asset.storagePath,
        updatedAt: new Date().toISOString(),
      });
      setNotice(
        "Voiceover created and saved. The published video must disclose that the voice is AI-generated.",
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
          prompt: project.prompt,
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
      setNotice(
        "Video generation started. It can take several minutes; use Check render status.",
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

  const checkRender = async () => {
    if (!project?.providerJobId) return;
    setWorking("status");
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
          providerProgress: payload.progress || 0,
          status: "GENERATING",
          updatedAt: new Date().toISOString(),
        });
        setNotice(`Video is ${payload.progress || 0}% complete.`);
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
      await updateProject({
        ...project,
        providerProgress: 100,
        videoStoragePath: asset.storagePath,
        status: "READY",
        updatedAt: new Date().toISOString(),
      });
      setNotice("Video is ready and saved in PostMotive.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to finish the video.",
      );
    } finally {
      setWorking("");
    }
  };

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
                    if (saved) setProject(saved);
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
                  ? ` · ${project.providerProgress || 0}%`
                  : ""}
              </p>
            </div>
            {previewUrl ? (
              <video
                src={previewUrl}
                controls
                playsInline
                className="mx-auto max-h-[520px] rounded-xl bg-black"
              />
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-5">
                <p className="text-sm font-semibold">Scene plan</p>
                <div className="mt-3 space-y-3">
                  {project.scenes.map((scene) => (
                    <div
                      key={scene.order}
                      className="rounded-lg border border-white/10 p-3 text-sm"
                    >
                      <p className="font-medium">
                        Scene {scene.order} · {scene.seconds}s
                      </p>
                      <p className="mt-1 text-zinc-300">{scene.visual}</p>
                      <p className="mt-1 text-zinc-400">
                        On screen: {scene.onScreenText || "None"}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Planned time: {totalSceneSeconds}s
                </p>
              </div>
            )}
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
            {voiceoverUrl ? (
              <audio src={voiceoverUrl} controls className="w-full" />
            ) : null}
            <div className="flex flex-wrap gap-3">
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
                <button
                  disabled={Boolean(working)}
                  onClick={() => void checkRender()}
                  className="rounded-lg bg-red-600 px-4 py-2 font-semibold disabled:opacity-60"
                >
                  {working === "status"
                    ? "Checking…"
                    : "Check render status"}
                </button>
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
      </section>
    </div>
  );
}

