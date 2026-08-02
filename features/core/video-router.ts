import type { VideoProject } from "@/features/core/video-project";

export type VideoRenderTier = "ECONOMY" | "BALANCED" | "PREMIUM";
export type VideoGenerationMode = "AUTO" | "ECONOMY" | "BALANCED" | "PREMIUM" | "DISABLED";

export type VideoRouterProfile = {
  tier: VideoRenderTier;
  providerKey: string;
  model: string;
  estimatedCostCentsPerSecond: number;
  maxRetries: number;
};

export type VideoRouterSettings = {
  mode: VideoGenerationMode;
  defaultTier: VideoRenderTier;
  economyModel: string;
  balancedModel: string;
  premiumModel: string;
  economyCostCentsPerSecond: number;
  balancedCostCentsPerSecond: number;
  premiumCostCentsPerSecond: number;
  maxRetries: number;
  emergencyDisabled: boolean;
};

export const DEFAULT_VIDEO_ROUTER_SETTINGS: VideoRouterSettings = {
  mode: "AUTO",
  defaultTier: "BALANCED",
  economyModel: "wan-2.2-fast",
  balancedModel: "sora-2-pro",
  premiumModel: "sora-2-pro",
  economyCostCentsPerSecond: 45,
  balancedCostCentsPerSecond: 70,
  premiumCostCentsPerSecond: 110,
  maxRetries: 2,
  emergencyDisabled: false,
};

export function normalizeVideoGenerationMode(value: string): VideoGenerationMode {
  const normalized = value.trim().toUpperCase();
  if (["AUTO", "ECONOMY", "BALANCED", "PREMIUM", "DISABLED"].includes(normalized)) {
    return normalized as VideoGenerationMode;
  }
  return DEFAULT_VIDEO_ROUTER_SETTINGS.mode;
}

export function normalizeVideoRenderTier(value: string): VideoRenderTier {
  const normalized = value.trim().toUpperCase();
  if (["ECONOMY", "BALANCED", "PREMIUM"].includes(normalized)) {
    return normalized as VideoRenderTier;
  }
  return DEFAULT_VIDEO_ROUTER_SETTINGS.defaultTier;
}

export function selectVideoRenderTier(input: {
  requestedTier?: string | null;
  mode?: VideoGenerationMode;
  seconds: VideoProject["durationSeconds"];
  sourceVideoId?: string | null;
  defaultTier?: VideoRenderTier;
}): VideoRenderTier {
  if (input.mode === "DISABLED") {
    throw new Error("VIDEO_ROUTER_DISABLED:Video generation is currently disabled.");
  }

  const explicitTier = input.requestedTier ? normalizeVideoRenderTier(input.requestedTier) : null;
  if (explicitTier) return explicitTier;

  if (input.mode && input.mode !== "AUTO") {
    return normalizeVideoRenderTier(input.mode);
  }

  if (input.sourceVideoId) {
    if (input.seconds >= 14) return "PREMIUM";
    if (input.seconds >= 11) return "BALANCED";
    return "ECONOMY";
  }

  if (input.seconds <= 10) return "ECONOMY";
  if (input.seconds <= 13) return "BALANCED";
  return input.defaultTier || DEFAULT_VIDEO_ROUTER_SETTINGS.defaultTier;
}

export function resolveVideoRouterProfile(input: {
  requestedTier?: string | null;
  mode?: VideoGenerationMode;
  seconds: VideoProject["durationSeconds"];
  sourceVideoId?: string | null;
  settings?: Partial<VideoRouterSettings>;
}): VideoRouterProfile {
  const settings = { ...DEFAULT_VIDEO_ROUTER_SETTINGS, ...input.settings } satisfies VideoRouterSettings;
  const tier = selectVideoRenderTier({
    requestedTier: input.requestedTier,
    mode: input.mode || settings.mode,
    seconds: input.seconds,
    sourceVideoId: input.sourceVideoId,
    defaultTier: settings.defaultTier,
  });

  switch (tier) {
    case "ECONOMY":
      return {
        tier,
        providerKey: "REPLICATE",
        model: settings.economyModel,
        estimatedCostCentsPerSecond: settings.economyCostCentsPerSecond,
        maxRetries: settings.maxRetries,
      };
    case "PREMIUM":
      return {
        tier,
        providerKey: "OPENAI",
        model: settings.premiumModel,
        estimatedCostCentsPerSecond: settings.premiumCostCentsPerSecond,
        maxRetries: settings.maxRetries,
      };
    case "BALANCED":
    default:
      return {
        tier: "BALANCED",
        providerKey: "OPENAI",
        model: settings.balancedModel,
        estimatedCostCentsPerSecond: settings.balancedCostCentsPerSecond,
        maxRetries: settings.maxRetries,
      };
  }
}