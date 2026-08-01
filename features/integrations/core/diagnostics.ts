import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { connectorRepository } from "@/features/platform/connectors/runtime/runtime";
import { INTEGRATION_PROVIDER_REGISTRY, type IntegrationProviderId } from "@/features/integrations/core/registry";
import {
  defaultDiagnosticsCard,
  normalizeConnectionState,
  type IntegrationCapabilityState,
  type IntegrationDiagnosticsCard,
} from "@/features/integrations/core/state";

type IntegrationProviderSettingsRow = {
  provider: string;
  globally_enabled: boolean;
  oauth_enabled: boolean;
  publishing_enabled: boolean;
  analytics_enabled: boolean;
  webhooks_enabled: boolean;
  background_sync_enabled: boolean;
  maintenance_mode: boolean;
  metadata: Record<string, unknown> | null;
};

type IntegrationConnectionRow = {
  provider: string;
  status: string;
  connected_at: string | null;
  last_successful_sync_at: string | null;
  last_health_check_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  scopes: string[] | null;
};

type JobFailureRow = {
  provider: string;
  last_error_code: string | null;
  last_error_message: string | null;
  updated_at: string;
};

function capabilityState(enabled: boolean, supported: boolean): IntegrationCapabilityState {
  if (!supported) return "unsupported";
  return enabled ? "enabled" : "disabled";
}

function sortProviders(cards: IntegrationDiagnosticsCard[]): IntegrationDiagnosticsCard[] {
  const rank = new Map<IntegrationDiagnosticsCard["state"], number>([
    ["error", 0],
    ["reconnect_required", 1],
    ["token_expired", 2],
    ["rate_limited", 3],
    ["degraded", 4],
    ["token_expiring", 5],
    ["connecting", 6],
    ["connected", 7],
    ["disconnected", 8],
    ["not_configured", 9],
  ]);
  return [...cards].sort((a, b) => {
    const ar = rank.get(a.state) ?? 99;
    const br = rank.get(b.state) ?? 99;
    if (ar !== br) return ar - br;
    return a.label.localeCompare(b.label);
  });
}

export async function loadWorkspaceIntegrationDiagnostics(workspaceId: string): Promise<IntegrationDiagnosticsCard[]> {
  const admin = createAdminClient();

  const [settingsResult, rowsResult, jobsResult] = await Promise.all([
    admin
      .from("integration_provider_settings")
      .select("provider,globally_enabled,oauth_enabled,publishing_enabled,analytics_enabled,webhooks_enabled,background_sync_enabled,maintenance_mode,metadata"),
    admin
      .from("integration_connections")
      .select("provider,status,connected_at,last_successful_sync_at,last_health_check_at,last_error_code,last_error_message,scopes")
      .eq("workspace_id", workspaceId),
    admin
      .from("integration_jobs")
      .select("provider,last_error_code,last_error_message,updated_at")
      .eq("workspace_id", workspaceId)
      .in("status", ["FAILED", "DEAD_LETTER"])
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);

  const settingsRows = (settingsResult.data as IntegrationProviderSettingsRow[] | null) || [];
  const settingsByProvider = new Map(settingsRows.map((row) => [row.provider, row]));

  const connectionRows = (rowsResult.data as IntegrationConnectionRow[] | null) || [];
  const connectionByProvider = new Map<string, IntegrationConnectionRow>();
  for (const row of connectionRows) {
    if (!connectionByProvider.has(row.provider)) {
      connectionByProvider.set(row.provider, row);
    }
  }

  const recentFailures = (jobsResult.data as JobFailureRow[] | null) || [];
  const failureByProvider = new Map<string, JobFailureRow>();
  for (const row of recentFailures) {
    if (!failureByProvider.has(row.provider)) {
      failureByProvider.set(row.provider, row);
    }
  }

  // Bridge existing Amazon Ads connection runtime while migration is rolling out.
  const amazonRuntimeConnection = (await connectorRepository
    .listConnections(workspaceId)
    .then((rows) => rows.find((row) => row.providerId === "amazon-ads-live"))) || null;

  // Bridge existing TikTok connection runtime while migration is rolling out.
  const tikTokLegacyConnection = await admin
    .from("tiktok_connections")
    .select("status,connected_at,refreshed_at,last_error,granted_scopes")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cards: IntegrationDiagnosticsCard[] = INTEGRATION_PROVIDER_REGISTRY.map((provider) => {
    const card = defaultDiagnosticsCard(provider);
    const setting = settingsByProvider.get(provider.id);

    if (setting) {
      card.capabilities.oauth = capabilityState(setting.oauth_enabled, provider.capabilities.includes("oauth"));
      card.capabilities.publishing = capabilityState(setting.publishing_enabled, provider.capabilities.includes("publishing"));
      card.capabilities.analytics = capabilityState(setting.analytics_enabled, provider.capabilities.includes("analytics"));
      card.capabilities.webhooks = capabilityState(setting.webhooks_enabled, provider.capabilities.includes("webhooks"));
      card.capabilities.background_sync = capabilityState(setting.background_sync_enabled, provider.capabilities.includes("background_sync"));
      card.capabilities.token_refresh = capabilityState(setting.oauth_enabled, provider.capabilities.includes("token_refresh"));
      if (!setting.globally_enabled) {
        card.reason = "Provider disabled by platform controls.";
      } else if (setting.maintenance_mode) {
        card.reason = "Provider temporarily paused for maintenance.";
      }
    }

    const connection = connectionByProvider.get(provider.id);
    if (connection) {
      card.state = normalizeConnectionState(connection.status);
      card.lastConnectedAt = connection.connected_at;
      card.lastHealthyAt = connection.last_health_check_at || connection.last_successful_sync_at;
      card.recentFailure = {
        code: connection.last_error_code,
        message: connection.last_error_message,
        at: connection.last_health_check_at || connection.last_successful_sync_at,
      };
      card.reason = connection.last_error_message || card.reason;
    }

    const failed = failureByProvider.get(provider.id);
    if (failed && (!card.recentFailure?.message || card.state === "connected")) {
      card.recentFailure = {
        code: failed.last_error_code,
        message: failed.last_error_message,
        at: failed.updated_at,
      };
      if (card.state === "connected") {
        card.state = "degraded";
      }
    }

    return card;
  });

  const tiktokCard = cards.find((card) => card.providerId === "tiktok");
  const legacyTikTok = tikTokLegacyConnection.data as {
    status?: string | null;
    connected_at?: string | null;
    refreshed_at?: string | null;
    last_error?: string | null;
    granted_scopes?: string[] | null;
  } | null;
  if (tiktokCard && legacyTikTok) {
    tiktokCard.state = normalizeConnectionState(legacyTikTok.status || "");
    tiktokCard.lastConnectedAt = legacyTikTok.connected_at || null;
    tiktokCard.lastHealthyAt = legacyTikTok.refreshed_at || tiktokCard.lastHealthyAt;
    tiktokCard.reason = legacyTikTok.last_error || tiktokCard.reason;
    const scopes = Array.isArray(legacyTikTok.granted_scopes)
      ? legacyTikTok.granted_scopes
      : [];
    tiktokCard.missingScopes = ["user.info.basic", "video.upload"].filter((scope) => !scopes.includes(scope));
  }

  const amazonCard = cards.find((card) => card.providerId === "amazon_ads");
  if (amazonCard && amazonRuntimeConnection) {
    amazonCard.state = normalizeConnectionState(amazonRuntimeConnection.status);
    amazonCard.lastConnectedAt = amazonRuntimeConnection.createdAt;
    amazonCard.lastHealthyAt = amazonRuntimeConnection.updatedAt;
    amazonCard.reason =
      amazonRuntimeConnection.status === "CONNECTED"
        ? "Live read-only connection available."
        : "Amazon Ads connection exists but is not ready.";
  }

  return sortProviders(cards);
}

export async function loadPlatformIntegrationProviderOverview(): Promise<{
  provider: IntegrationProviderId;
  configuredConnections: number;
  failedJobs: number;
  status: "healthy" | "warning" | "critical" | "not_configured";
  message: string;
}[]> {
  const admin = createAdminClient();

  const [connectionsResult, jobsResult] = await Promise.all([
    admin
      .from("integration_connections")
      .select("provider,status"),
    admin
      .from("integration_jobs")
      .select("provider,status")
      .in("status", ["FAILED", "DEAD_LETTER"]),
  ]);

  const connectionRows =
    (connectionsResult.data as Array<{ provider: string; status: string }> | null) || [];
  const failedRows = (jobsResult.data as Array<{ provider: string; status: string }> | null) || [];

  const connectionCounts = new Map<string, number>();
  const failedCounts = new Map<string, number>();

  for (const row of connectionRows) {
    connectionCounts.set(row.provider, (connectionCounts.get(row.provider) || 0) + 1);
  }
  for (const row of failedRows) {
    failedCounts.set(row.provider, (failedCounts.get(row.provider) || 0) + 1);
  }

  return INTEGRATION_PROVIDER_REGISTRY.map((provider) => {
    const configuredConnections = connectionCounts.get(provider.id) || 0;
    const failedJobs = failedCounts.get(provider.id) || 0;

    if (provider.supportLevel === "coming_soon") {
      return {
        provider: provider.id,
        configuredConnections,
        failedJobs,
        status: "not_configured" as const,
        message: "Coming soon. No production adapter is enabled.",
      };
    }

    if (failedJobs >= 5) {
      return {
        provider: provider.id,
        configuredConnections,
        failedJobs,
        status: "critical" as const,
        message: "Repeated failures detected in recent integration jobs.",
      };
    }

    if (failedJobs > 0) {
      return {
        provider: provider.id,
        configuredConnections,
        failedJobs,
        status: "warning" as const,
        message: "Recent provider failures need review.",
      };
    }

    if (configuredConnections === 0) {
      return {
        provider: provider.id,
        configuredConnections,
        failedJobs,
        status: "not_configured" as const,
        message: "No active connections recorded.",
      };
    }

    return {
      provider: provider.id,
      configuredConnections,
      failedJobs,
      status: "healthy" as const,
      message: "No recent provider failures.",
    };
  });
}
