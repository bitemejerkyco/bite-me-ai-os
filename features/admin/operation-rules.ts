export function requireSuperAdminMutationAccess(input: {
  actorUserId: string | null;
  actorIsSuperAdmin: boolean;
}) {
  if (!input.actorUserId) {
    throw new Error("AUTH_REQUIRED:Sign in required.");
  }
  if (!input.actorIsSuperAdmin) {
    throw new Error("ADMIN_REQUIRED:Super Admin access is required.");
  }
}

export function requireSensitiveReason(reason: string | null | undefined): string {
  const normalized = (reason || "").trim();
  if (normalized.length < 8) {
    throw new Error(
      "REASON_REQUIRED:Provide a clear reason with at least 8 characters.",
    );
  }
  return normalized;
}

export function assertCanRemoveSuperAdminAccess(input: {
  actorUserId: string;
  targetUserId: string;
  nextSystemRole: string;
  activeSuperAdminCount: number;
}) {
  if (
    input.actorUserId === input.targetUserId &&
    input.nextSystemRole !== "SUPER_ADMIN" &&
    input.activeSuperAdminCount <= 1
  ) {
    throw new Error(
      "LAST_SUPER_ADMIN_PROTECTED:You cannot remove the final active Super Admin.",
    );
  }
}