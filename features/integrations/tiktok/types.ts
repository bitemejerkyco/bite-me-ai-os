export const TIKTOK_REQUIRED_SCOPES = [
  "user.info.basic",
  "video.publish",
] as const;

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
  | "error";

export type TikTokConnectionView = {
  configured: boolean;
  sandboxMode: boolean;
  status: TikTokConnectionStatus;
  message: string | null;
  connectionId: string | null;
  openId: string | null;
  scopes: string[];
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
  creator: TikTokCreatorInfo | null;
  postingMode: "SANDBOX_PRIVATE_ONLY";
};
