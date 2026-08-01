import { redactTikTokSecrets } from "@/features/integrations/tiktok/token-crypto";

export type TikTokErrorMapping = {
  message: string;
  reconnectRequired: boolean;
  retryable: boolean;
  internalErrorCode: string;
  providerCode: string | null;
};

function messageFrom(input: unknown): string {
  return redactTikTokSecrets(input instanceof Error ? input.message : String(input));
}

function extractProviderCode(message: string): string | null {
  const match = message.match(/^[A-Z_]+:([^:(\s]+)(?:[:\s(]|$)/u);
  return match ? match[1] : null;
}

export function mapTikTokError(input: unknown): TikTokErrorMapping {
  const message = messageFrom(input);
  const providerCode = extractProviderCode(message);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("reconnect required") ||
    normalized.includes("expired token") ||
    normalized.includes("authorization expired") ||
    normalized.includes("auth expired")
  ) {
    return {
      message: "TikTok authorization expired. Reconnect the account.",
      reconnectRequired: true,
      retryable: false,
      internalErrorCode: "expired_token",
      providerCode,
    };
  }

  if (normalized.includes("invalid token") || normalized.includes("token is invalid")) {
    return {
      message: "TikTok authorization is invalid. Reconnect the account.",
      reconnectRequired: true,
      retryable: false,
      internalErrorCode: "invalid_token",
      providerCode,
    };
  }

  if (normalized.includes("scope") && normalized.includes("missing")) {
    return {
      message: "TikTok is missing a required permission.",
      reconnectRequired: true,
      retryable: false,
      internalErrorCode: "missing_scope",
      providerCode,
    };
  }

  if (normalized.includes("rate limit") || normalized.includes("too many requests") || message.includes("429")) {
    return {
      message: "TikTok is rate limiting requests. Please try again shortly.",
      reconnectRequired: false,
      retryable: true,
      internalErrorCode: "rate_limit",
      providerCode,
    };
  }

  if (normalized.includes("verified url") || normalized.includes("unverified url") || normalized.includes("media delivery is not configured")) {
    return {
      message: "TikTok cannot reach the configured media URL.",
      reconnectRequired: false,
      retryable: false,
      internalErrorCode: "unverified_url",
      providerCode,
    };
  }

  if (normalized.includes("unsupported media") || normalized.includes("invalid video")) {
    return {
      message: "TikTok does not accept this media file.",
      reconnectRequired: false,
      retryable: false,
      internalErrorCode: "unsupported_media",
      providerCode,
    };
  }

  if (normalized.includes("pending") && normalized.includes("limit")) {
    return {
      message: "TikTok has reached the pending share limit.",
      reconnectRequired: false,
      retryable: true,
      internalErrorCode: "pending_share_limit",
      providerCode,
    };
  }

  if (normalized.includes("posting restriction") || normalized.includes("publish restriction")) {
    return {
      message: "TikTok rejected the publish request because the account is restricted.",
      reconnectRequired: false,
      retryable: false,
      internalErrorCode: "posting_restriction",
      providerCode,
    };
  }

  if (normalized.includes("moderation")) {
    return {
      message: "TikTok rejected the video during moderation.",
      reconnectRequired: false,
      retryable: false,
      internalErrorCode: "moderation_failure",
      providerCode,
    };
  }

  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return {
      message: "TikTok took too long to respond. Try again shortly.",
      reconnectRequired: false,
      retryable: true,
      internalErrorCode: "timeout",
      providerCode,
    };
  }

  if (normalized.includes("unavailable") || normalized.includes("service unavailable") || normalized.includes("502") || normalized.includes("503")) {
    return {
      message: "TikTok is temporarily unavailable.",
      reconnectRequired: false,
      retryable: true,
      internalErrorCode: "provider_unavailable",
      providerCode,
    };
  }

  return {
    message: "TikTok returned an unexpected error.",
    reconnectRequired: false,
    retryable: false,
    internalErrorCode: providerCode || "unknown_provider_error",
    providerCode,
  };
}