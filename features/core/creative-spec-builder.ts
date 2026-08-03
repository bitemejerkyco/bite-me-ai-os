import type { CreatorTemplate } from "@/features/core/creator-template-catalog";
import type { CreativeSpec, CreativeTrack, CreativeTimelineItem, CreationMode } from "@/features/core/creative-spec";
import type { VideoProject } from "@/features/core/video-project";

function makeBaseTracks(): CreativeTrack[] {
  return [
    { id: "track-video-main", type: "VIDEO", label: "Main video", hidden: false, locked: false, muted: false },
    { id: "track-image-support", type: "IMAGE", label: "Support images", hidden: false, locked: false, muted: false },
    { id: "track-product", type: "PRODUCT", label: "Product", hidden: false, locked: true, muted: false },
    { id: "track-text", type: "TEXT", label: "Text overlays", hidden: false, locked: false, muted: false },
    { id: "track-caption", type: "CAPTION", label: "Captions", hidden: false, locked: false, muted: false },
    { id: "track-audio", type: "AUDIO", label: "Audio beds", hidden: false, locked: false, muted: false },
    { id: "track-voiceover", type: "VOICEOVER", label: "Voiceover", hidden: false, locked: false, muted: false },
    { id: "track-music", type: "MUSIC", label: "Music", hidden: false, locked: false, muted: false },
    { id: "track-fx", type: "SOUND_EFFECT", label: "Sound effects", hidden: false, locked: false, muted: false },
  ];
}

export function buildCreativeSpecFromVideoProject(input: {
  workspaceId: string;
  project: VideoProject;
  creationMode: CreationMode;
  template: CreatorTemplate;
  concept: string;
}): CreativeSpec {
  const fps = 30;
  const durationFrames = input.project.durationSeconds * fps;
  const tracks = makeBaseTracks();
  const timelineItems: CreativeTimelineItem[] = [];

  let frameCursor = 0;
  for (const scene of input.project.scenes) {
    const sceneFrames = Math.max(1, Math.round(scene.seconds * fps));
    timelineItems.push({
      id: `video-scene-${scene.order}`,
      trackId: "track-video-main",
      trackType: "VIDEO",
      startFrame: frameCursor,
      durationFrames: sceneFrames,
      zIndex: 1,
      position: { x: 50, y: 50 },
      scale: 1,
      rotation: 0,
      opacity: 1,
      text: "",
      src: scene.mediaStoragePath || "",
      assetId: scene.mediaAssetId,
      animationIn: "FADE",
      animationOut: "FADE",
      locked: false,
      muted: false,
    });

    timelineItems.push({
      id: `caption-scene-${scene.order}`,
      trackId: "track-caption",
      trackType: "CAPTION",
      startFrame: frameCursor,
      durationFrames: sceneFrames,
      zIndex: 20,
      position: { x: 50, y: 86 },
      scale: 1,
      rotation: 0,
      opacity: 1,
      text: scene.onScreenText,
      style: {
        fontFamily: "Inter",
        fontSize: 42,
        fontWeight: 800,
        color: "#ffffff",
        shadow: "0 8px 20px rgba(0,0,0,0.45)",
        alignment: "center",
      },
      animationIn: "WORD_BY_WORD",
      animationOut: "FADE",
      locked: false,
      muted: false,
    });

    if (scene.productAssetId) {
      timelineItems.push({
        id: `product-scene-${scene.order}`,
        trackId: "track-product",
        trackType: "PRODUCT",
        startFrame: frameCursor,
        durationFrames: sceneFrames,
        zIndex: 12,
        position: { x: 50, y: 52 },
        scale: 1,
        rotation: scene.productRotation || 0,
        opacity: scene.productOpacity ?? 1,
        text: scene.productAssetName || "Product",
        src: scene.mediaStoragePath || "",
        assetId: scene.productAssetId,
        animationIn: (scene.productEntrance || "FADE_IN") === "SLIDE_UP" ? "SLIDE" : "FADE",
        animationOut: (scene.productExit || "FADE_OUT") === "FADE_OUT" ? "FADE" : "NONE",
        locked: scene.productLocked ?? true,
        muted: false,
      });
    }

    frameCursor += sceneFrames;
  }

  timelineItems.push({
    id: "cta-overlay",
    trackId: "track-text",
    trackType: "TEXT",
    startFrame: Math.max(0, durationFrames - Math.round(fps * 2.5)),
    durationFrames: Math.round(fps * 2.5),
    zIndex: 30,
    position: { x: 50, y: 12 },
    scale: 1,
    rotation: 0,
    opacity: 1,
    text: input.project.callToAction,
    style: {
      fontFamily: "Inter",
      fontSize: 46,
      fontWeight: 900,
      color: "#f8fafc",
      shadow: "0 10px 26px rgba(2,6,23,0.55)",
      alignment: "center",
    },
    animationIn: "POP",
    animationOut: "FADE",
    locked: false,
    muted: false,
  });

  timelineItems.push({
    id: "voiceover-main",
    trackId: "track-voiceover",
    trackType: "VOICEOVER",
    startFrame: 0,
    durationFrames,
    zIndex: 0,
    position: { x: 0, y: 0 },
    scale: 1,
    rotation: 0,
    opacity: 1,
    text: input.project.script,
    src: input.project.voiceoverStoragePath || "",
    animationIn: "NONE",
    animationOut: "NONE",
    locked: false,
    muted: false,
  });

  timelineItems.push({
    id: "music-bed",
    trackId: "track-music",
    trackType: "MUSIC",
    startFrame: 0,
    durationFrames,
    zIndex: 0,
    position: { x: 0, y: 0 },
    scale: 1,
    rotation: 0,
    opacity: 1,
    text: input.project.musicMode,
    animationIn: "NONE",
    animationOut: "NONE",
    locked: false,
    muted: false,
  });

  return {
    id: `spec-${input.project.id}`,
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    version: "1.0",
    creationMode: input.creationMode,
    title: input.project.title,
    format: "9:16",
    width: 1080,
    height: 1920,
    fps,
    durationFrames,
    qualityTier: input.project.routingTier || "ECONOMY",
    templateId: input.template.id,
    concept: input.concept,
    objective: input.project.objective,
    callToAction: input.project.callToAction,
    channel: input.project.channel,
    durationSeconds: input.project.durationSeconds,
    strictTextlessFrames: true,
    scenes: input.project.scenes.map((scene) => ({
      order: scene.order,
      seconds: scene.seconds,
      visualDirection: scene.visual,
      narration: scene.narration,
      overlayText: scene.onScreenText,
    })),
    tracks,
    timelineItems,
    caption: input.project.caption,
    hashtags: input.project.hashtags,
    productAssetIds: Array.from(new Set(input.project.scenes.map((scene) => scene.productAssetId || "").filter(Boolean))),
    exactProductMode: input.project.scenes.some((scene) => scene.productMode === "EXACT_PRODUCT"),
  };
}
