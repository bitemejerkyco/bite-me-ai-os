import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type SettingRow = {
  key: string;
  value: unknown;
};

type WorkspaceRow = {
  id: string;
  name: string;
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
};

type ConnectionRow = {
  id: string;
  workspace_id: string;
  connected_by: string;
  status: string;
  tiktok_open_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  scopes: string[];
  last_error: string | null;
  refreshed_at: string | null;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  updated_at: string;
};

type PublishJobRow = {
  id: string;
  workspace_id: string;
  created_by: string | null;
  connection_id: string;
  media_asset_id: string | null;
  publish_mode: string;
  status: string;
  error_code: string | null;
  error_message: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
};

type AllowlistRow = {
  id: string;
  workspace_id?: string | null;
  user_id?: string | null;
  reason: string | null;
  created_at: string;
};

type MediaAssetRow = {
  id: string;
  file_name: string;
};

function valueByKey(settings: SettingRow[], key: string, fallback = ""): string {
  const row = settings.find((item) => item.key === key);
  return typeof row?.value === "string" ? row.value : fallback;
}

function countBy<T>(items: T[], selector: (item: T) => string): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = selector(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
}

function averageDurationSeconds(items: PublishJobRow[]): number {
  const durations = items
    .filter((row) => row.submitted_at && row.completed_at)
    .map((row) => (new Date(row.completed_at!).getTime() - new Date(row.submitted_at!).getTime()) / 1000)
    .filter((duration) => Number.isFinite(duration) && duration >= 0);
  if (!durations.length) return 0;
  return Number((durations.reduce((sum, item) => sum + item, 0) / durations.length).toFixed(1));
}

export async function loadAdminTikTokDashboard() {
  const admin = createAdminClient();
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const [
    settingsResult,
    workspacesResult,
    profilesResult,
    usersResult,
    connectionsResult,
    jobsResult,
    workspaceAllowlistResult,
    userAllowlistResult,
    mediaAssetsResult,
  ] = await Promise.all([
    admin
      .from("system_settings")
      .select("key,value")
      .in(
        "key",
        [
          "tiktok_content_posting_mode",
          "tiktok_webhooks_enabled",
          "tiktok_media_base_url",
          "tiktok_verified_url_prefix",
          "tiktok_beta_emergency_disabled",
          "tiktok_daily_upload_limit_per_workspace",
          "tiktok_max_pending_jobs_per_user",
          "tiktok_beta_start_at",
          "tiktok_beta_end_at",
        ],
      ),
    admin.from("workspaces").select("id,name"),
    admin.from("profiles").select("user_id,full_name"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin
      .from("tiktok_connections")
      .select("id,workspace_id,connected_by,status,tiktok_open_id,display_name,avatar_url,scopes,last_error,refreshed_at,access_token_expires_at,refresh_token_expires_at,updated_at"),
    admin
      .from("tiktok_publish_jobs")
      .select("id,workspace_id,created_by,connection_id,media_asset_id,publish_mode,status,error_code,error_message,submitted_at,completed_at,failed_at,created_at,updated_at"),
    admin
      .from("tiktok_beta_allowed_workspaces")
      .select("id,workspace_id,reason,created_at"),
    admin
      .from("tiktok_beta_allowed_users")
      .select("id,user_id,reason,created_at"),
    admin.from("media_assets").select("id,file_name"),
  ]);

  for (const result of [settingsResult, workspacesResult, profilesResult, connectionsResult, jobsResult, workspaceAllowlistResult, userAllowlistResult, mediaAssetsResult]) {
    if (result.error) {
      throw new Error(`TIKTOK_ADMIN_DASHBOARD_FAILED:${result.error.message}`);
    }
  }
  if (usersResult.error) {
    throw new Error(`TIKTOK_ADMIN_DASHBOARD_USERS_FAILED:${usersResult.error.message}`);
  }

  const settings = (settingsResult.data as SettingRow[] | null) || [];
  const workspaces = (workspacesResult.data as WorkspaceRow[] | null) || [];
  const profiles = (profilesResult.data as ProfileRow[] | null) || [];
  const connections = (connectionsResult.data as ConnectionRow[] | null) || [];
  const publishJobs = (jobsResult.data as PublishJobRow[] | null) || [];
  const workspaceAllowlist = (workspaceAllowlistResult.data as AllowlistRow[] | null) || [];
  const userAllowlist = (userAllowlistResult.data as AllowlistRow[] | null) || [];
  const mediaAssets = new Map(((mediaAssetsResult.data as MediaAssetRow[] | null) || []).map((row) => [row.id, row]));
  const workspaceNames = new Map(workspaces.map((row) => [row.id, row.name]));
  const userNames = new Map(
    [
      ...profiles.map((row) => [row.user_id, row.full_name || row.user_id] as const),
      ...((usersResult.data?.users || []).map((user) => [user.id, user.email || user.id] as const)),
    ],
  );

  const mode = valueByKey(settings, "tiktok_content_posting_mode", "beta_upload");
  const emergencyDisabled = valueByKey(settings, "tiktok_beta_emergency_disabled", "false") === "true";
  const verifiedUrlPrefix = valueByKey(settings, "tiktok_verified_url_prefix", "");
  const mediaBaseUrl = valueByKey(settings, "tiktok_media_base_url", "");
  const verifiedMediaReady = Boolean(verifiedUrlPrefix && verifiedUrlPrefix.startsWith("https://"));
  const dailyLimit = Number(valueByKey(settings, "tiktok_daily_upload_limit_per_workspace", "5"));
  const pendingLimit = Number(valueByKey(settings, "tiktok_max_pending_jobs_per_user", "5"));

  const uploadsToday = publishJobs.filter((row) => Boolean(row.submitted_at && new Date(row.submitted_at).getTime() >= dayStart.getTime())).length;
  const pendingJobs = publishJobs.filter((row) => ["draft", "validating", "initializing", "uploading", "processing", "reconnect_required"].includes(row.status)).length;
  const inboxDeliveries = publishJobs.filter((row) => row.status === "inbox_delivered").length;
  const failedJobs = publishJobs.filter((row) => row.status === "failed").length;
  const reconnectRequiredAccounts = connections.filter((row) => row.status === "RECONNECT_REQUIRED").length;
  const activeBetaAccounts = workspaceAllowlist.length + userAllowlist.length;
  const connectedAccounts = connections.filter((row) => row.status === "CONNECTED").length;
  const averageProcessingTimeSeconds = averageDurationSeconds(publishJobs);
  const topFailureReasons = countBy(
    publishJobs.filter((row) => row.status === "failed"),
    (row) => row.error_code || row.error_message || "unknown",
  );

  const betaAccounts = [
    ...workspaceAllowlist.map((row) => ({
      id: row.id,
      scope: "workspace" as const,
      workspace: row.workspace_id ? workspaceNames.get(row.workspace_id) || row.workspace_id : null,
      user: null,
      allowed: true,
      dailyLimit,
      pendingLimit,
      startDate: valueByKey(settings, "tiktok_beta_start_at", "") || null,
      endDate: valueByKey(settings, "tiktok_beta_end_at", "") || null,
      reason: row.reason,
    })),
    ...userAllowlist.map((row) => ({
      id: row.id,
      scope: "user" as const,
      workspace: null,
      user: row.user_id ? userNames.get(row.user_id) || row.user_id : null,
      allowed: true,
      dailyLimit,
      pendingLimit,
      startDate: valueByKey(settings, "tiktok_beta_start_at", "") || null,
      endDate: valueByKey(settings, "tiktok_beta_end_at", "") || null,
      reason: row.reason,
    })),
  ];

  const connectionsTable = connections.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    workspace: row.workspace_id ? workspaceNames.get(row.workspace_id) || row.workspace_id : row.workspace_id,
    user: row.connected_by ? userNames.get(row.connected_by) || row.connected_by : null,
    tikTokIdentity: row.display_name || row.tiktok_open_id || "Unknown",
    scopes: row.scopes || [],
    status: row.status,
    lastRefreshed: row.refreshed_at || row.updated_at,
    reconnectRequired: row.status === "RECONNECT_REQUIRED",
    avatarUrl: row.avatar_url,
  }));

  const jobsTable = publishJobs.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    workspace: workspaceNames.get(row.workspace_id) || row.workspace_id,
    user: row.created_by ? userNames.get(row.created_by) || row.created_by : null,
    mode: row.publish_mode,
    status: row.status,
    mediaAsset: row.media_asset_id ? mediaAssets.get(row.media_asset_id)?.file_name || row.media_asset_id : null,
    errorCode: row.error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return {
    mode,
    emergencyDisabled,
    verifiedMediaReady,
    mediaBaseUrl,
    verifiedUrlPrefix,
    connectedAccounts,
    activeBetaAccounts,
    uploadsToday,
    pendingJobs,
    inboxDeliveries,
    failedJobs,
    reconnectRequiredAccounts,
    averageProcessingTimeSeconds,
    topFailureReasons,
    dailyLimit,
    pendingLimit,
    betaAccounts,
    workspaceOptions: workspaces.map((row) => ({ value: row.id, label: row.name })),
    userOptions: [...new Map(
      usersResult.data.users.map((user) => [user.id, user.email || user.id] as const),
    ).entries()].map(([value, label]) => ({ value, label })),
    connectionsTable,
    jobsTable,
  };
}