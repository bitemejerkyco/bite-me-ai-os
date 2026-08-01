import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  createAdminAuditEvent,
  sanitizeAuditValue,
  type AuditValue,
} from "@/features/admin/audit-rules";

export { createAdminAuditEvent, sanitizeAuditValue };
export type { AuditValue };

export async function writeAdminAuditEvent(
  input: Parameters<typeof createAdminAuditEvent>[0],
): Promise<void> {
  const admin = createAdminClient();
  const event = createAdminAuditEvent(input);
  const { error } = await admin.from("admin_audit_logs").insert(event as never);
  if (error) {
    throw new Error(`ADMIN_AUDIT_WRITE_FAILED:${error.message}`);
  }
}