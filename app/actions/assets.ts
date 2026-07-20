"use server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { BrandAsset } from "@/lib/assets/types";

export async function listAssets(): Promise<{ success: boolean; assets: BrandAsset[]; error?: string }> {
  try {
    const { data, error } = await getSupabaseAdmin().from("brand_assets").select("*").order("created_at", { ascending: false });
    if (error) return { success: false, assets: [], error: error.message };
    return { success: true, assets: (data ?? []) as BrandAsset[] };
  } catch (error) {
    return { success: false, assets: [], error: error instanceof Error ? error.message : "Unable to load assets." };
  }
}

export async function saveAsset(input: Omit<BrandAsset, "id" | "created_at">) {
  try {
    const { data, error } = await getSupabaseAdmin().from("brand_assets").insert(input).select().single();
    if (error) return { success: false as const, error: error.message };
    return { success: true as const, asset: data as BrandAsset };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Unable to save asset." };
  }
}

export async function deleteAsset(id: string) {
  try {
    const { error } = await getSupabaseAdmin().from("brand_assets").delete().eq("id", id);
    return error ? { success: false as const, error: error.message } : { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Unable to delete asset." };
  }
}
