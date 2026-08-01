"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMarketingModeSettings } from "@/features/marketing-director/modes";
import { resolveOperatingMode, type MarketingDirectorMode } from "@/features/marketing-director/mode-locks";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

function readBoolean(formData: FormData, key: string, defaultValue: boolean) {
  const value = String(formData.get(key) || "").toLowerCase();
  if (!value) return defaultValue;
  return ["true", "1", "on", "yes"].includes(value);
}

export async function saveMarketingDirectorSettingsAction(formData: FormData) {
  const context = await requireWorkspaceContext();
  const supabase = await createClient();
  const modeSettings = await getMarketingModeSettings(context.workspaceId);

  const requestedMode = String(formData.get("operatingMode") || "advisor").toLowerCase();
  const normalizedRequestedMode: MarketingDirectorMode =
    requestedMode === "copilot" || requestedMode === "autopilot" ? requestedMode : "advisor";
  const mode = resolveOperatingMode(normalizedRequestedMode, modeSettings.autopilotAvailable);

  const dailyBriefTimeInput = String(formData.get("dailyBriefTime") || "08:30").trim();
  const dailyBriefTime = /^\d{2}:\d{2}$/.test(dailyBriefTimeInput)
    ? dailyBriefTimeInput
    : "08:30";

  const timezone = String(formData.get("timezone") || "UTC").trim() || "UTC";

  const payload = {
    workspace_id: context.workspaceId,
    operating_mode: mode,
    approval_required_for_content: readBoolean(formData, "approvalRequiredForContent", true),
    approval_required_for_scheduling: readBoolean(formData, "approvalRequiredForScheduling", true),
    approval_required_for_budget_changes: readBoolean(formData, "approvalRequiredForBudgetChanges", true),
    approval_required_for_publishing: readBoolean(formData, "approvalRequiredForPublishing", true),
    daily_brief_enabled: readBoolean(formData, "dailyBriefEnabled", true),
    daily_brief_time: dailyBriefTime,
    timezone,
  };

  const { error } = await supabase
    .from("workspace_marketing_settings")
    .upsert(payload as never, { onConflict: "workspace_id" });

  if (error) {
    throw new Error(`MARKETING_SETTINGS_SAVE_FAILED:${error.message}`);
  }

  revalidatePath("/");
  revalidatePath("/settings/marketing-director");
}
