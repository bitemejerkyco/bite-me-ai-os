const SENSITIVE_KEY_PATTERN = /(password|api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|authorization|service[_-]?role|cookie)/i;

export type AuditValue =
  | string
  | number
  | boolean
  | null
  | AuditValue[]
  | { [key: string]: AuditValue };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeAuditValue(
  value: unknown,
  parentKey?: string,
): AuditValue {
  if (parentKey && SENSITIVE_KEY_PATTERN.test(parentKey)) {
    return "[REDACTED]";
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item, parentKey));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        sanitizeAuditValue(entry, key),
      ]),
    ) as AuditValue;
  }

  return String(value) as AuditValue;
}

export function createAdminAuditEvent(input: {
  actorUserId: string;
  targetAccountId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  return {
    actor_user_id: input.actorUserId,
    target_account_id: input.targetAccountId ?? null,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    previous_value:
      input.previousValue === undefined
        ? null
        : sanitizeAuditValue(input.previousValue),
    new_value:
      input.newValue === undefined ? null : sanitizeAuditValue(input.newValue),
    reason: input.reason?.trim() || null,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  };
}