import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  FEATURE_FLAG_KEYS,
  resolveFeatureFlag,
  type FeatureFlagContext,
  type FeatureFlagKey,
  type FeatureFlagSnapshot,
} from "@/features/admin/feature-flag-rules";

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item)).filter(Boolean)
    : [];
}

function parseMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

type FeatureFlagRow = {
  id: string;
  key: string;
  display_name: string;
  description: string | null;
  enabled: boolean;
  rollout_percentage: number;
  allowed_account_types: unknown;
  allowed_plan_keys: unknown;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

export type FeatureFlagRecord = FeatureFlagSnapshot & {
  id: string;
  displayName: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

async function loadFeatureFlagRecord(
  key: FeatureFlagKey,
): Promise<FeatureFlagRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("feature_flags")
    .select(
      "id,key,display_name,description,enabled,rollout_percentage,allowed_account_types,allowed_plan_keys,metadata,created_at,updated_at",
    )
    .eq("key", key)
    .maybeSingle();

  if (error) {
    throw new Error(`FEATURE_FLAG_LOOKUP_FAILED:${error.message}`);
  }

  const row = data as FeatureFlagRow | null;
  if (!row?.id) return null;

  return {
    id: row.id,
    key: row.key as FeatureFlagKey,
    displayName: row.display_name,
    description: row.description || "",
    enabled: Boolean(row.enabled),
    rolloutPercentage: Number(row.rollout_percentage || 0),
    allowedAccountTypes: parseStringArray(row.allowed_account_types),
    allowedPlanKeys: parseStringArray(row.allowed_plan_keys),
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadFeatureFlagContext(
  accountId?: string | null,
): Promise<FeatureFlagContext> {
  if (!accountId) return {};

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspaces")
    .select(
      "id,account_type:account_types(key),plan:pricing_plans(key)",
    )
    .eq("id", accountId)
    .maybeSingle();

  if (error) {
    throw new Error(`FEATURE_FLAG_ACCOUNT_LOOKUP_FAILED:${error.message}`);
  }

  const workspace = data as {
    id: string;
    account_type?: { key?: string | null } | null;
    plan?: { key?: string | null } | null;
  } | null;

  return {
    accountId,
    accountTypeKey: workspace?.account_type?.key ?? null,
    planKey: workspace?.plan?.key ?? null,
  };
}

async function loadAccountOverride(
  accountId: string,
  featureFlagId: string,
): Promise<boolean | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_feature_flag_overrides")
    .select("enabled")
    .eq("account_id", accountId)
    .eq("feature_flag_id", featureFlagId)
    .maybeSingle();

  if (error) {
    throw new Error(`FEATURE_FLAG_OVERRIDE_LOOKUP_FAILED:${error.message}`);
  }

  return data ? Boolean((data as { enabled: boolean }).enabled) : null;
}

export async function listFeatureFlags(): Promise<FeatureFlagRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("feature_flags")
    .select(
      "id,key,display_name,description,enabled,rollout_percentage,allowed_account_types,allowed_plan_keys,metadata,created_at,updated_at",
    )
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error(`FEATURE_FLAG_LIST_FAILED:${error.message}`);
  }

  return ((data as FeatureFlagRow[] | null) || []).map((row) => ({
    id: row.id,
    key: row.key as FeatureFlagKey,
    displayName: row.display_name,
    description: row.description || "",
    enabled: Boolean(row.enabled),
    rolloutPercentage: Number(row.rollout_percentage || 0),
    allowedAccountTypes: parseStringArray(row.allowed_account_types),
    allowedPlanKeys: parseStringArray(row.allowed_plan_keys),
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getFeatureFlag(
  key: FeatureFlagKey,
  accountId?: string | null,
) {
  if (!FEATURE_FLAG_KEYS.includes(key)) {
    throw new Error("FEATURE_FLAG_INVALID:Unknown feature flag key.");
  }

  const feature = await loadFeatureFlagRecord(key);
  const context = await loadFeatureFlagContext(accountId);
  const accountOverride =
    feature?.id && accountId
      ? await loadAccountOverride(accountId, feature.id)
      : null;
  const resolved = resolveFeatureFlag(feature, {
    ...context,
    accountOverride,
  });

  return {
    feature,
    accountOverride,
    resolved,
  };
}

export async function isFeatureEnabled(
  key: FeatureFlagKey,
  accountId?: string | null,
) {
  const result = await getFeatureFlag(key, accountId);
  return result.resolved.enabled;
}

export async function enforceFeatureFlag(
  key: FeatureFlagKey,
  accountId?: string | null,
) {
  const result = await getFeatureFlag(key, accountId);
  if (!result.resolved.enabled) {
    throw new Error(`FEATURE_FLAG_DISABLED:${key}:${result.resolved.reason}`);
  }
}