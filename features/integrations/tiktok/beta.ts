import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type SystemSettingRow = {
  key: string;
  value: unknown;
};

type TikTokBetaSettings = {
  postingMode: string;
  emergencyDisabled: boolean;
  betaStartAt: string | null;
  betaEndAt: string | null;
  dailyLimit: number;
  pendingLimit: number;
  mediaBaseUrl: string;
  verifiedUrlPrefix: string;
};

export type TikTokBetaAccessSnapshot = TikTokBetaSettings & {
  workspaceAllowed: boolean;
  userAllowed: boolean;
  allowed: boolean;
  reason: string | null;
};

const ACTIVE_JOB_STATUSES = new Set([
  "draft",
  "validating",
  "initializing",
  "uploading",
  "processing",
  "reconnect_required",
]);

function settingValue(settings: Map<string, unknown>, key: string, fallback = "") {
  const value = settings.get(key);
  return typeof value === "string" ? value : fallback;
}

function settingBoolean(settings: Map<string, unknown>, key: string): boolean {
  return String(settings.get(key) ?? "false").toLowerCase() === "true";
}

function settingDate(settings: Map<string, unknown>, key: string): string | null {
  const value = settingValue(settings, key, "").trim();
  return value ? new Date(value).toISOString() : null;
}

function settingInteger(settings: Map<string, unknown>, key: string, fallback: number): number {
  const parsed = Number(settingValue(settings, key, String(fallback)));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

async function loadBetaSnapshot(workspaceId: string, userId: string): Promise<TikTokBetaAccessSnapshot> {
  const admin = createAdminClient();
  const [settingsResult, workspaceAllowlistResult, userAllowlistResult] = await Promise.all([
    admin
      .from("system_settings")
      .select("key,value")
      .in("key", [
        "tiktok_content_posting_mode",
        "tiktok_beta_emergency_disabled",
        "tiktok_beta_start_at",
        "tiktok_beta_end_at",
        "tiktok_daily_upload_limit_per_workspace",
        "tiktok_max_pending_jobs_per_user",
        "tiktok_media_base_url",
        "tiktok_verified_url_prefix",
      ]),
    admin
      .from("tiktok_beta_allowed_workspaces")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    admin
      .from("tiktok_beta_allowed_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (settingsResult.error) {
    throw new Error(`TIKTOK_BETA_SETTINGS_FAILED:${settingsResult.error.message}`);
  }
  if (workspaceAllowlistResult.error) {
    throw new Error(`TIKTOK_BETA_WORKSPACE_CHECK_FAILED:${workspaceAllowlistResult.error.message}`);
  }
  if (userAllowlistResult.error) {
    throw new Error(`TIKTOK_BETA_USER_CHECK_FAILED:${userAllowlistResult.error.message}`);
  }

  const settings = new Map<string, unknown>(
    ((settingsResult.data as SystemSettingRow[] | null) || []).map((row) => [row.key, row.value]),
  );
  const postingMode = settingValue(settings, "tiktok_content_posting_mode", "disabled");
  const emergencyDisabled = settingBoolean(settings, "tiktok_beta_emergency_disabled");
  const betaStartAt = settingDate(settings, "tiktok_beta_start_at");
  const betaEndAt = settingDate(settings, "tiktok_beta_end_at");
  const dailyLimit = settingInteger(settings, "tiktok_daily_upload_limit_per_workspace", 5);
  const pendingLimit = Math.min(
    5,
    settingInteger(settings, "tiktok_max_pending_jobs_per_user", 5),
  );
  const mediaBaseUrl = settingValue(settings, "tiktok_media_base_url", "");
  const verifiedUrlPrefix = settingValue(settings, "tiktok_verified_url_prefix", "");
  const now = Date.now();
  const startAllowed = !betaStartAt || now >= new Date(betaStartAt).getTime();
  const endAllowed = !betaEndAt || now <= new Date(betaEndAt).getTime();
  const workspaceAllowed = Boolean(workspaceAllowlistResult.data);
  const userAllowed = Boolean(userAllowlistResult.data);
  const allowed =
    !emergencyDisabled &&
    postingMode === "beta_upload" &&
    (workspaceAllowed || userAllowed) &&
    startAllowed &&
    endAllowed;

  return {
    postingMode,
    emergencyDisabled,
    betaStartAt,
    betaEndAt,
    dailyLimit,
    pendingLimit,
    mediaBaseUrl,
    verifiedUrlPrefix,
    workspaceAllowed,
    userAllowed,
    allowed,
    reason: emergencyDisabled
      ? "TikTok beta is globally disabled."
      : postingMode !== "beta_upload"
        ? "TikTok beta upload mode is not enabled."
        : !workspaceAllowed && !userAllowed
          ? "This workspace is not beta-allowed."
          : !startAllowed
            ? "TikTok beta has not started yet."
            : !endAllowed
              ? "TikTok beta has ended."
              : null,
  };
}

export async function isTikTokBetaAllowed(workspaceId: string, userId: string): Promise<boolean> {
  return (await loadBetaSnapshot(workspaceId, userId)).allowed;
}

export async function getTikTokDailyUploadLimit(workspaceId: string): Promise<number> {
  return (await loadBetaSnapshot(workspaceId, "00000000-0000-0000-0000-000000000000")).dailyLimit;
}

export async function getTikTokPendingJobLimit(workspaceId: string): Promise<number> {
  return (await loadBetaSnapshot(workspaceId, "00000000-0000-0000-0000-000000000000")).pendingLimit;
}

export async function getTikTokUploadsToday(workspaceId: string, userId: string): Promise<number> {
  const admin = createAdminClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count, error } = await admin
    .from("tiktok_publish_jobs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("created_by", userId)
    .gte("submitted_at", startOfDay.toISOString());
  if (error) {
    throw new Error(`TIKTOK_DAILY_UPLOAD_COUNT_FAILED:${error.message}`);
  }
  return count || 0;
}

export async function getTikTokPendingJobs(workspaceId: string, userId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("tiktok_publish_jobs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("created_by", userId)
    .in("status", Array.from(ACTIVE_JOB_STATUSES));
  if (error) {
    throw new Error(`TIKTOK_PENDING_JOB_COUNT_FAILED:${error.message}`);
  }
  return count || 0;
}

export async function getTikTokBetaAccessSnapshot(workspaceId: string, userId: string) {
  return loadBetaSnapshot(workspaceId, userId);
}