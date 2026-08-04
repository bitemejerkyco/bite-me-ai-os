export const TIKTOK_REQUIRED_SCOPES = [
  "user.info.basic",
  "video.upload",
] as const;

export const TIKTOK_REQUESTED_SCOPES = [
  ...TIKTOK_REQUIRED_SCOPES,
  "video.publish",
] as const;

export const TIKTOK_INTEGRATION_MODES = [
  "disabled",
  "sandbox",
  "beta_upload",
  "direct_post",
] as const;

export type TikTokIntegrationMode = (typeof TIKTOK_INTEGRATION_MODES)[number];

export function normalizeTikTokIntegrationMode(
  value: string | null | undefined,
  fallback: TikTokIntegrationMode = "beta_upload",
): TikTokIntegrationMode {
  const normalized = String(value || "").trim().toLowerCase();
  return (TIKTOK_INTEGRATION_MODES as readonly string[]).includes(normalized)
    ? (normalized as TikTokIntegrationMode)
    : fallback;
}

export const TIKTOK_PUBLISH_JOB_STATUSES = [
  "draft",
  "validating",
  "initializing",
  "uploading",
  "processing",
  "inbox_delivered",
  "published",
  "failed",
  "cancelled",
  "reconnect_required",
] as const;

export type TikTokPublishJobStatus = (typeof TIKTOK_PUBLISH_JOB_STATUSES)[number];

export type TikTokCreatorInfo = {
  avatarUrl: string | null;
  username: string | null;
  nickname: string | null;
  privacyLevelOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoDurationSeconds: number | null;
};

export type TikTokTokenResponse = {
  accessToken: string;
  refreshToken: string;
  openId: string;
  scope: string[];
  expiresInSeconds: number;
  refreshExpiresInSeconds: number;
};

export type TikTokConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "expired"
  | "error"
  | "reconnect_required";

export type TikTokConnectionView = {
  configured: boolean;
  sandboxMode: boolean;
  postingMode: TikTokIntegrationMode;
  status: TikTokConnectionStatus;
  message: string | null;
  connectionId: string | null;
  openId: string | null;
  scopes: string[];
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
  creator: TikTokCreatorInfo | null;
  grantedScopes?: string[];
  tokenHealth?: "healthy" | "expiring" | "expired" | "missing" | "reconnect_required";
  connectedAt?: string | null;
  refreshedAt?: string | null;
  revokedAt?: string | null;
  verifiedMediaReady?: boolean;
  directPostEnabled?: boolean;
  uploadToDraftEnabled?: boolean;
  approvalState?: "not_requested" | "pending" | "approved" | "rejected" | "unknown";
};
