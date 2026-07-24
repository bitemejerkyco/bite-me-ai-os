import type { AmazonAdsLiveConfig } from "@/features/marketing/providers/amazon-ads/live/types";

type EnvValue = string | undefined;

type AmazonAdsEnv = {
  AMAZON_ADS_CLIENT_ID: EnvValue;
  AMAZON_ADS_CLIENT_SECRET: EnvValue;
  AMAZON_ADS_REDIRECT_URI: EnvValue;
  AMAZON_ADS_LIVE_READ_ENABLED: EnvValue;
  AMAZON_ADS_TOKEN_ENCRYPTION_KEY: EnvValue;
};

export const AMAZON_ADS_REQUIRED_ENV_KEYS = [
  "AMAZON_ADS_CLIENT_ID",
  "AMAZON_ADS_CLIENT_SECRET",
  "AMAZON_ADS_REDIRECT_URI",
  "AMAZON_ADS_TOKEN_ENCRYPTION_KEY",
] as const;

function sanitize(value: EnvValue): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseEnabledFlag(value: EnvValue): boolean {
  const normalized = sanitize(value).toLowerCase();
  if (!normalized) return false;
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function readAmazonAdsEnv(source: NodeJS.ProcessEnv = process.env): AmazonAdsEnv {
  return {
    AMAZON_ADS_CLIENT_ID: source.AMAZON_ADS_CLIENT_ID,
    AMAZON_ADS_CLIENT_SECRET: source.AMAZON_ADS_CLIENT_SECRET,
    AMAZON_ADS_REDIRECT_URI: source.AMAZON_ADS_REDIRECT_URI,
    AMAZON_ADS_LIVE_READ_ENABLED: source.AMAZON_ADS_LIVE_READ_ENABLED,
    AMAZON_ADS_TOKEN_ENCRYPTION_KEY: source.AMAZON_ADS_TOKEN_ENCRYPTION_KEY,
  };
}

export function getAmazonAdsLiveFeatureEnabled(source: NodeJS.ProcessEnv = process.env): boolean {
  return parseEnabledFlag(source.AMAZON_ADS_LIVE_READ_ENABLED);
}

export function getMissingAmazonAdsConfigKeys(source: NodeJS.ProcessEnv = process.env): string[] {
  const env = readAmazonAdsEnv(source);
  return AMAZON_ADS_REQUIRED_ENV_KEYS.filter((key) => !sanitize(env[key]));
}

export function loadAmazonAdsLiveConfig(source: NodeJS.ProcessEnv = process.env): AmazonAdsLiveConfig {
  const env = readAmazonAdsEnv(source);
  const config: AmazonAdsLiveConfig = {
    clientId: sanitize(env.AMAZON_ADS_CLIENT_ID),
    clientSecret: sanitize(env.AMAZON_ADS_CLIENT_SECRET),
    redirectUri: sanitize(env.AMAZON_ADS_REDIRECT_URI),
    tokenEncryptionKey: sanitize(env.AMAZON_ADS_TOKEN_ENCRYPTION_KEY),
    liveReadEnabled: parseEnabledFlag(env.AMAZON_ADS_LIVE_READ_ENABLED),
  };
  return config;
}

export function assertAmazonAdsLiveConnectionEnabled(source: NodeJS.ProcessEnv = process.env): AmazonAdsLiveConfig {
  const config = loadAmazonAdsLiveConfig(source);
  if (!config.liveReadEnabled) {
    throw new Error("FEATURE_DISABLED:Amazon Ads live read-only mode is disabled.");
  }
  const missing = getMissingAmazonAdsConfigKeys(source);
  if (missing.length > 0) {
    throw new Error(`CONFIG_MISSING:Missing required Amazon Ads configuration: ${missing.join(", ")}`);
  }
  return config;
}
