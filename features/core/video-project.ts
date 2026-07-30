import type { WorkspaceProfile } from "@/features/core/local-os";

export const VIDEO_PROMPT_VERSION = "postmotive-video-v1";
export const VIDEO_VOICES = [
  "marin",
  "cedar",
  "coral",
  "verse",
  "alloy",
] as const;

export type VideoVoice = (typeof VIDEO_VOICES)[number];
export type VideoMusicMode = "GENERATED_AMBIENT" | "LICENSED_LIBRARY" | "NONE";
export type VideoProvider = "OPENAI_SORA_TEMPORARY";
export type VideoStatus =
  | "DRAFT"
  | "GENERATING"
  | "READY"
  | "FAILED"
  | "APPROVED";

export type VideoScene = {
  order: number;
  seconds: number;
  visual: string;
  narration: string;
  onScreenText: string;
};

export type VideoProject = {
  id: string;
  contentDraftId?: string;
  title: string;
  channel: "TikTok" | "Instagram Reels" | "YouTube Shorts";
  objective: string;
  prompt: string;
  script: string;
  caption: string;
  scenes: VideoScene[];
  durationSeconds: 8 | 16 | 20;
  aspectRatio: "9:16";
  voice: VideoVoice;
  voiceDisclosure: boolean;
  musicMode: VideoMusicMode;
  licensedMusicAssetId?: string;
  provider: VideoProvider;
  providerJobId?: string;
  providerProgress?: number;
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
  if (
    !workspace ||
    typeof workspace.businessName !== "string" ||
    typeof workspace.industry !== "string" ||
    typeof input.objective !== "string" ||
    typeof input.message !== "string" ||
    typeof input.callToAction !== "string" ||
    !["TikTok", "Instagram Reels", "YouTube Shorts"].includes(
      String(input.channel),
    ) ||
    ![8, 16, 20].includes(Number(input.durationSeconds)) ||
    !isVideoVoice(input.voice) ||
    !isVideoMusicMode(input.musicMode)
  ) {
    return null;
  }
  return input as VideoPlanInput;
}

export function buildVideoPlanningPrompt(input: VideoPlanInput): string {
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
    "Return only JSON with: title, script, caption, renderPrompt, complianceNote, and scenes.",
    "scenes must be an array of 2-5 objects with order, seconds, visual, narration, and onScreenText.",
    "Scene seconds must total the requested duration.",
    "Keep on-screen text brief and readable. Include burned-in caption wording in the scene plan.",
    "Never invent prices, discounts, certifications, testimonials, legal approval, or product claims.",
    "Do not request real people, celebrities, copyrighted characters, copyrighted music, or third-party watermarks.",
    "The renderPrompt must describe a 9:16 commercial-quality video with original imagery and generated ambient audio only when requested.",
  ].join("\n");
}

export function parseVideoPlanResponse(value: string): {
  title: string;
  script: string;
  caption: string;
  renderPrompt: string;
  complianceNote: string;
  scenes: VideoScene[];
} | null {
  try {
    const cleaned = value
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    if (
      typeof parsed.title !== "string" ||
      typeof parsed.script !== "string" ||
      typeof parsed.caption !== "string" ||
      typeof parsed.renderPrompt !== "string" ||
      typeof parsed.complianceNote !== "string" ||
      !Array.isArray(parsed.scenes)
    ) {
      return null;
    }
    const scenes = parsed.scenes.map((scene, index) => {
      const item = scene as Record<string, unknown>;
      return {
        order: Number(item.order) || index + 1,
        seconds: Number(item.seconds) || 1,
        visual: String(item.visual || ""),
        narration: String(item.narration || ""),
        onScreenText: String(item.onScreenText || ""),
      };
    });
    if (!scenes.length || scenes.some((scene) => !scene.visual)) return null;
    return {
      title: parsed.title,
      script: parsed.script,
      caption: parsed.caption,
      renderPrompt: parsed.renderPrompt,
      complianceNote: parsed.complianceNote,
      scenes,
    };
  } catch {
    return null;
  }
}
