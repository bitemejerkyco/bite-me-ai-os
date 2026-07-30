import { TIKTOK_REQUIRED_SCOPES } from "@/features/integrations/tiktok/types";

export type TikTokConfig = {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: string;
  sandboxEnabled: boolean;
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
    sandboxEnabled: value("TIKTOK_SANDBOX_ENABLED").toLowerCase() === "true",
    scopes: [...TIKTOK_REQUIRED_SCOPES],
  };
}

export function getMissingTikTokConfig(config = loadTikTokConfig()): string[] {
  const missing: string[] = [];
  if (!config.clientKey) missing.push("TIKTOK_CLIENT_KEY");
  if (!config.clientSecret) missing.push("TIKTOK_CLIENT_SECRET");
  if (!config.redirectUri) missing.push("TIKTOK_REDIRECT_URI");
  if (!config.encryptionKey) missing.push("TIKTOK_TOKEN_ENCRYPTION_KEY");
  if (!config.sandboxEnabled) missing.push("TIKTOK_SANDBOX_ENABLED=true");
  return missing;
}

export function assertTikTokConfigured(): TikTokConfig {
  const config = loadTikTokConfig();
  const missing = getMissingTikTokConfig(config);
  if (missing.length > 0) {
    throw new Error(
      `TIKTOK_SETUP_REQUIRED:Missing TikTok sandbox configuration: ${missing.join(", ")}.`,
    );
  }
  return config;
}
