import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOperatingMode, type MarketingDirectorMode } from "@/features/marketing-director/mode-locks";

type FeatureFlagRow = { enabled: boolean | null };
type WorkspaceMarketingSettingsRow = {
  workspace_id: string;
  operating_mode: string | null;
  autonomy_level: number | null;
  approval_required_for_content: boolean | null;
  approval_required_for_scheduling: boolean | null;
  approval_required_for_budget_changes: boolean | null;
  approval_required_for_publishing: boolean | null;
  daily_brief_enabled: boolean | null;
  daily_brief_time: string | null;
  timezone: string | null;
};

export type MarketingModeSettings = {
  workspaceId: string;
  operatingMode: MarketingDirectorMode;
  autonomyLevel: 1 | 2 | 3 | 4 | 5;
  approvalRequiredForContent: boolean;
  approvalRequiredForScheduling: boolean;
  approvalRequiredForBudgetChanges: boolean;
  approvalRequiredForPublishing: boolean;
  dailyBriefEnabled: boolean;
  dailyBriefTime: string;
  timezone: string;
  copilotAvailable: boolean;
  copilotMessage: string;
  autopilotAvailable: boolean;
  autopilotMessage: string;
};

const DEFAULT_SETTINGS: Omit<
  MarketingModeSettings,
  "workspaceId" | "copilotAvailable" | "copilotMessage" | "autopilotAvailable" | "autopilotMessage"
> = {
  operatingMode: "advisor",
  autonomyLevel: 3,
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

function normalizeAutonomyLevel(value: unknown): 1 | 2 | 3 | 4 | 5 {
  const parsed = Number(value || 3);
  if (!Number.isFinite(parsed)) return 3;
  if (parsed <= 1) return 1;
  if (parsed >= 5) return 5;
  return Math.round(parsed) as 1 | 2 | 3 | 4 | 5;
}

export function modeCapabilities(mode: MarketingDirectorMode, autonomyLevel = 3): {
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
    unattendedPublishingEnabled: autonomyLevel >= 4,
  };
}

export async function getMarketingModeSettings(workspaceId: string): Promise<MarketingModeSettings> {
  const admin = createAdminClient();
  const stagedModesAvailable = await loadAutopilotFeatureFlag();
  const { data, error } = await admin
    .from("workspace_marketing_settings")
    .select("workspace_id,operating_mode,autonomy_level,approval_required_for_content,approval_required_for_scheduling,approval_required_for_budget_changes,approval_required_for_publishing,daily_brief_enabled,daily_brief_time,timezone")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const settings = (data as WorkspaceMarketingSettingsRow | null) || null;

  if (error) {
    throw new Error(`MARKETING_MODE_SETTINGS_FAILED:${error.message}`);
  }

  const operatingMode = normalizeMode(settings?.operating_mode);
  const safeMode = resolveOperatingMode(operatingMode, stagedModesAvailable);

  return {
    workspaceId,
    operatingMode: safeMode,
    autonomyLevel: normalizeAutonomyLevel(settings?.autonomy_level),
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
    copilotAvailable: stagedModesAvailable,
    copilotMessage: stagedModesAvailable
      ? "Copilot is enabled for this staged rollout."
      : "Copilot is locked until beta safety entitlement is enabled.",
    autopilotAvailable: stagedModesAvailable,
    autopilotMessage: stagedModesAvailable
      ? "Autopilot is feature-flagged for staged rollout."
      : "Coming after beta approval and safety certification.",
  };
}
