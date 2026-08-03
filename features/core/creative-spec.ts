export const CREATIVE_SPEC_VERSION = "1.0" as const;

export const CREATION_MODES = [
  "UGC_STYLE",
  "PRODUCT_DEMO",
  "BEFORE_AFTER",
  "HOW_TO",
  "MEME",
  "VIRAL_READY_VIDEO",
  "ANIMATED_MEME",
  "STATIC_MEME",
  "PRODUCT_ADVERTISEMENT",
  "PRODUCT_SLIDESHOW",
  "CAPTION_VIDEO",
  "START_FROM_SCRATCH",
] as const;

export const CREATIVE_CHANNELS = [
  "TikTok",
  "Instagram Reels",
  "Facebook Reels",
  "YouTube Shorts",
] as const;

export type CreationMode = (typeof CREATION_MODES)[number];
export type CreativeChannel = (typeof CREATIVE_CHANNELS)[number];

export const CREATIVE_TRACK_TYPES = [
  "VIDEO",
  "IMAGE",
  "PRODUCT",
  "TEXT",
  "CAPTION",
  "AUDIO",
  "VOICEOVER",
  "MUSIC",
  "SOUND_EFFECT",
] as const;

export type CreativeTrackType = (typeof CREATIVE_TRACK_TYPES)[number];

export type TimelineTransform = {
  x: number;
  y: number;
};

export type TimelineStyle = {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  gradient?: string;
  stroke?: string;
  shadow?: string;
  background?: string;
  alignment?: "left" | "center" | "right";
};

export type TimelineAnimation =
  | "NONE"
  | "POP"
  | "BOUNCE"
  | "FADE"
  | "SLIDE"
  | "ZOOM"
  | "TYPEWRITER"
  | "WORD_BY_WORD"
  | "KARAOKE_HIGHLIGHT"
  | "SHAKE"
  | "PULSE";

export type CreativeTimelineItem = {
  id: string;
  trackId: string;
  trackType: CreativeTrackType;
  startFrame: number;
  durationFrames: number;
  zIndex: number;
  position: TimelineTransform;
  scale: number;
  rotation: number;
  opacity: number;
  style?: TimelineStyle;
  text?: string;
  src?: string;
  assetId?: string;
  animationIn?: TimelineAnimation;
  animationOut?: TimelineAnimation;
  locked: boolean;
  muted: boolean;
};

export type CreativeTrack = {
  id: string;
  type: CreativeTrackType;
  label: string;
  hidden: boolean;
  locked: boolean;
  muted: boolean;
};

export type CreativeSceneSpec = {
  order: number;
  seconds: number;
  visualDirection: string;
  narration: string;
  overlayText: string;
};

export type CreativeSpec = {
  id: string;
  workspaceId: string;
  projectId: string;
  version: typeof CREATIVE_SPEC_VERSION;
  creationMode: CreationMode;
  title: string;
  format: "9:16";
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
  qualityTier: "ECONOMY" | "BALANCED" | "PREMIUM";
  templateId: string;
  concept: string;
  objective: string;
  callToAction: string;
  channel: CreativeChannel;
  durationSeconds: number;
  strictTextlessFrames: boolean;
  scenes: CreativeSceneSpec[];
  tracks: CreativeTrack[];
  timelineItems: CreativeTimelineItem[];
  caption: string;
  hashtags: string[];
  productAssetIds: string[];
  exactProductMode: boolean;
};

export type CreativeSpecValidationResult = {
  valid: boolean;
  errors: string[];
  spec: CreativeSpec | null;
};

const SPEC_LIMITS = {
  titleMax: 120,
  conceptMax: 220,
  objectiveMax: 120,
  ctaMax: 80,
  captionMax: 320,
  hashtagsMax: 12,
  maxTracks: 16,
  maxTimelineItems: 180,
  scenesMin: 1,
  scenesMax: 8,
  sceneVisualMax: 240,
  sceneNarrationMax: 220,
  sceneOverlayMax: 80,
  durationMin: 8,
  durationMax: 30,
} as const;

const BANNED_RENDERED_TEXT_PATTERN = /\b(?:price|\$\d|promo code|coupon|limited time|buy now|shop now)\b/i;

function sanitizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function asSafeArray(input: unknown): unknown[] {
  return Array.isArray(input) ? input : [];
}

export function normalizeCreationMode(value: unknown): CreationMode {
  const raw = sanitizeText(value).toUpperCase().replaceAll("-", "_").replaceAll(" ", "_");
  return CREATION_MODES.find((mode) => mode === raw) || "PRODUCT_DEMO";
}

function normalizeChannel(value: unknown): CreativeChannel {
  const raw = sanitizeText(value);
  return CREATIVE_CHANNELS.find((channel) => channel.toLowerCase() === raw.toLowerCase()) || "TikTok";
}

function normalizeScenes(input: unknown): CreativeSceneSpec[] {
  return asSafeArray(input)
    .map((scene, index) => {
      const row = scene && typeof scene === "object" ? scene as Record<string, unknown> : {};
      const seconds = Number(row.seconds);
      return {
        order: Number(row.order) || index + 1,
        seconds: Number.isFinite(seconds) ? Math.max(1, Math.round(seconds)) : 2,
        visualDirection: sanitizeText(row.visualDirection),
        narration: sanitizeText(row.narration),
        overlayText: sanitizeText(row.overlayText),
      };
    })
    .sort((a, b) => a.order - b.order)
    .slice(0, SPEC_LIMITS.scenesMax);
}

function normalizeTrackType(value: unknown): CreativeTrackType {
  const raw = sanitizeText(value).toUpperCase().replaceAll("-", "_").replaceAll(" ", "_");
  return CREATIVE_TRACK_TYPES.find((trackType) => trackType === raw) || "VIDEO";
}

function normalizeTracks(input: unknown): CreativeTrack[] {
  return asSafeArray(input)
    .map((row, index) => {
      const track = row && typeof row === "object" ? row as Record<string, unknown> : {};
      const type = normalizeTrackType(track.type);
      return {
        id: sanitizeText(track.id) || `track-${index + 1}`,
        type,
        label: sanitizeText(track.label) || type,
        hidden: Boolean(track.hidden),
        locked: Boolean(track.locked),
        muted: Boolean(track.muted),
      };
    })
    .slice(0, SPEC_LIMITS.maxTracks);
}

function normalizeAnimation(value: unknown): TimelineAnimation | undefined {
  const raw = sanitizeText(value).toUpperCase().replaceAll("-", "_").replaceAll(" ", "_");
  const allowed: TimelineAnimation[] = [
    "NONE",
    "POP",
    "BOUNCE",
    "FADE",
    "SLIDE",
    "ZOOM",
    "TYPEWRITER",
    "WORD_BY_WORD",
    "KARAOKE_HIGHLIGHT",
    "SHAKE",
    "PULSE",
  ];
  return allowed.find((item) => item === raw);
}

function normalizeTimelineItems(input: unknown): CreativeTimelineItem[] {
  return asSafeArray(input)
    .map((row, index) => {
      const item = row && typeof row === "object" ? row as Record<string, unknown> : {};
      const startFrame = Number(item.startFrame);
      const durationFrames = Number(item.durationFrames);
      const zIndex = Number(item.zIndex);
      const scale = Number(item.scale);
      const rotation = Number(item.rotation);
      const opacity = Number(item.opacity);
      const x = Number((item.position as Record<string, unknown> | undefined)?.x);
      const y = Number((item.position as Record<string, unknown> | undefined)?.y);

      return {
        id: sanitizeText(item.id) || `item-${index + 1}`,
        trackId: sanitizeText(item.trackId),
        trackType: normalizeTrackType(item.trackType),
        startFrame: Number.isFinite(startFrame) ? Math.max(0, Math.round(startFrame)) : 0,
        durationFrames: Number.isFinite(durationFrames) ? Math.max(1, Math.round(durationFrames)) : 1,
        zIndex: Number.isFinite(zIndex) ? Math.round(zIndex) : index,
        position: {
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : 0,
        },
        scale: Number.isFinite(scale) ? Math.max(0.05, Math.min(4, scale)) : 1,
        rotation: Number.isFinite(rotation) ? Math.max(-360, Math.min(360, rotation)) : 0,
        opacity: Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1,
        style: item.style && typeof item.style === "object" ? item.style as TimelineStyle : undefined,
        text: sanitizeText(item.text),
        src: sanitizeText(item.src),
        assetId: sanitizeText(item.assetId),
        animationIn: normalizeAnimation(item.animationIn),
        animationOut: normalizeAnimation(item.animationOut),
        locked: Boolean(item.locked),
        muted: Boolean(item.muted),
      };
    })
    .slice(0, SPEC_LIMITS.maxTimelineItems);
}

export function buildTextlessFrameConstraint(): string {
  return [
    "Do not render words, letters, captions, logos, labels, product names, prices, packaging text, URLs, or calls to action in generated frames.",
    "Leave clean visual space so deterministic overlay tracks can render text safely after generation.",
  ].join(" ");
}

export function validateCreativeSpec(input: unknown): CreativeSpecValidationResult {
  const payload = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const scenes = normalizeScenes(payload.scenes);
  const tracks = normalizeTracks(payload.tracks);
  const timelineItems = normalizeTimelineItems(payload.timelineItems);
  const durationSeconds = Number(payload.durationSeconds);
  const width = Number(payload.width);
  const height = Number(payload.height);
  const fps = Number(payload.fps);
  const durationFrames = Number(payload.durationFrames);
  const productAssetIds = asSafeArray(payload.productAssetIds).map((item) => sanitizeText(item)).filter(Boolean).slice(0, 12);
  const hashtags = asSafeArray(payload.hashtags).map((item) => sanitizeText(item)).filter(Boolean).slice(0, SPEC_LIMITS.hashtagsMax);

  const spec: CreativeSpec = {
    id: sanitizeText(payload.id),
    workspaceId: sanitizeText(payload.workspaceId),
    projectId: sanitizeText(payload.projectId),
    version: CREATIVE_SPEC_VERSION,
    creationMode: normalizeCreationMode(payload.creationMode),
    title: sanitizeText(payload.title),
    format: "9:16",
    width: Number.isFinite(width) ? width : 1080,
    height: Number.isFinite(height) ? height : 1920,
    fps: Number.isFinite(fps) ? fps : 30,
    durationFrames: Number.isFinite(durationFrames) ? Math.max(1, Math.round(durationFrames)) : 360,
    qualityTier: ["ECONOMY", "BALANCED", "PREMIUM"].includes(sanitizeText(payload.qualityTier).toUpperCase())
      ? sanitizeText(payload.qualityTier).toUpperCase() as CreativeSpec["qualityTier"]
      : "ECONOMY",
    templateId: sanitizeText(payload.templateId) || "template-pattern-interrupt",
    concept: sanitizeText(payload.concept),
    objective: sanitizeText(payload.objective),
    callToAction: sanitizeText(payload.callToAction),
    channel: normalizeChannel(payload.channel),
    durationSeconds: Number.isFinite(durationSeconds)
      ? Math.max(SPEC_LIMITS.durationMin, Math.min(SPEC_LIMITS.durationMax, Math.round(durationSeconds)))
      : 12,
    strictTextlessFrames: payload.strictTextlessFrames !== false,
    scenes,
    tracks,
    timelineItems,
    caption: sanitizeText(payload.caption),
    hashtags,
    productAssetIds,
    exactProductMode: payload.exactProductMode !== false,
  };

  const errors: string[] = [];

  if (!spec.id) errors.push("CreativeSpec id is required.");
  if (!spec.workspaceId) errors.push("workspaceId is required.");
  if (!spec.projectId) errors.push("projectId is required.");
  if (!spec.title || spec.title.length > SPEC_LIMITS.titleMax) {
    errors.push(`Title is required and must be <= ${SPEC_LIMITS.titleMax} characters.`);
  }
  if (!spec.templateId) errors.push("Template is required.");
  if (!spec.concept || spec.concept.length > SPEC_LIMITS.conceptMax) {
    errors.push(`Concept is required and must be <= ${SPEC_LIMITS.conceptMax} characters.`);
  }
  if (!spec.objective || spec.objective.length > SPEC_LIMITS.objectiveMax) {
    errors.push(`Objective is required and must be <= ${SPEC_LIMITS.objectiveMax} characters.`);
  }
  if (!spec.callToAction || spec.callToAction.length > SPEC_LIMITS.ctaMax) {
    errors.push(`Call to action is required and must be <= ${SPEC_LIMITS.ctaMax} characters.`);
  }
  if (!spec.caption || spec.caption.length > SPEC_LIMITS.captionMax) {
    errors.push(`Caption is required and must be <= ${SPEC_LIMITS.captionMax} characters.`);
  }
  if (spec.width !== 1080 || spec.height !== 1920 || spec.format !== "9:16") {
    errors.push("Only 9:16 1080x1920 output is currently supported.");
  }
  if (!Number.isFinite(spec.fps) || spec.fps < 24 || spec.fps > 60) {
    errors.push("fps must be between 24 and 60.");
  }
  if (spec.durationFrames !== spec.durationSeconds * spec.fps) {
    errors.push("durationFrames must equal durationSeconds * fps.");
  }
  if (!spec.tracks.length) {
    errors.push("At least one track is required.");
  }
  if (spec.timelineItems.length > SPEC_LIMITS.maxTimelineItems) {
    errors.push(`Timeline items exceed ${SPEC_LIMITS.maxTimelineItems}.`);
  }
  const trackIds = new Set(spec.tracks.map((track) => track.id));
  for (const item of spec.timelineItems) {
    if (!trackIds.has(item.trackId)) {
      errors.push(`Timeline item ${item.id} references missing track ${item.trackId}.`);
    }
    if (item.startFrame + item.durationFrames > spec.durationFrames) {
      errors.push(`Timeline item ${item.id} exceeds composition duration.`);
    }
    if (item.trackType === "TEXT" || item.trackType === "CAPTION") {
      if (!item.text) {
        errors.push(`Timeline item ${item.id} requires deterministic text.`);
      }
      if (spec.strictTextlessFrames && BANNED_RENDERED_TEXT_PATTERN.test(item.text || "")) {
        errors.push(`Timeline item ${item.id} text violates text safety constraints.`);
      }
    }
  }
  if (spec.scenes.length < SPEC_LIMITS.scenesMin || spec.scenes.length > SPEC_LIMITS.scenesMax) {
    errors.push(`Provide ${SPEC_LIMITS.scenesMin}-${SPEC_LIMITS.scenesMax} scenes.`);
  }

  let sceneSeconds = 0;
  for (const scene of spec.scenes) {
    sceneSeconds += scene.seconds;
    if (!scene.visualDirection || scene.visualDirection.length > SPEC_LIMITS.sceneVisualMax) {
      errors.push(`Scene ${scene.order}: visual direction is required and must be <= ${SPEC_LIMITS.sceneVisualMax} characters.`);
    }
    if (!scene.narration || scene.narration.length > SPEC_LIMITS.sceneNarrationMax) {
      errors.push(`Scene ${scene.order}: narration is required and must be <= ${SPEC_LIMITS.sceneNarrationMax} characters.`);
    }
    if (!scene.overlayText || scene.overlayText.length > SPEC_LIMITS.sceneOverlayMax) {
      errors.push(`Scene ${scene.order}: overlay text is required and must be <= ${SPEC_LIMITS.sceneOverlayMax} characters.`);
    }
    if (spec.strictTextlessFrames && BANNED_RENDERED_TEXT_PATTERN.test(scene.visualDirection)) {
      errors.push(`Scene ${scene.order}: visual direction appears to ask for rendered text in-frame.`);
    }
  }

  if (sceneSeconds !== spec.durationSeconds) {
    errors.push(`Scene durations must total ${spec.durationSeconds} seconds (currently ${sceneSeconds}).`);
  }

  return {
    valid: errors.length === 0,
    errors,
    spec: errors.length === 0 ? spec : null,
  };
}
