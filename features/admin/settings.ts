import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  SYSTEM_SETTING_KEYS,
  canAccessDuringMaintenance,
  validateSystemSettingValue,
  type SystemSettingKey,
} from "@/features/admin/settings-rules";

type SettingRow = {
  id: string;
  key: string;
  value: unknown;
  category: string;
  description: string | null;
  is_secret: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SystemSettingRecord = {
  id: string;
  key: SystemSettingKey;
  value: unknown;
  category: string;
  description: string;
  isSecret: boolean;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listSystemSettings(): Promise<SystemSettingRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("system_settings")
    .select("id,key,value,category,description,is_secret,updated_by,created_at,updated_at")
    .order("category", { ascending: true })
    .order("key", { ascending: true });

  if (error) {
    throw new Error(`SYSTEM_SETTINGS_LIST_FAILED:${error.message}`);
  }

  return ((data as SettingRow[] | null) || []).map((row) => ({
    id: row.id,
    key: row.key as SystemSettingKey,
    value: row.value,
    category: row.category,
    description: row.description || "",
    isSecret: Boolean(row.is_secret),
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getSystemSetting(
  key: SystemSettingKey,
): Promise<SystemSettingRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("system_settings")
    .select("id,key,value,category,description,is_secret,updated_by,created_at,updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    throw new Error(`SYSTEM_SETTING_LOOKUP_FAILED:${error.message}`);
  }

  const row = data as SettingRow | null;
  return row
    ? {
        id: row.id,
        key: row.key as SystemSettingKey,
        value: row.value,
        category: row.category,
        description: row.description || "",
        isSecret: Boolean(row.is_secret),
        updatedBy: row.updated_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;
}

export { SYSTEM_SETTING_KEYS, canAccessDuringMaintenance, validateSystemSettingValue };