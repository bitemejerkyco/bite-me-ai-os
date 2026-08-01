"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

function readText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) || "").trim();
  return value ? value : null;
}

export async function saveBrandingSettingsAction(formData: FormData) {
  const context = await requireWorkspaceContext();
  const { supabase } = context;

  const payload = {
    workspace_id: context.workspaceId,
    logo_url: readText(formData, "logoUrl"),
    primary_color: readText(formData, "primaryColor"),
    custom_domain: readText(formData, "customDomain"),
    email_branding_name: readText(formData, "emailBrandingName"),
    login_headline: readText(formData, "loginHeadline"),
    favicon_url: readText(formData, "faviconUrl"),
  };

  const { error } = await supabase
    .from("workspace_branding_settings")
    .upsert(payload as never, { onConflict: "workspace_id" });

  if (error) {
    throw new Error(`BRANDING_SAVE_FAILED:${error.message}`);
  }

  revalidatePath("/settings/branding");
}
