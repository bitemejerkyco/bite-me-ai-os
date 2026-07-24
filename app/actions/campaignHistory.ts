"use server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { CampaignBrief } from "@/lib/agents/campaignStrategist";
import type { CampaignPackage } from "@/lib/orchestrators/campaignOrchestrator";
import type { SavedCampaign } from "@/lib/campaign/types";

export async function listCampaigns(): Promise<{ success: boolean; campaigns: SavedCampaign[]; error?: string }> {
  try {
    const { data, error } = await getSupabaseAdmin().from("campaigns").select("*").order("updated_at", { ascending: false });
    if (error) return { success: false, campaigns: [], error: error.message };
    return { success: true, campaigns: (data ?? []) as SavedCampaign[] };
  } catch (error) {
    return { success: false, campaigns: [], error: error instanceof Error ? error.message : "Unable to load campaigns." };
  }
}

export async function saveCampaign(input: { id?: string; title: string; brandId?: string; brief: CampaignBrief; output: CampaignPackage }) {
  try {
    const db = getSupabaseAdmin();
    const payload = {
      title: input.title.trim() || `${input.brief.brandName} Campaign`,
      brand_id: input.brandId || null,
      status: "complete",
      brief: input.brief,
      output: input.output,
      updated_at: new Date().toISOString(),
    };
    const query = input.id ? db.from("campaigns").update(payload).eq("id", input.id) : db.from("campaigns").insert(payload);
    const { data, error } = await query.select().single();
    if (error) return { success: false as const, error: error.message };
    return { success: true as const, campaign: data as SavedCampaign };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Unable to save campaign." };
  }
}

export async function duplicateCampaign(id: string) {
  try {
    const db = getSupabaseAdmin();
    const { data: source, error: readError } = await db.from("campaigns").select("*").eq("id", id).single();
    if (readError) return { success: false as const, error: readError.message };
    const { data, error } = await db.from("campaigns").insert({
      title: `${source.title} Copy`, brand_id: source.brand_id, status: "draft", brief: source.brief, output: source.output,
    }).select().single();
    if (error) return { success: false as const, error: error.message };
    return { success: true as const, campaign: data as SavedCampaign };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Unable to duplicate campaign." };
  }
}

export async function deleteCampaign(id: string) {
  try {
    const { error } = await getSupabaseAdmin().from("campaigns").delete().eq("id", id);
    return error ? { success: false as const, error: error.message } : { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Unable to delete campaign." };
  }
}
