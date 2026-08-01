import type { SupabaseClient } from "@supabase/supabase-js";

type ConnectionState =
  | "NOT_CONFIGURED"
  | "CONNECTING"
  | "CONNECTED"
  | "TOKEN_EXPIRING"
  | "TOKEN_EXPIRED"
  | "RECONNECT_REQUIRED"
  | "DEGRADED"
  | "RATE_LIMITED"
  | "ERROR"
  | "DISCONNECTED";

type SyncConnectionInput = {
  supabase: SupabaseClient;
  workspaceId: string;
  provider: string;
  externalAccountId?: string | null;
  accountName?: string | null;
  status: ConnectionState;
  scopes?: string[];
  tokenExpiresAt?: string | null;
  refreshExpiresAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  lastSuccessfulSyncAt?: string | null;
  lastHealthCheckAt?: string | null;
};

function ignoreCompatibilityError(message: string): boolean {
  return (
    message.includes("relation \"integration_connections\" does not exist") ||
    message.includes("column")
  );
}

export async function syncIntegrationConnection(input: SyncConnectionInput): Promise<void> {
  const externalAccountKey = String(input.externalAccountId || "").trim();
  const { error } = await input.supabase
    .from("integration_connections")
    .upsert(
      {
        workspace_id: input.workspaceId,
        provider: input.provider,
        external_account_id: input.externalAccountId || null,
        external_account_key: externalAccountKey,
        account_name: input.accountName || null,
        status: input.status,
        scopes: input.scopes || [],
        token_expires_at: input.tokenExpiresAt || null,
        refresh_expires_at: input.refreshExpiresAt || null,
        last_error_code: input.lastErrorCode || null,
        last_error_message: input.lastErrorMessage || null,
        connected_at: input.status === "CONNECTED" ? new Date().toISOString() : null,
        last_successful_sync_at: input.lastSuccessfulSyncAt || null,
        last_health_check_at: input.lastHealthCheckAt || null,
      } as never,
      { onConflict: "workspace_id,provider,external_account_key" },
    );

  if (error && !ignoreCompatibilityError(error.message)) {
    throw new Error(`INTEGRATION_CONNECTION_SYNC_FAILED:${error.message}`);
  }
}

export async function tryAcquireTokenRefreshLock(input: {
  supabase: SupabaseClient;
  workspaceId: string;
  provider: string;
  owner: string;
  ttlSeconds?: number;
}): Promise<boolean> {
  const ttlSeconds = Math.max(30, Math.min(600, input.ttlSeconds || 120));
  const now = new Date();
  const lockExpiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  const { data, error } = await input.supabase
    .from("integration_connections")
    .update(
      {
        refresh_lock_owner: input.owner,
        refresh_lock_expires_at: lockExpiresAt,
      } as never,
    )
    .eq("workspace_id", input.workspaceId)
    .eq("provider", input.provider)
    .or(`refresh_lock_expires_at.is.null,refresh_lock_expires_at.lte.${now.toISOString()}`)
    .select("id")
    .limit(1);

  if (error) {
    if (ignoreCompatibilityError(error.message)) return true;
    throw new Error(`INTEGRATION_LOCK_ACQUIRE_FAILED:${error.message}`);
  }

  return Array.isArray(data) && data.length > 0;
}

export async function releaseTokenRefreshLock(input: {
  supabase: SupabaseClient;
  workspaceId: string;
  provider: string;
  owner: string;
}): Promise<void> {
  const { error } = await input.supabase
    .from("integration_connections")
    .update(
      {
        refresh_lock_owner: null,
        refresh_lock_expires_at: null,
      } as never,
    )
    .eq("workspace_id", input.workspaceId)
    .eq("provider", input.provider)
    .eq("refresh_lock_owner", input.owner);

  if (error && !ignoreCompatibilityError(error.message)) {
    throw new Error(`INTEGRATION_LOCK_RELEASE_FAILED:${error.message}`);
  }
}
