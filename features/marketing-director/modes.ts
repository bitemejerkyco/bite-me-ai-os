import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type FeatureFlagRow = { enabled: boolean | null };
type WorkspaceMarketingSettingsRow = {
  workspace_id: string;
  operating_mode: string | null;
  approval_required_for_content: boolean | null;
  approval_required_for_scheduling: boolean | null;
  approval_required_for_budget_changes: boolean | null;
  approval_required_for_publishing: boolean | null;
  daily_brief_enabled: boolean | null;
  daily_brief_time: string | null;
  timezone: string | null;
};

export type MarketingDirectorMode = "advisor" | "copilot" | "autopilot";

export type MarketingModeSettings = {
  workspaceId: string;
  operatingMode: MarketingDirectorMode;
  approvalRequiredForContent: boolean;
  approvalRequiredForScheduling: boolean;
  approvalRequiredForBudgetChanges: boolean;
  approvalRequiredForPublishing: boolean;
  dailyBriefEnabled: boolean;
  dailyBriefTime: string;
  timezone: string;
  autopilotAvailable: boolean;
  autopilotMessage: string;
};

const DEFAULT_SETTINGS: Omit<MarketingModeSettings, "workspaceId" | "autopilotAvailable" | "autopilotMessage"> = {
  operatingMode: "advisor",
  approvalRequiredForContent: true,
  approvalRequiredForScheduling: true,
  approvalRequiredForBudgetChanges: true,
  approvalRequiredForPublishing: true,
  dailyBriefEnabled: true,
  dailyBriefTime: "08:30",
  timezone: "UTC",
};

function normalizeMode(value: unknown): MarketingDirectorMode {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "copilot") return "copilot";
  if (normalized === "autopilot") return "autopilot";
  return "advisor";
}

async function loadAutopilotFeatureFlag(): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("feature_flags")
    .select("enabled")
    .eq("key", "marketing_director_autopilot")
    .maybeSingle();
  const flag = (data as FeatureFlagRow | null) || null;
  if (error || !flag) return false;
  return Boolean(flag.enabled);
}

export function modeCapabilities(mode: MarketingDirectorMode): {
  recommendationsOnly: boolean;
  canGenerateDrafts: boolean;
  canProposeSchedules: boolean;
  unattendedPublishingEnabled: boolean;
} {
  if (mode === "advisor") {
    return {
      recommendationsOnly: true,
      canGenerateDrafts: false,
      canProposeSchedules: false,
      unattendedPublishingEnabled: false,
    };
  }
  if (mode === "copilot") {
    return {
      recommendationsOnly: false,
      canGenerateDrafts: true,
      canProposeSchedules: true,
      unattendedPublishingEnabled: false,
    };
  }
  return {
    recommendationsOnly: false,
    canGenerateDrafts: true,
    canProposeSchedules: true,
    unattendedPublishingEnabled: false,
  };
}

export async function getMarketingModeSettings(workspaceId: string): Promise<MarketingModeSettings> {
  const admin = createAdminClient();
  const autopilotAvailable = await loadAutopilotFeatureFlag();
  const { data, error } = await admin
    .from("workspace_marketing_settings")
    .select("workspace_id,operating_mode,approval_required_for_content,approval_required_for_scheduling,approval_required_for_budget_changes,approval_required_for_publishing,daily_brief_enabled,daily_brief_time,timezone")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const settings = (data as WorkspaceMarketingSettingsRow | null) || null;

  if (error) {
    throw new Error(`MARKETING_MODE_SETTINGS_FAILED:${error.message}`);
  }

  const operatingMode = normalizeMode(settings?.operating_mode);
  const safeMode = operatingMode === "autopilot" && !autopilotAvailable ? "advisor" : operatingMode;

  return {
    workspaceId,
    operatingMode: safeMode,
    approvalRequiredForContent:
      typeof settings?.approval_required_for_content === "boolean"
        ? settings.approval_required_for_content
        : DEFAULT_SETTINGS.approvalRequiredForContent,
    approvalRequiredForScheduling:
      typeof settings?.approval_required_for_scheduling === "boolean"
        ? settings.approval_required_for_scheduling
        : DEFAULT_SETTINGS.approvalRequiredForScheduling,
    approvalRequiredForBudgetChanges:
      typeof settings?.approval_required_for_budget_changes === "boolean"
        ? settings.approval_required_for_budget_changes
        : DEFAULT_SETTINGS.approvalRequiredForBudgetChanges,
    approvalRequiredForPublishing:
      typeof settings?.approval_required_for_publishing === "boolean"
        ? settings.approval_required_for_publishing
        : DEFAULT_SETTINGS.approvalRequiredForPublishing,
    dailyBriefEnabled:
      typeof settings?.daily_brief_enabled === "boolean"
        ? settings.daily_brief_enabled
        : DEFAULT_SETTINGS.dailyBriefEnabled,
    dailyBriefTime:
      typeof settings?.daily_brief_time === "string" && settings.daily_brief_time
        ? settings.daily_brief_time
        : DEFAULT_SETTINGS.dailyBriefTime,
    timezone:
      typeof settings?.timezone === "string" && settings.timezone
        ? settings.timezone
        : DEFAULT_SETTINGS.timezone,
    autopilotAvailable,
    autopilotMessage: autopilotAvailable
      ? "Autopilot is feature-flagged for staged rollout."
      : "Coming after beta approval and safety certification.",
  };
}
