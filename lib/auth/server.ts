import "server-only";

import { redirect } from "next/navigation";
import {
  resolveAccountAccess,
  resolveAdminAccess,
} from "@/lib/auth/access-rules";
import { createClient } from "@/lib/supabase/server";

export type ViewerContext = {
  userId: string | null;
  email: string | null;
  isSuperAdmin: boolean;
  systemRole: string | null;
  canViewTechnicalDetails: boolean;
  primaryAccountId: string | null;
  primaryAccountName: string | null;
};

export async function getViewerContext(): Promise<ViewerContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      userId: null,
      email: null,
      isSuperAdmin: false,
      systemRole: null,
      canViewTechnicalDetails: false,
      primaryAccountId: null,
      primaryAccountName: null,
    };
  }

  const [{ data: superAdminValue }, { data: workspace }, { data: profile }] = await Promise.all([
    supabase.rpc("is_super_admin"),
    supabase
      .from("workspaces")
      .select("id,name")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from("profiles").select("system_role").eq("user_id", user.id).maybeSingle(),
  ]);

  const systemRole = String((profile as { system_role?: string | null } | null)?.system_role || "CUSTOMER");
  const canViewTechnicalDetails = Boolean(superAdminValue)
    || systemRole === "INTERNAL_ADMIN"
    || systemRole === "SUPPORT_ADMIN";

  return {
    userId: user.id,
    email: user.email ?? null,
    isSuperAdmin: Boolean(superAdminValue),
    systemRole,
    canViewTechnicalDetails,
    primaryAccountId: workspace?.id ? String(workspace.id) : null,
    primaryAccountName: workspace?.name ? String(workspace.name) : null,
  };
}

export async function requireSuperAdmin(): Promise<ViewerContext> {
  const viewer = await getViewerContext();
  const decision = resolveAdminAccess(viewer);

  if (!decision.allowed && decision.redirectTo) {
    redirect(decision.redirectTo);
  }

  return viewer;
}

export async function assertCurrentUserCanAccessAccount(
  accountId: string,
): Promise<ViewerContext> {
  const viewer = await getViewerContext();
  const supabase = await createClient();
  const { data: belongsToAccount } = await supabase.rpc(
    "current_user_belongs_to_account",
    {
      target_account_id: accountId,
    },
  );
  const decision = resolveAccountAccess({
    userId: viewer.userId,
    isSuperAdmin: viewer.isSuperAdmin,
    belongsToAccount: Boolean(belongsToAccount),
  });

  if (!decision.allowed) {
    throw new Error(
      decision.reason === "UNAUTHENTICATED"
        ? "AUTH_REQUIRED:Sign in required."
        : "ACCOUNT_FORBIDDEN:You do not have access to this account.",
    );
  }

  return viewer;
}