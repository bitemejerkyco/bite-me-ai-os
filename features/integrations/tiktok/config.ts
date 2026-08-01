import {
  TIKTOK_REQUIRED_SCOPES,
  normalizeTikTokIntegrationMode,
  type TikTokIntegrationMode,
} from "@/features/integrations/tiktok/types";

export type TikTokConfig = {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: string;
  postingMode: TikTokIntegrationMode;
  webhooksEnabled: boolean;
  mediaBaseUrl: string;
  verifiedUrlPrefix: string;
  scopes: string[];
};

function value(name: string): string {
  return (process.env[name] || "").trim();
}

export function loadTikTokConfig(): TikTokConfig {
  return {
    clientKey: value("TIKTOK_CLIENT_KEY"),
    clientSecret: value("TIKTOK_CLIENT_SECRET"),
    redirectUri: value("TIKTOK_REDIRECT_URI"),
    encryptionKey: value("TIKTOK_TOKEN_ENCRYPTION_KEY"),
    postingMode: normalizeTikTokIntegrationMode(
      value("TIKTOK_CONTENT_POSTING_MODE"),
      "beta_upload",
    ),
    webhooksEnabled: value("TIKTOK_WEBHOOKS_ENABLED").toLowerCase() === "true",
    mediaBaseUrl: value("TIKTOK_MEDIA_BASE_URL"),
    verifiedUrlPrefix: value("TIKTOK_VERIFIED_URL_PREFIX"),
    scopes: [...TIKTOK_REQUIRED_SCOPES],
  };
}

export function getMissingTikTokConfig(config = loadTikTokConfig()): string[] {
  const missing: string[] = [];
  if (!config.clientKey) missing.push("TIKTOK_CLIENT_KEY");
  if (!config.clientSecret) missing.push("TIKTOK_CLIENT_SECRET");
  if (!config.redirectUri) missing.push("TIKTOK_REDIRECT_URI");
  if (!config.encryptionKey) missing.push("TIKTOK_TOKEN_ENCRYPTION_KEY");
  return missing;
}

export function assertTikTokConfigured(): TikTokConfig {
  const config = loadTikTokConfig();
  const missing = getMissingTikTokConfig(config);
  if (missing.length > 0) {
    throw new Error(
      `TIKTOK_SETUP_REQUIRED:Missing TikTok configuration: ${missing.join(", ")}.`,
    );
  }
  return config;
}
