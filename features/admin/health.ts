import "server-only";

import { performance } from "node:perf_hooks";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sanitizeHealthMetadata,
  summarizeOverallHealth,
  type HealthStatus,
  type ServiceHealthCheck,
} from "@/features/admin/health-rules";
import { loadPlatformIntegrationProviderOverview } from "@/features/integrations/core/diagnostics";

type ScheduledPostStatusRow = {
  id: string;
  status: string;
};

async function timedCheck<T>(
  operation: () => Promise<T>,
): Promise<{ result: T; latencyMs: number }> {
  const start = performance.now();
  const result = await operation();
  return {
    result,
    latencyMs: Math.round(performance.now() - start),
  };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = 4000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

function configuredButUnavailable(
  key: string,
  displayName: string,
  message: string,
): ServiceHealthCheck {
  return {
    key,
    displayName,
    status: "unavailable",
    message,
    checkedAt: new Date().toISOString(),
    latencyMs: null,
    metadata: {},
    source: "configuration",
  };
}

function notConfigured(
  key: string,
  displayName: string,
  message = "Not configured.",
): ServiceHealthCheck {
  return {
    key,
    displayName,
    status: "not_configured",
    message,
    checkedAt: new Date().toISOString(),
    latencyMs: null,
    metadata: {},
    source: "configuration",
  };
}

export async function loadPlatformHealth(): Promise<{
  overallStatus: HealthStatus;
  checks: ServiceHealthCheck[];
}> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const checks: ServiceHealthCheck[] = [];

  try {
    const { latencyMs } = await timedCheck(async () =>
      admin.from("workspaces").select("id", { head: true, count: "exact" }).limit(1),
    );
    checks.push({
      key: "supabase_database",
      displayName: "Supabase Database",
      status: "healthy",
      message: "Database query completed successfully.",
      checkedAt: now,
      latencyMs,
      metadata: {},
      source: "supabase",
    });
  } catch (error) {
    checks.push({
      key: "supabase_database",
      displayName: "Supabase Database",
      status: "critical",
      message: "Database query failed.",
      checkedAt: now,
      latencyMs: null,
      metadata: sanitizeHealthMetadata({ error: String(error) }),
      source: "supabase",
    });
  }

  try {
    const { result, latencyMs } = await timedCheck(async () =>
      admin.auth.admin.listUsers({ page: 1, perPage: 1 }),
    );
    if (result.error) throw result.error;
    checks.push({
      key: "supabase_auth",
      displayName: "Supabase Auth",
      status: "healthy",
      message: "Auth admin user lookup succeeded.",
      checkedAt: now,
      latencyMs,
      metadata: { pageSize: 1 },
      source: "supabase",
    });
  } catch (error) {
    checks.push({
      key: "supabase_auth",
      displayName: "Supabase Auth",
      status: "critical",
      message: "Auth health check failed.",
      checkedAt: now,
      latencyMs: null,
      metadata: sanitizeHealthMetadata({ error: String(error) }),
      source: "supabase",
    });
  }

  try {
    const { result, latencyMs } = await timedCheck(async () =>
      admin.storage.listBuckets(),
    );
    if (result.error) throw result.error;
    checks.push({
      key: "supabase_storage",
      displayName: "Supabase Storage",
      status: "healthy",
      message: "Storage bucket listing succeeded.",
      checkedAt: now,
      latencyMs,
      metadata: { bucketCount: result.data?.length || 0 },
      source: "supabase",
    });
  } catch (error) {
    checks.push({
      key: "supabase_storage",
      displayName: "Supabase Storage",
      status: "warning",
      message: "Storage health check failed.",
      checkedAt: now,
      latencyMs: null,
      metadata: sanitizeHealthMetadata({ error: String(error) }),
      source: "supabase",
    });
  }

  try {
    const { result, latencyMs } = await timedCheck(async () =>
      admin
        .from("scheduled_posts")
        .select("id,status", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(5),
    );
    if (result.error) throw result.error;
    const scheduledPosts =
      (result.data as ScheduledPostStatusRow[] | null) || [];
    const failed = scheduledPosts.filter((row) => row.status === "FAILED").length;
    checks.push({
      key: "scheduled_posts",
      displayName: "Scheduled Posts",
      status: failed > 0 ? "warning" : "healthy",
      message:
        failed > 0
          ? `${failed} recent scheduled posts failed.`
          : "Recent scheduled-post lookup succeeded.",
      checkedAt: now,
      latencyMs,
      metadata: { recentFailures: failed },
      source: "supabase",
    });
  } catch (error) {
    checks.push({
      key: "scheduled_posts",
      displayName: "Scheduled Posts",
      status: "warning",
      message: "Scheduled post health check failed.",
      checkedAt: now,
      latencyMs: null,
      metadata: sanitizeHealthMetadata({ error: String(error) }),
      source: "supabase",
    });
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const start = performance.now();
      const response = await fetchWithTimeout(
        "https://api.openai.com/v1/models",
        {
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        },
      );
      const latencyMs = Math.round(performance.now() - start);
      checks.push({
        key: "openai",
        displayName: "OpenAI",
        status: response.ok ? "healthy" : "warning",
        message: response.ok
          ? "Model-list check succeeded."
          : `OpenAI responded with status ${response.status}.`,
        checkedAt: now,
        latencyMs,
        metadata: { httpStatus: response.status },
        source: "openai",
      });
    } catch (error) {
      checks.push({
        key: "openai",
        displayName: "OpenAI",
        status: "warning",
        message: "OpenAI health check failed.",
        checkedAt: now,
        latencyMs: null,
        metadata: sanitizeHealthMetadata({ error: String(error) }),
        source: "openai",
      });
    }
  } else {
    checks.push(notConfigured("openai", "OpenAI"));
  }

  checks.push(configuredButUnavailable("background_jobs", "Background Jobs", "No health source for background jobs."));
  checks.push(configuredButUnavailable("video_provider_router", "Video Provider Router", "No lightweight health source for the provider router."));
  checks.push(process.env.KLING_API_KEY ? configuredButUnavailable("kling", "Kling", "Configured, but no safe lightweight check is implemented.") : notConfigured("kling", "Kling"));
  checks.push(process.env.RUNWAY_API_KEY ? configuredButUnavailable("runway", "Runway", "Configured, but no safe lightweight check is implemented.") : notConfigured("runway", "Runway"));
  checks.push(process.env.VEO_API_KEY ? configuredButUnavailable("veo", "Veo", "Configured, but no safe lightweight check is implemented.") : notConfigured("veo", "Veo"));
  try {
    const providers = await loadPlatformIntegrationProviderOverview();
    for (const provider of providers) {
      checks.push({
        key: `integration_${provider.provider}`,
        displayName: `Integration: ${provider.provider}`,
        status:
          provider.status === "healthy"
            ? "healthy"
            : provider.status === "critical"
              ? "critical"
              : provider.status === "warning"
                ? "warning"
                : "not_configured",
        message: `${provider.message} Connections: ${provider.configuredConnections}. Failed jobs: ${provider.failedJobs}.`,
        checkedAt: now,
        latencyMs: null,
        metadata: {
          configuredConnections: provider.configuredConnections,
          failedJobs: provider.failedJobs,
        },
        source: "supabase",
      });
    }
  } catch (error) {
    checks.push({
      key: "integrations",
      displayName: "Integrations",
      status: "warning",
      message: "Integration health rollup is unavailable.",
      checkedAt: now,
      latencyMs: null,
      metadata: sanitizeHealthMetadata({ error: String(error) }),
      source: "supabase",
    });
  }

  checks.push(process.env.STRIPE_SECRET_KEY ? configuredButUnavailable("stripe", "Stripe", "Configured, but checkout synchronization is still deferred.") : notConfigured("stripe", "Stripe"));
  checks.push(configuredButUnavailable("webhooks", "Webhooks", "No webhook heartbeat source is implemented."));

  return {
    overallStatus: summarizeOverallHealth(checks),
    checks,
  };
}

export { sanitizeHealthMetadata, summarizeOverallHealth };