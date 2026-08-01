export type IntegrationErrorClassification = {
  code: string;
  message: string;
  retryable: boolean;
  reconnectRequired: boolean;
  rateLimited: boolean;
  retryAfterSeconds: number | null;
};

const RETRYABLE_CODES = new Set([
  "timeout",
  "provider_unavailable",
  "transport_error",
  "network_error",
  "rate_limit",
]);

const RECONNECT_CODES = new Set([
  "invalid_token",
  "expired_token",
  "missing_scope",
  "auth_denied",
]);

export function redactIntegrationSecrets(input: string): string {
  return input
    .replace(/(access_token|refresh_token|client_secret|authorization_code|code)=([^&\s]+)/giu, "$1=[REDACTED]")
    .replace(/(bearer\s+)[a-z0-9\-._~+/]+=*/giu, "$1[REDACTED]");
}

export function classifyIntegrationError(input: unknown): IntegrationErrorClassification {
  const rawMessage = input instanceof Error ? input.message : String(input);
  const message = redactIntegrationSecrets(rawMessage);
  const normalized = message.toLowerCase();

  const code = normalized.includes(":")
    ? normalized.split(":", 1)[0].replace(/[^a-z0-9_]/giu, "_")
    : "unknown_error";

  const retryAfterMatch = normalized.match(/retry[-_ ]?after[:= ]+(\d{1,6})/u);
  const retryAfterSeconds = retryAfterMatch ? Number(retryAfterMatch[1]) : null;

  const rateLimited =
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("429");

  const reconnectRequired =
    normalized.includes("expired token") ||
    normalized.includes("invalid token") ||
    normalized.includes("scope") ||
    RECONNECT_CODES.has(code);

  const retryable =
    rateLimited ||
    normalized.includes("timeout") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("502") ||
    normalized.includes("503") ||
    RETRYABLE_CODES.has(code);

  return {
    code,
    message,
    retryable,
    reconnectRequired,
    rateLimited,
    retryAfterSeconds,
  };
}
