export const HEALTH_STATUS_ORDER = [
  "critical",
  "warning",
  "unavailable",
  "healthy",
  "not_configured",
] as const;

export type HealthStatus =
  | "healthy"
  | "warning"
  | "critical"
  | "unavailable"
  | "not_configured";

const SENSITIVE_KEY_PATTERN = /(password|api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|authorization|service[_-]?role|cookie)/i;

export type ServiceHealthCheck = {
  key: string;
  displayName: string;
  status: HealthStatus;
  message: string;
  checkedAt: string;
  latencyMs?: number | null;
  metadata?: Record<string, unknown>;
  source: string;
};

export function sanitizeHealthMetadata(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!value) return {};

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return [key, "[REDACTED]"];
      }
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        return [key, sanitizeHealthMetadata(entry as Record<string, unknown>)];
      }
      if (Array.isArray(entry)) {
        return [
          key,
          entry.map((item) =>
            item && typeof item === "object" && !Array.isArray(item)
              ? sanitizeHealthMetadata(item as Record<string, unknown>)
              : item,
          ),
        ];
      }
      return [key, entry];
    }),
  );
}

export function summarizeOverallHealth(
  checks: ServiceHealthCheck[],
): HealthStatus {
  for (const status of HEALTH_STATUS_ORDER) {
    if (checks.some((check) => check.status === status)) {
      return status;
    }
  }
  return "not_configured";
}