import type { VideoProject } from "@/features/core/video-project";
import type { VideoRouterProfile } from "@/features/core/video-router";

export type VideoQualityTier = "ECONOMY" | "BALANCED" | "PREMIUM";

export type VideoQualityDescriptor = {
  tier: VideoQualityTier;
  label: "Economy" | "Standard" | "Premium";
  description: string;
  expectedSecondsRange: [number, number];
};

export const VIDEO_QUALITY_DESCRIPTORS: Record<VideoQualityTier, VideoQualityDescriptor> = {
  ECONOMY: {
    tier: "ECONOMY",
    label: "Economy",
    description: "Fastest and least expensive. Best for testing ideas.",
    expectedSecondsRange: [60, 150],
  },
  BALANCED: {
    tier: "BALANCED",
    label: "Standard",
    description: "Better motion and consistency for everyday posts.",
    expectedSecondsRange: [120, 240],
  },
  PREMIUM: {
    tier: "PREMIUM",
    label: "Premium",
    description: "Highest available quality for final campaigns.",
    expectedSecondsRange: [180, 360],
  },
};

export function normalizeRequestedVideoQualityTier(value: unknown): VideoQualityTier | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "ECONOMY") return "ECONOMY";
  if (normalized === "BALANCED" || normalized === "STANDARD") return "BALANCED";
  if (normalized === "PREMIUM") return "PREMIUM";
  return null;
}

export function estimateVideoGenerationTimeSeconds(input: {
  tier: VideoQualityTier;
  durationSeconds: VideoProject["durationSeconds"];
}): { minSeconds: number; maxSeconds: number } {
  const range = VIDEO_QUALITY_DESCRIPTORS[input.tier].expectedSecondsRange;
  const durationFactor = Math.max(0, Number(input.durationSeconds) - 8);
  return {
    minSeconds: range[0] + durationFactor * 6,
    maxSeconds: range[1] + durationFactor * 10,
  };
}

export function formatProviderModelDisplay(profile: VideoRouterProfile): string {
  const provider = profile.providerKey.trim().toUpperCase();
  const model = profile.model.trim();
  return `${provider}: ${model}`;
}

export function formatEstimateDurationLabel(input: { minSeconds: number; maxSeconds: number }): string {
  const toLabel = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    if (minutes <= 0) return `${remainder}s`;
    return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
  };
  return `${toLabel(input.minSeconds)} - ${toLabel(input.maxSeconds)}`;
}
