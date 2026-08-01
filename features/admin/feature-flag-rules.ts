export const FEATURE_FLAG_KEYS = [
  "ai_studio",
  "video_generation",
  "premium_video",
  "calendar",
  "advanced_analytics",
  "tiktok",
  "meta",
  "linkedin",
  "amazon_ads",
  "shopify",
  "media_library",
  "content_library",
  "client_workspaces",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export type FeatureFlagResolutionReason =
  | "EMERGENCY_DISABLED"
  | "ACCOUNT_OVERRIDE"
  | "ACCOUNT_TYPE_NOT_ALLOWED"
  | "PLAN_NOT_ALLOWED"
  | "ROLLOUT_DISABLED"
  | "GLOBALLY_DISABLED"
  | "ENABLED"
  | "MISSING_FLAG";

export type FeatureFlagSnapshot = {
  key: FeatureFlagKey;
  enabled: boolean;
  rolloutPercentage: number;
  allowedAccountTypes: string[];
  allowedPlanKeys: string[];
  metadata: Record<string, unknown>;
};

export type FeatureFlagContext = {
  accountId?: string | null;
  accountTypeKey?: string | null;
  planKey?: string | null;
  accountOverride?: boolean | null;
};

export function hashToRolloutBucket(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100;
  }
  return Math.abs(hash) % 100;
}

export function resolveFeatureFlag(
  snapshot: FeatureFlagSnapshot | null,
  context: FeatureFlagContext = {},
) {
  if (!snapshot) {
    return { enabled: false, reason: "MISSING_FLAG" as const };
  }

  if (snapshot.metadata.emergencyDisabled === true) {
    return { enabled: false, reason: "EMERGENCY_DISABLED" as const };
  }

  if (typeof context.accountOverride === "boolean") {
    return {
      enabled: context.accountOverride,
      reason: "ACCOUNT_OVERRIDE" as const,
    };
  }

  if (
    context.accountTypeKey &&
    snapshot.allowedAccountTypes.length > 0 &&
    !snapshot.allowedAccountTypes.includes(context.accountTypeKey)
  ) {
    return { enabled: false, reason: "ACCOUNT_TYPE_NOT_ALLOWED" as const };
  }

  if (
    context.planKey &&
    snapshot.allowedPlanKeys.length > 0 &&
    !snapshot.allowedPlanKeys.includes(context.planKey)
  ) {
    return { enabled: false, reason: "PLAN_NOT_ALLOWED" as const };
  }

  if (context.accountId) {
    const bucket = hashToRolloutBucket(`${snapshot.key}:${context.accountId}`);
    if (bucket >= snapshot.rolloutPercentage) {
      return { enabled: false, reason: "ROLLOUT_DISABLED" as const };
    }
  } else if (snapshot.rolloutPercentage <= 0) {
    return { enabled: false, reason: "ROLLOUT_DISABLED" as const };
  }

  if (!snapshot.enabled) {
    return { enabled: false, reason: "GLOBALLY_DISABLED" as const };
  }

  return { enabled: true, reason: "ENABLED" as const };
}