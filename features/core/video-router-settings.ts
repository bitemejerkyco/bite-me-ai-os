import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_VIDEO_ROUTER_SETTINGS,
  normalizeVideoGenerationMode,
  normalizeVideoRenderTier,
  type VideoRouterSettings,
} from "@/features/core/video-router";

const VIDEO_ROUTER_SETTING_KEYS = [
  "video_generation_mode",
  "video_router_default_tier",
  "video_router_economy_model",
  "video_router_balanced_model",
  "video_router_premium_model",
  "video_router_economy_cost_cents_per_second",
  "video_router_balanced_cost_cents_per_second",
  "video_router_premium_cost_cents_per_second",
  "video_router_max_retries",
  "video_router_emergency_disabled",
] as const;

function readSettingValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}

export async function loadVideoRouterSettings(): Promise<VideoRouterSettings> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("system_settings")
    .select("key,value")
    .in("key", [...VIDEO_ROUTER_SETTING_KEYS]);

  if (error) {
    throw new Error(`VIDEO_ROUTER_SETTINGS_LOAD_FAILED:${error.message}`);
  }

  const settingsByKey = new Map(
    ((data as Array<{ key: string; value: unknown }> | null) || []).map((row) => [
      row.key,
      readSettingValue(row.value),
    ]),
  );

  return {
    mode: normalizeVideoGenerationMode(
      settingsByKey.get("video_generation_mode") || DEFAULT_VIDEO_ROUTER_SETTINGS.mode,
    ),
    defaultTier: normalizeVideoRenderTier(
      settingsByKey.get("video_router_default_tier") || DEFAULT_VIDEO_ROUTER_SETTINGS.defaultTier,
    ),
    economyModel:
      settingsByKey.get("video_router_economy_model") ||
      DEFAULT_VIDEO_ROUTER_SETTINGS.economyModel,
    balancedModel:
      settingsByKey.get("video_router_balanced_model") ||
      DEFAULT_VIDEO_ROUTER_SETTINGS.balancedModel,
    premiumModel:
      settingsByKey.get("video_router_premium_model") ||
      DEFAULT_VIDEO_ROUTER_SETTINGS.premiumModel,
    economyCostCentsPerSecond: Number(
      settingsByKey.get("video_router_economy_cost_cents_per_second") ||
        DEFAULT_VIDEO_ROUTER_SETTINGS.economyCostCentsPerSecond,
    ),
    balancedCostCentsPerSecond: Number(
      settingsByKey.get("video_router_balanced_cost_cents_per_second") ||
        DEFAULT_VIDEO_ROUTER_SETTINGS.balancedCostCentsPerSecond,
    ),
    premiumCostCentsPerSecond: Number(
      settingsByKey.get("video_router_premium_cost_cents_per_second") ||
        DEFAULT_VIDEO_ROUTER_SETTINGS.premiumCostCentsPerSecond,
    ),
    maxRetries: Number(
      settingsByKey.get("video_router_max_retries") || DEFAULT_VIDEO_ROUTER_SETTINGS.maxRetries,
    ),
    emergencyDisabled:
      (settingsByKey.get("video_router_emergency_disabled") || "false") === "true",
  };
}