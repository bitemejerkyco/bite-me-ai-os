export type AccessDecision = {
  allowed: boolean;
  reason: "ALLOWED" | "UNAUTHENTICATED" | "FORBIDDEN";
  redirectTo: string | null;
};

export function resolveAdminAccess(input: {
  userId: string | null;
  isSuperAdmin: boolean;
}): AccessDecision {
  if (!input.userId) {
    return {
      allowed: false,
      reason: "UNAUTHENTICATED",
      redirectTo: "/login",
    };
  }

  if (!input.isSuperAdmin) {
    return {
      allowed: false,
      reason: "FORBIDDEN",
      redirectTo: "/",
    };
  }

  return {
    allowed: true,
    reason: "ALLOWED",
    redirectTo: null,
  };
}

export function resolveAccountAccess(input: {
  userId: string | null;
  isSuperAdmin: boolean;
  belongsToAccount: boolean;
}): AccessDecision {
  if (!input.userId) {
    return {
      allowed: false,
      reason: "UNAUTHENTICATED",
      redirectTo: "/login",
    };
  }

  if (!input.isSuperAdmin && !input.belongsToAccount) {
    return {
      allowed: false,
      reason: "FORBIDDEN",
      redirectTo: "/",
    };
  }

  return {
    allowed: true,
    reason: "ALLOWED",
    redirectTo: null,
  };
}