import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getViewerContext } from "@/lib/auth/server";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { loadWorkspaceIntegrationDiagnostics } from "@/features/integrations/core/diagnostics";
import { getPageHelp } from "@/features/help/page-help-registry";
import { loadOnboardingChecklist } from "@/features/help/onboarding-checklist";
import type { HelpMode } from "@/features/help/types";

export async function loadHelpPreference() {
  const viewer = await getViewerContext();
  if (!viewer.userId) {
    return {
      helpMode: "AUTO" as HelpMode,
      compactPanels: false,
      proactiveTrainerEnabled: true,
    };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("user_help_preferences")
    .select("help_mode,compact_panels,proactive_trainer_enabled")
    .eq("user_id", viewer.userId)
    .maybeSingle();

  const row = (data as {
    help_mode?: HelpMode | null;
    compact_panels?: boolean | null;
    proactive_trainer_enabled?: boolean | null;
  } | null) || null;

  return {
    helpMode: row?.help_mode || "AUTO",
    compactPanels: Boolean(row?.compact_panels),
    proactiveTrainerEnabled: row?.proactive_trainer_enabled !== false,
  };
}

export async function saveHelpPreference(input: {
  helpMode: HelpMode;
  compactPanels?: boolean;
  proactiveTrainerEnabled?: boolean;
}) {
  const viewer = await getViewerContext();
  if (!viewer.userId) {
    throw new Error("AUTH_REQUIRED:Sign in required.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("user_help_preferences").upsert({
    user_id: viewer.userId,
    help_mode: input.helpMode,
    compact_panels: Boolean(input.compactPanels),
    proactive_trainer_enabled: input.proactiveTrainerEnabled !== false,
  } as never, { onConflict: "user_id" });

  if (error) {
    throw new Error(`HELP_PREFERENCE_SAVE_FAILED:${error.message}`);
  }
}

export async function loadHelpContext(route: string) {
  const viewer = await getViewerContext();
  const preference = await loadHelpPreference();
  const pageHelp = getPageHelp(route);

  if (!viewer.userId) {
    return {
      viewer,
      preference,
      pageHelp,
      onboarding: null,
      integrations: [],
      workflow: null,
    };
  }

  try {
    const workspace = await requireWorkspaceContext();
    const admin = createAdminClient();
    const [onboarding, integrations, notificationsResult, approvalsResult] = await Promise.all([
      loadOnboardingChecklist(workspace.workspaceId),
      loadWorkspaceIntegrationDiagnostics(workspace.workspaceId),
      admin.from("marketing_notifications").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.workspaceId).eq("status", "PENDING"),
      admin.from("marketing_approval_items").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.workspaceId).eq("status", "PENDING"),
    ]);

    return {
      viewer,
      preference,
      pageHelp,
      onboarding,
      integrations: integrations.map((item) => ({
        providerId: item.providerId,
        state: item.state,
        label: item.label,
      })),
      workflow: {
        pendingNotifications: Number(notificationsResult.count || 0),
        pendingApprovals: Number(approvalsResult.count || 0),
      },
    };
  } catch {
    return {
      viewer,
      preference,
      pageHelp,
      onboarding: null,
      integrations: [],
      workflow: null,
    };
  }
}
