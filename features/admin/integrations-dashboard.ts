import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { INTEGRATION_PROVIDER_REGISTRY, providerById, type IntegrationProviderId } from "@/features/integrations/core/registry";
import { loadPlatformIntegrationProviderOverview } from "@/features/integrations/core/diagnostics";

function providerLabel(provider: string): string {
  try {
    return providerById(provider as IntegrationProviderId).label;
  } catch {
    return provider;
  }
}

type ProviderSettingsRow = {
  provider: string;
  globally_enabled: boolean;
  oauth_enabled: boolean;
  publishing_enabled: boolean;
  analytics_enabled: boolean;
  webhooks_enabled: boolean;
  background_sync_enabled: boolean;
  maintenance_mode: boolean;
  updated_at: string;
};

type JobRow = {
  id: string;
  workspace_id: string;
  provider: string;
  job_type: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  last_error_code: string | null;
  updated_at: string;
};

type EventRow = {
  id: string;
  provider: string;
  severity: string;
  sanitized_message: string;
  created_at: string;
};

export async function loadAdminIntegrationsDashboard() {
  const admin = createAdminClient();

  const [overview, settingsResult, jobsResult, eventsResult] = await Promise.all([
    loadPlatformIntegrationProviderOverview(),
    admin
      .from("integration_provider_settings")
      .select("provider,globally_enabled,oauth_enabled,publishing_enabled,analytics_enabled,webhooks_enabled,background_sync_enabled,maintenance_mode,updated_at")
      .order("provider", { ascending: true }),
    admin
      .from("integration_jobs")
      .select("id,workspace_id,provider,job_type,status,attempt_count,max_attempts,last_error_code,updated_at")
      .order("updated_at", { ascending: false })
      .limit(40),
    admin
      .from("integration_events")
      .select("id,provider,severity,sanitized_message,created_at")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const settingsRows = (settingsResult.data as ProviderSettingsRow[] | null) || [];
  const settingsByProvider = new Map(settingsRows.map((row) => [row.provider, row]));

  const providers = INTEGRATION_PROVIDER_REGISTRY.map((provider) => {
    const setting = settingsByProvider.get(provider.id);
    const rollup = overview.find((item) => item.provider === provider.id);
    return {
      id: provider.id,
      label: provider.label,
      supportLevel: provider.supportLevel,
      readOnly: provider.readOnly,
      configuredConnections: rollup?.configuredConnections || 0,
      failedJobs: rollup?.failedJobs || 0,
      healthStatus: rollup?.status || "not_configured",
      healthMessage: rollup?.message || "No integration data available.",
      controls: {
        globallyEnabled: setting?.globally_enabled ?? false,
        oauthEnabled: setting?.oauth_enabled ?? false,
        publishingEnabled: setting?.publishing_enabled ?? false,
        analyticsEnabled: setting?.analytics_enabled ?? false,
        webhooksEnabled: setting?.webhooks_enabled ?? false,
        backgroundSyncEnabled: setting?.background_sync_enabled ?? false,
        maintenanceMode: setting?.maintenance_mode ?? false,
        updatedAt: setting?.updated_at || null,
      },
    };
  });

  const jobs = ((jobsResult.data as JobRow[] | null) || []).map((row) => {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      provider: providerLabel(row.provider || ""),
      jobType: row.job_type,
      status: row.status,
      attempts: `${row.attempt_count}/${row.max_attempts}`,
      errorCode: row.last_error_code || "-",
      updatedAt: row.updated_at,
      canRetry: row.status === "FAILED" || row.status === "DEAD_LETTER",
    };
  });

  const events = ((eventsResult.data as EventRow[] | null) || []).map((row) => {
    return {
      id: row.id,
      provider: providerLabel(row.provider || ""),
      severity: row.severity,
      message: row.sanitized_message,
      createdAt: row.created_at,
    };
  });

  return {
    providers,
    jobs,
    events,
    summary: {
      liveProviders: providers.filter((row) => row.supportLevel === "live").length,
      enabledProviders: providers.filter((row) => row.controls.globallyEnabled).length,
      criticalProviders: providers.filter((row) => row.healthStatus === "critical").length,
      warningProviders: providers.filter((row) => row.healthStatus === "warning").length,
    },
  };
}
