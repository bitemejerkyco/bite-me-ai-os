import type { IntegrationProviderDefinition, IntegrationProviderId, IntegrationSupportLevel } from "@/features/integrations/core/registry";

export type IntegrationConnectionState =
  | "not_configured"
  | "connecting"
  | "connected"
  | "token_expiring"
  | "token_expired"
  | "reconnect_required"
  | "degraded"
  | "rate_limited"
  | "error"
  | "disconnected";

export type IntegrationCapabilityState = "enabled" | "disabled" | "unsupported";

export type IntegrationDiagnosticsCard = {
  providerId: IntegrationProviderId;
  label: string;
  supportLevel: IntegrationSupportLevel;
  readOnly: boolean;
  state: IntegrationConnectionState;
  reason: string;
  capabilities: Record<string, IntegrationCapabilityState>;
  lastConnectedAt: string | null;
  lastHealthyAt: string | null;
  missingScopes: string[];
  recentFailure: {
    code: string | null;
    message: string | null;
    at: string | null;
  } | null;
};

export function normalizeConnectionState(input: string | null | undefined): IntegrationConnectionState {
  const value = String(input || "").trim().toUpperCase();
  if (value === "CONNECTING") return "connecting";
  if (value === "CONNECTED") return "connected";
  if (value === "TOKEN_EXPIRING") return "token_expiring";
  if (value === "TOKEN_EXPIRED") return "token_expired";
  if (value === "RECONNECT_REQUIRED") return "reconnect_required";
  if (value === "DEGRADED") return "degraded";
  if (value === "RATE_LIMITED") return "rate_limited";
  if (value === "ERROR") return "error";
  if (value === "DISCONNECTED") return "disconnected";
  if (value === "EXPIRED") return "token_expired";
  if (value === "NOT_CONFIGURED") return "not_configured";
  return "not_configured";
}

export function defaultDiagnosticsCard(provider: IntegrationProviderDefinition): IntegrationDiagnosticsCard {
  return {
    providerId: provider.id,
    label: provider.label,
    supportLevel: provider.supportLevel,
    readOnly: provider.readOnly,
    state: provider.supportLevel === "coming_soon" ? "not_configured" : "disconnected",
    reason:
      provider.supportLevel === "coming_soon"
        ? "Coming soon. No production adapter is enabled."
        : "No active connection found.",
    capabilities: {
      oauth: provider.capabilities.includes("oauth") ? "enabled" : "unsupported",
      publishing: provider.capabilities.includes("publishing") ? "disabled" : "unsupported",
      analytics: provider.capabilities.includes("analytics") ? "disabled" : "unsupported",
      webhooks: provider.capabilities.includes("webhooks") ? "disabled" : "unsupported",
      background_sync: provider.capabilities.includes("background_sync") ? "disabled" : "unsupported",
      token_refresh: provider.capabilities.includes("token_refresh") ? "disabled" : "unsupported",
    },
    lastConnectedAt: null,
    lastHealthyAt: null,
    missingScopes: [],
    recentFailure: null,
  };
}
