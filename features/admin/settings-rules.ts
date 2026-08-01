export const SYSTEM_SETTING_KEYS = [
  "default_trial_days",
  "default_ai_credits",
  "default_video_credits",
  "maximum_upload_size_bytes",
  "maintenance_mode",
  "announcement_banner",
  "support_email",
  "default_onboarding_flow",
  "ai_daily_spend_limit_cents",
  "video_daily_spend_limit_cents",
  "storage_warning_percentage",
  "storage_critical_percentage",
  "tiktok_content_posting_mode",
  "tiktok_webhooks_enabled",
  "tiktok_media_base_url",
  "tiktok_verified_url_prefix",
  "tiktok_beta_emergency_disabled",
  "tiktok_daily_upload_limit_per_workspace",
  "tiktok_max_pending_jobs_per_user",
  "tiktok_beta_start_at",
  "tiktok_beta_end_at",
] as const;

export type SystemSettingKey = (typeof SYSTEM_SETTING_KEYS)[number];

export function canAccessDuringMaintenance(input: {
  maintenanceMode: boolean;
  isSuperAdmin: boolean;
}) {
  return !input.maintenanceMode || input.isSuperAdmin;
}

function parseInteger(rawValue: string, minimum = 0, maximum?: number): number {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error("SETTING_VALUE_INVALID:Expected a valid integer.");
  }
  if (typeof maximum === "number" && parsed > maximum) {
    throw new Error("SETTING_VALUE_INVALID:Value is above the allowed maximum.");
  }
  return parsed;
}

function parseIsoDateTime(rawValue: string): string {
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("SETTING_VALUE_INVALID:Expected a valid date-time value.");
  }
  return parsed.toISOString();
}

function parseTikTokMode(rawValue: string): string {
  const value = rawValue.trim().toLowerCase();
  if (!["disabled", "sandbox", "beta_upload", "direct_post"].includes(value)) {
    throw new Error(
      "SETTING_VALUE_INVALID:TikTok mode must be disabled, sandbox, beta_upload, or direct_post.",
    );
  }
  return value;
}

function parseHttpsUrl(rawValue: string, allowEmpty = false): string {
  const value = rawValue.trim();
  if (!value) {
    if (allowEmpty) return "";
    throw new Error("SETTING_VALUE_INVALID:Value cannot be empty.");
  }
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") {
    throw new Error("SETTING_VALUE_INVALID:URL must use https.");
  }
  return value;
}

export function validateSystemSettingValue(
  key: SystemSettingKey,
  rawValue: string,
) {
  const value = rawValue.trim();

  switch (key) {
    case "default_trial_days":
    case "default_ai_credits":
    case "default_video_credits":
    case "maximum_upload_size_bytes":
    case "ai_daily_spend_limit_cents":
    case "video_daily_spend_limit_cents":
    case "tiktok_daily_upload_limit_per_workspace":
    case "tiktok_max_pending_jobs_per_user":
      return parseInteger(value, 0);
    case "storage_warning_percentage":
    case "storage_critical_percentage":
      return parseInteger(value, 0, 100);
    case "tiktok_content_posting_mode":
      return parseTikTokMode(value);
    case "tiktok_webhooks_enabled":
    case "tiktok_beta_emergency_disabled":
      if (!["true", "false"].includes(value.toLowerCase())) {
        throw new Error("SETTING_VALUE_INVALID:Expected true or false.");
      }
      return value.toLowerCase() === "true";
    case "tiktok_media_base_url":
    case "tiktok_verified_url_prefix":
      return parseHttpsUrl(value, true);
    case "tiktok_beta_start_at":
    case "tiktok_beta_end_at":
      return parseIsoDateTime(value);
    case "maintenance_mode":
      if (!["true", "false"].includes(value.toLowerCase())) {
        throw new Error("SETTING_VALUE_INVALID:Maintenance mode must be true or false.");
      }
      return value.toLowerCase() === "true";
    case "support_email":
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new Error("SETTING_VALUE_INVALID:Support email must be valid.");
      }
      return value;
    case "default_onboarding_flow":
      if (!value) {
        throw new Error("SETTING_VALUE_INVALID:Onboarding flow cannot be empty.");
      }
      return value;
    case "announcement_banner": {
      const parsed = JSON.parse(value || "{}");
      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof parsed.enabled !== "boolean" ||
        typeof parsed.message !== "string"
      ) {
        throw new Error(
          "SETTING_VALUE_INVALID:Announcement banner must contain enabled and message fields.",
        );
      }
      return {
        enabled: parsed.enabled,
        message: parsed.message.slice(0, 500),
      };
    }
    default:
      throw new Error("SETTING_KEY_INVALID:Unknown system setting key.");
  }
}