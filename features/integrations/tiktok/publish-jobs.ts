import type { createClient } from "@/lib/supabase/server";
import { TikTokApiClient } from "@/features/integrations/tiktok/client";
import { getTikTokBetaAccessSnapshot, getTikTokDailyUploadLimit, getTikTokPendingJobLimit, getTikTokPendingJobs, getTikTokUploadsToday } from "@/features/integrations/tiktok/beta";
import { loadTikTokConfig, type TikTokConfig } from "@/features/integrations/tiktok/config";
import { mapTikTokError } from "@/features/integrations/tiktok/errors";
import { TikTokConnectionService } from "@/features/integrations/tiktok/service";
import { encryptTikTokToken } from "@/features/integrations/tiktok/token-crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type TikTokActor = {
  supabase: SupabaseServerClient;
  userId: string;
  workspaceId: string;
};

type TikTokConnectionRow = {
  id: string;
  workspace_id: string;
  connected_by: string;
  status: string;
  scopes: string[];
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  access_expires_at: string;
  refresh_expires_at: string;
  encrypted_access_token?: string | null;
  encrypted_refresh_token?: string | null;
  granted_scopes?: string[] | null;
  tiktok_open_id?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  creator_username?: string | null;
  creator_nickname?: string | null;
  creator_avatar_url?: string | null;
  privacy_level_options?: string[] | null;
  comment_disabled?: boolean | null;
  duet_disabled?: boolean | null;
  stitch_disabled?: boolean | null;
  max_video_duration_seconds?: number | null;
  last_error?: string | null;
  refreshed_at?: string | null;
  revoked_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

type TikTokMediaAssetRow = {
  id: string;
  workspace_id: string;
  uploaded_by: string;
  storage_path: string | null;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
  tags: string[];
  created_at: string;
};

type TikTokPublishJobRow = {
  id: string;
  workspace_id: string;
  created_by: string | null;
  connection_id: string;
  media_asset_id: string | null;
  publish_mode: "beta_upload" | "direct_post";
  publish_id: string | null;
  status:
    | "draft"
    | "validating"
    | "initializing"
    | "uploading"
    | "processing"
    | "inbox_delivered"
    | "published"
    | "failed"
    | "cancelled"
    | "reconnect_required";
  caption: string | null;
  privacy_level: string | null;
  disable_comment: boolean;
  disable_duet: boolean;
  disable_stitch: boolean;
  commercial_content_disclosure: boolean;
  branded_content_toggle: boolean;
  source_type: string;
  source_url: string | null;
  error_code: string | null;
  error_message: string | null;
  uploaded_bytes: number | null;
  publicly_available_post_ids: unknown;
  consented_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type TikTokPublishFilters = {
  status?: string | null;
  limit?: number;
};

type CreateTikTokPublishJobInput = {
  mediaAssetId: string;
  caption: string;
  hashtags: string[];
  consent: boolean;
};

export type SafeTikTokPublishJob = {
  id: string;
  workspaceId: string;
  connectionId: string;
  mediaAssetId: string | null;
  publishMode: string;
  publishId: string | null;
  status: TikTokPublishJobRow["status"];
  caption: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  consentedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  progress: number;
  reconnectRequired: boolean;
  retryable: boolean;
  message: string;
  createdAt: string;
  updatedAt: string;
  mediaAsset: {
    id: string;
    name: string;
    mimeType: string | null;
    sizeBytes: number;
  } | null;
};

const ACTIVE_JOB_STATUSES = new Set([
  "draft",
  "validating",
  "initializing",
  "uploading",
  "processing",
  "reconnect_required",
]);

const TERMINAL_JOB_STATUSES = new Set([
  "inbox_delivered",
  "published",
  "failed",
  "cancelled",
]);

function progressForStatus(status: TikTokPublishJobRow["status"]): number {
  switch (status) {
    case "draft":
      return 5;
    case "validating":
      return 15;
    case "initializing":
      return 35;
    case "uploading":
      return 55;
    case "processing":
      return 75;
    case "inbox_delivered":
    case "published":
      return 100;
    case "failed":
    case "cancelled":
    case "reconnect_required":
      return 100;
    default:
      return 0;
  }
}

function buildCaption(caption: string, hashtags: string[]): string {
  const trimmedCaption = caption.trim();
  const normalizedTags = Array.from(
    new Set(
      hashtags
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean)
        .slice(0, 8),
    ),
  ).map((tag) => `#${tag}`);
  return [trimmedCaption, normalizedTags.join(" ")].filter(Boolean).join(" ").trim();
}

function safeMessageFromError(error: unknown): string {
  const mapped = mapTikTokError(error);
  return mapped.message;
}

function mapJobRow(row: TikTokPublishJobRow, mediaAsset?: TikTokMediaAssetRow | null): SafeTikTokPublishJob {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    connectionId: row.connection_id,
    mediaAssetId: row.media_asset_id,
    publishMode: row.publish_mode,
    publishId: row.publish_id,
    status: row.status,
    caption: row.caption,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    consentedAt: row.consented_at,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    progress: progressForStatus(row.status),
    reconnectRequired: row.status === "reconnect_required",
    retryable: ["failed", "reconnect_required"].includes(row.status) && !row.completed_at,
    message:
      row.error_message ||
      (row.status === "inbox_delivered"
        ? "TikTok confirmed delivery to the inbox or drafts flow."
        : row.status === "processing"
          ? "TikTok is still processing the upload."
          : row.status === "reconnect_required"
            ? "Reconnect TikTok to continue."
            : row.status === "failed"
              ? "TikTok upload failed."
              : row.status === "cancelled"
                ? "Upload was cancelled locally."
                : "Upload is in progress."),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mediaAsset: mediaAsset
      ? {
          id: mediaAsset.id,
          name: mediaAsset.file_name,
          mimeType: mediaAsset.mime_type,
          sizeBytes: mediaAsset.size_bytes,
        }
      : null,
  };
}

async function getConnection(actor: TikTokActor): Promise<TikTokConnectionRow> {
  const { data, error } = await actor.supabase
    .from("tiktok_connections")
    .select(
      "id,workspace_id,connected_by,status,scopes,access_token_ciphertext,refresh_token_ciphertext,access_expires_at,refresh_expires_at,encrypted_access_token,encrypted_refresh_token,granted_scopes,tiktok_open_id,display_name,avatar_url,creator_username,creator_nickname,creator_avatar_url,privacy_level_options,comment_disabled,duet_disabled,stitch_disabled,max_video_duration_seconds,last_error,refreshed_at,revoked_at,metadata",
    )
    .eq("workspace_id", actor.workspaceId)
    .maybeSingle();
  if (error) throw new Error(`TIKTOK_CONNECTION_LOOKUP_FAILED:${error.message}`);
  if (!data) {
    throw new Error("TIKTOK_CONNECTION_REQUIRED:Connect TikTok before uploading.");
  }
  const row = data as TikTokConnectionRow;
  if (row.status !== "CONNECTED") {
    throw new Error("TIKTOK_CONNECTION_REQUIRED:Connect TikTok before uploading.");
  }
  if (!Array.isArray(row.scopes) || !row.scopes.includes("video.upload")) {
    throw new Error("TIKTOK_SCOPE_MISSING:video.upload is required.");
  }
  return row;
}

async function getMediaAsset(actor: TikTokActor, mediaAssetId: string): Promise<TikTokMediaAssetRow> {
  const { data, error } = await actor.supabase
    .from("media_assets")
    .select("id,workspace_id,uploaded_by,storage_path,file_name,mime_type,size_bytes,tags,created_at")
    .eq("workspace_id", actor.workspaceId)
    .eq("id", mediaAssetId)
    .maybeSingle();
  if (error) throw new Error(`TIKTOK_MEDIA_LOOKUP_FAILED:${error.message}`);
  if (!data) {
    throw new Error("TIKTOK_MEDIA_INVALID:Choose a completed video from the Media Library.");
  }
  const row = data as TikTokMediaAssetRow;
  if (!row.storage_path) {
    throw new Error("TIKTOK_MEDIA_INVALID:A stored video file is required.");
  }
  if (!String(row.mime_type || "").startsWith("video/")) {
    throw new Error("TIKTOK_MEDIA_INVALID:Unsupported media type for TikTok upload.");
  }
  return row;
}

async function getJobRow(actor: TikTokActor, jobId: string): Promise<TikTokPublishJobRow> {
  const { data, error } = await actor.supabase
    .from("tiktok_publish_jobs")
    .select(
      "id,workspace_id,created_by,connection_id,media_asset_id,publish_mode,publish_id,status,caption,privacy_level,disable_comment,disable_duet,disable_stitch,commercial_content_disclosure,branded_content_toggle,source_type,source_url,error_code,error_message,uploaded_bytes,publicly_available_post_ids,consented_at,submitted_at,completed_at,failed_at,metadata,created_at,updated_at",
    )
    .eq("workspace_id", actor.workspaceId)
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(`TIKTOK_JOB_LOOKUP_FAILED:${error.message}`);
  if (!data) throw new Error("TIKTOK_JOB_NOT_FOUND:Job was not found.");
  return data as TikTokPublishJobRow;
}

export class TikTokPublishJobService {
  private readonly config: TikTokConfig;
  private readonly client: TikTokApiClient;
  private readonly now: () => Date;
  private readonly connectionService: TikTokConnectionService;

  constructor(dependencies: { config?: TikTokConfig; client?: TikTokApiClient; now?: () => Date } = {}) {
    this.config = dependencies.config ?? loadTikTokConfig();
    this.client = dependencies.client ?? new TikTokApiClient(this.config);
    this.now = dependencies.now ?? (() => new Date());
    this.connectionService = new TikTokConnectionService({
      config: this.config,
      client: this.client,
      now: this.now,
    });
  }

  async createTikTokPublishJob(actor: TikTokActor, input: CreateTikTokPublishJobInput): Promise<SafeTikTokPublishJob> {
    const beta = await getTikTokBetaAccessSnapshot(actor.workspaceId, actor.userId);
    if (!beta.allowed) {
      throw new Error(`TIKTOK_BETA_DENIED:${beta.reason || "TikTok beta access is required."}`);
    }
    if (!input.consent) {
      throw new Error("TIKTOK_CONSENT_REQUIRED:Explicit consent is required before uploading.");
    }
    const connection = await getConnection(actor);
    const mediaAsset = await getMediaAsset(actor, input.mediaAssetId);
    const admin = createAdminClient();
    const { data: uploadSizeSetting, error: sizeSettingError } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", "maximum_upload_size_bytes")
      .maybeSingle();
    if (sizeSettingError) {
      throw new Error(`TIKTOK_UPLOAD_SIZE_LOOKUP_FAILED:${sizeSettingError.message}`);
    }
    const maximumUploadSizeBytes = Number(
      (uploadSizeSetting as { value?: unknown } | null)?.value ?? 0,
    );
    if (Number.isFinite(maximumUploadSizeBytes) && maximumUploadSizeBytes > 0 && mediaAsset.size_bytes > maximumUploadSizeBytes) {
      throw new Error("TIKTOK_MEDIA_INVALID:Selected video exceeds the allowed file size.");
    }
    const dailyLimit = await getTikTokDailyUploadLimit(actor.workspaceId);
    const pendingLimit = await getTikTokPendingJobLimit(actor.workspaceId);
    const uploadsToday = await getTikTokUploadsToday(actor.workspaceId, actor.userId);
    const pendingJobs = await getTikTokPendingJobs(actor.workspaceId, actor.userId);
    if (uploadsToday >= dailyLimit) {
      throw new Error("TIKTOK_DAILY_LIMIT_REACHED:Daily TikTok upload limit reached.");
    }
    if (pendingJobs >= pendingLimit) {
      throw new Error("TIKTOK_PENDING_LIMIT_REACHED:Too many TikTok jobs are already pending.");
    }
    const duplicate = await actor.supabase
      .from("tiktok_publish_jobs")
      .select("id")
      .eq("workspace_id", actor.workspaceId)
      .eq("connection_id", connection.id)
      .eq("media_asset_id", mediaAsset.id)
      .in("status", Array.from(ACTIVE_JOB_STATUSES))
      .maybeSingle();
    if (duplicate.error) {
      throw new Error(`TIKTOK_JOB_DUPLICATE_CHECK_FAILED:${duplicate.error.message}`);
    }
    if (duplicate.data) {
      throw new Error("TIKTOK_JOB_DUPLICATE:An active TikTok job already exists for this media asset.");
    }
    const caption = buildCaption(input.caption, input.hashtags);
    const consentedAt = this.now().toISOString();
    const { data, error } = await actor.supabase
      .from("tiktok_publish_jobs")
      .insert({
        workspace_id: actor.workspaceId,
        created_by: actor.userId,
        connection_id: connection.id,
        media_asset_id: mediaAsset.id,
        publish_mode: "beta_upload",
        status: "validating",
        caption,
        source_type: "PULL_FROM_URL",
        consented_at: consentedAt,
        metadata: {
          hashtags: input.hashtags,
          consentedBy: actor.userId,
          betaMode: beta.postingMode,
        },
      })
      .select("id,workspace_id,created_by,connection_id,media_asset_id,publish_mode,publish_id,status,caption,privacy_level,disable_comment,disable_duet,disable_stitch,commercial_content_disclosure,branded_content_toggle,source_type,source_url,error_code,error_message,uploaded_bytes,publicly_available_post_ids,consented_at,submitted_at,completed_at,failed_at,metadata,created_at,updated_at")
      .single();
    if (error) throw new Error(`TIKTOK_JOB_CREATE_FAILED:${error.message}`);
    return mapJobRow(data as TikTokPublishJobRow, mediaAsset);
  }

  async getTikTokPublishJob(jobId: string, workspaceId: string): Promise<SafeTikTokPublishJob> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("tiktok_publish_jobs")
      .select(
        "id,workspace_id,created_by,connection_id,media_asset_id,publish_mode,publish_id,status,caption,privacy_level,disable_comment,disable_duet,disable_stitch,commercial_content_disclosure,branded_content_toggle,source_type,source_url,error_code,error_message,uploaded_bytes,publicly_available_post_ids,consented_at,submitted_at,completed_at,failed_at,metadata,created_at,updated_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw new Error(`TIKTOK_JOB_LOOKUP_FAILED:${error.message}`);
    if (!data) throw new Error("TIKTOK_JOB_NOT_FOUND:Job was not found.");
    const row = data as TikTokPublishJobRow;
    const mediaAsset = row.media_asset_id
      ? ((await admin
          .from("media_assets")
          .select("id,workspace_id,uploaded_by,storage_path,file_name,mime_type,size_bytes,tags,created_at")
          .eq("workspace_id", workspaceId)
          .eq("id", row.media_asset_id)
          .maybeSingle()).data as TikTokMediaAssetRow | null)
      : null;
    return mapJobRow(row, mediaAsset);
  }

  async listTikTokPublishJobs(workspaceId: string, filters: TikTokPublishFilters = {}): Promise<SafeTikTokPublishJob[]> {
    const admin = createAdminClient();
    const query = admin
      .from("tiktok_publish_jobs")
      .select(
        "id,workspace_id,created_by,connection_id,media_asset_id,publish_mode,publish_id,status,caption,privacy_level,disable_comment,disable_duet,disable_stitch,commercial_content_disclosure,branded_content_toggle,source_type,source_url,error_code,error_message,uploaded_bytes,publicly_available_post_ids,consented_at,submitted_at,completed_at,failed_at,metadata,created_at,updated_at",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(filters.limit || 20, 50)));
    if (filters.status) {
      query.eq("status", filters.status);
    }
    const { data, error } = await query;
    if (error) throw new Error(`TIKTOK_JOB_LIST_FAILED:${error.message}`);
    return (data as TikTokPublishJobRow[] | null || []).map((row) => mapJobRow(row));
  }

  async initializeTikTokInboxUpload(actor: TikTokActor, jobId: string): Promise<SafeTikTokPublishJob> {
    const job = await getJobRow(actor, jobId);
    if (!job.media_asset_id) {
      throw new Error("TIKTOK_JOB_INVALID:Missing media asset.");
    }
    if (job.status === "cancelled" || job.status === "failed" || job.status === "inbox_delivered") {
      return mapJobRow(job, await getMediaAsset(actor, job.media_asset_id));
    }
    const mediaAsset = await getMediaAsset(actor, job.media_asset_id);
    const mediaBase = this.config.mediaBaseUrl || this.config.redirectUri;
    const uploadBase = new URL("/api/integrations/tiktok/media", mediaBase);
    const signed = await actor.supabase.storage.from("brand-media").createSignedUrl(String(mediaAsset.storage_path), 60 * 60);
    if (signed.error || !signed.data?.signedUrl) {
      throw new Error(`TIKTOK_MEDIA_FAILED:${signed.error?.message || "Unable to sign the video asset."}`);
    }
    const mediaToken = encryptTikTokToken(
      JSON.stringify({ url: signed.data.signedUrl, expiresAt: this.now().getTime() + 60 * 60 * 1000 }),
      this.config.encryptionKey,
    );
    const mediaUrl = new URL(uploadBase.toString());
    mediaUrl.searchParams.set("token", mediaToken);
    if (this.config.verifiedUrlPrefix && !mediaUrl.toString().startsWith(this.config.verifiedUrlPrefix)) {
      throw new Error("TIKTOK_MEDIA_INVALID:TikTok media delivery is not configured with a verified URL prefix.");
    }
    const accessToken = await this.connectionService.getValidAccessToken(actor);
    const { error: initError } = await actor.supabase
      .from("tiktok_publish_jobs")
      .update({ status: "initializing" })
      .eq("workspace_id", actor.workspaceId)
      .eq("id", jobId);
    if (initError) throw new Error(`TIKTOK_JOB_UPDATE_FAILED:${initError.message}`);
    try {
      const publishId = await this.client.initializeInboxVideoFromUrl(accessToken, mediaUrl.toString());
      const now = this.now().toISOString();
      const { data, error } = await actor.supabase
        .from("tiktok_publish_jobs")
        .update({
          publish_id: publishId,
          source_url: mediaUrl.toString(),
          uploaded_bytes: mediaAsset.size_bytes,
          submitted_at: now,
          status: "processing",
          error_code: null,
          error_message: null,
          metadata: {
            mediaPath: mediaAsset.storage_path,
            mediaName: mediaAsset.file_name,
          },
        })
        .eq("workspace_id", actor.workspaceId)
        .eq("id", jobId)
        .select("id,workspace_id,created_by,connection_id,media_asset_id,publish_mode,publish_id,status,caption,privacy_level,disable_comment,disable_duet,disable_stitch,commercial_content_disclosure,branded_content_toggle,source_type,source_url,error_code,error_message,uploaded_bytes,publicly_available_post_ids,consented_at,submitted_at,completed_at,failed_at,metadata,created_at,updated_at")
        .single();
      if (error) throw new Error(`TIKTOK_JOB_UPDATE_FAILED:${error.message}`);
      return mapJobRow(data as TikTokPublishJobRow, mediaAsset);
    } catch (error) {
      const mapped = mapTikTokError(error);
      const { error: updateError } = await actor.supabase
        .from("tiktok_publish_jobs")
        .update({
          status: mapped.reconnectRequired ? "reconnect_required" : "failed",
          error_code: mapped.internalErrorCode,
          error_message: mapped.message,
          failed_at: this.now().toISOString(),
        })
        .eq("workspace_id", actor.workspaceId)
        .eq("id", jobId);
      if (updateError) {
        throw new Error(`TIKTOK_JOB_UPDATE_FAILED:${updateError.message}`);
      }
      throw new Error(mapped.message);
    }
  }

  async refreshTikTokPublishStatus(actor: TikTokActor, jobId: string): Promise<SafeTikTokPublishJob> {
    const job = await getJobRow(actor, jobId);
    if (!job.publish_id) {
      throw new Error("TIKTOK_JOB_INVALID:No publish identifier is available.");
    }
    const mediaAsset = job.media_asset_id ? await getMediaAsset(actor, job.media_asset_id) : null;
    const accessToken = await this.connectionService.getValidAccessToken(actor);
    let latest = job;
    let delayMs = 250;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const remote = await this.client.fetchPublishStatus(accessToken, job.publish_id);
        const mappedStatus =
          remote.status === "SEND_TO_USER_INBOX"
            ? "inbox_delivered"
            : remote.status === "PUBLISH_COMPLETE"
              ? job.publish_mode === "direct_post"
                ? "published"
                : "inbox_delivered"
              : remote.status === "FAILED"
                ? "failed"
                : "processing";
        const update = {
          status: mappedStatus,
          error_code: remote.status === "FAILED" ? (remote.failureReason || "provider_error") : null,
          error_message: remote.status === "FAILED" ? safeMessageFromError(remote.failureReason || "TikTok upload failed.") : null,
          completed_at: ["inbox_delivered", "published"].includes(mappedStatus) ? this.now().toISOString() : null,
          failed_at: mappedStatus === "failed" ? this.now().toISOString() : null,
        };
        const { data, error } = await actor.supabase
          .from("tiktok_publish_jobs")
          .update(update)
          .eq("workspace_id", actor.workspaceId)
          .eq("id", jobId)
          .select("id,workspace_id,created_by,connection_id,media_asset_id,publish_mode,publish_id,status,caption,privacy_level,disable_comment,disable_duet,disable_stitch,commercial_content_disclosure,branded_content_toggle,source_type,source_url,error_code,error_message,uploaded_bytes,publicly_available_post_ids,consented_at,submitted_at,completed_at,failed_at,metadata,created_at,updated_at")
          .single();
        if (error) throw new Error(`TIKTOK_JOB_UPDATE_FAILED:${error.message}`);
        latest = data as TikTokPublishJobRow;
        if (TERMINAL_JOB_STATUSES.has(mappedStatus)) {
          return mapJobRow(latest, mediaAsset);
        }
      } catch (error) {
        const mapped = mapTikTokError(error);
        const { error: updateError } = await actor.supabase
          .from("tiktok_publish_jobs")
          .update({
            status: mapped.reconnectRequired ? "reconnect_required" : "failed",
            error_code: mapped.internalErrorCode,
            error_message: mapped.message,
            failed_at: this.now().toISOString(),
          })
          .eq("workspace_id", actor.workspaceId)
          .eq("id", jobId);
        if (updateError) {
          throw new Error(`TIKTOK_JOB_UPDATE_FAILED:${updateError.message}`);
        }
        return mapJobRow({ ...job, status: mapped.reconnectRequired ? "reconnect_required" : "failed", error_code: mapped.internalErrorCode, error_message: mapped.message, failed_at: this.now().toISOString(), updated_at: this.now().toISOString() } as TikTokPublishJobRow, mediaAsset);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
    return mapJobRow(latest, mediaAsset);
  }

  async markTikTokJobFailed(
    actor: TikTokActor,
    jobId: string,
    error: unknown,
  ): Promise<SafeTikTokPublishJob> {
    const job = await getJobRow(actor, jobId);
    const mapped = mapTikTokError(error);
    const { error: updateError } = await actor.supabase
      .from("tiktok_publish_jobs")
      .update({
        status: mapped.reconnectRequired ? "reconnect_required" : "failed",
        error_code: mapped.internalErrorCode,
        error_message: mapped.message,
        failed_at: this.now().toISOString(),
      })
      .eq("workspace_id", actor.workspaceId)
      .eq("id", jobId);
    if (updateError) throw new Error(`TIKTOK_JOB_UPDATE_FAILED:${updateError.message}`);
    return mapJobRow({ ...job, status: mapped.reconnectRequired ? "reconnect_required" : "failed", error_code: mapped.internalErrorCode, error_message: mapped.message, failed_at: this.now().toISOString(), updated_at: this.now().toISOString() } as TikTokPublishJobRow);
  }

  async cancelLocalTikTokJob(actor: TikTokActor, jobId: string): Promise<SafeTikTokPublishJob> {
    const job = await getJobRow(actor, jobId);
    const { error } = await actor.supabase
      .from("tiktok_publish_jobs")
      .update({ status: "cancelled" })
      .eq("workspace_id", actor.workspaceId)
      .eq("id", jobId);
    if (error) throw new Error(`TIKTOK_JOB_CANCEL_FAILED:${error.message}`);
    return mapJobRow({ ...job, status: "cancelled", updated_at: this.now().toISOString() } as TikTokPublishJobRow);
  }

  async retryTikTokStatusCheck(actor: TikTokActor, jobId: string): Promise<SafeTikTokPublishJob> {
    const job = await getJobRow(actor, jobId);
    if (!job.publish_id) {
      throw new Error("TIKTOK_JOB_INVALID:No publish identifier is available.");
    }
    const { error } = await actor.supabase
      .from("tiktok_publish_jobs")
      .update({ status: "processing" })
      .eq("workspace_id", actor.workspaceId)
      .eq("id", jobId);
    if (error) throw new Error(`TIKTOK_JOB_UPDATE_FAILED:${error.message}`);
    return this.refreshTikTokPublishStatus(actor, jobId);
  }
}