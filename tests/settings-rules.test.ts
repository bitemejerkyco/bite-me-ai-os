import { describe, expect, it } from "vitest";
import {
  canAccessDuringMaintenance,
  validateSystemSettingValue,
} from "@/features/admin/settings-rules";

describe("system settings validation", () => {
  it("validates numeric settings by key", () => {
    expect(validateSystemSettingValue("default_trial_days", "14")).toBe(14);
    expect(validateSystemSettingValue("storage_warning_percentage", "80")).toBe(80);
    expect(() => validateSystemSettingValue("storage_critical_percentage", "200")).toThrow(
      "SETTING_VALUE_INVALID",
    );
  });

  it("validates and normalizes non-secret settings", () => {
    expect(validateSystemSettingValue("maintenance_mode", "true")).toBe(true);
    expect(validateSystemSettingValue("support_email", "support@example.com")).toBe(
      "support@example.com",
    );
    expect(() => validateSystemSettingValue("support_email", "bad-email")).toThrow(
      "SETTING_VALUE_INVALID",
    );
  });

  it("validates announcement banner JSON", () => {
    expect(
      validateSystemSettingValue(
        "announcement_banner",
        JSON.stringify({ enabled: true, message: "Hello" }),
      ),
    ).toEqual({ enabled: true, message: "Hello" });
  });

  it("allows super admins during maintenance mode", () => {
    expect(
      canAccessDuringMaintenance({ maintenanceMode: true, isSuperAdmin: true }),
    ).toBe(true);
    expect(
      canAccessDuringMaintenance({ maintenanceMode: true, isSuperAdmin: false }),
    ).toBe(false);
  });
});