"use server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { BrandProfile } from "@/lib/brand/types";

export async function listBrands(): Promise<{ success: boolean; brands: BrandProfile[]; error?: string }> {
  const { data, error } = await getSupabaseAdmin()
    .from("brands")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) return { success: false, brands: [], error: error.message };
  return { success: true, brands: (data ?? []) as BrandProfile[] };
}

export async function saveBrand(brand: BrandProfile) {
  if (!brand.name.trim()) return { success: false, error: "Brand name is required." };

  const payload = {
    name: brand.name.trim(),
    website: brand.website.trim(),
    industry: brand.industry.trim(),
    mission: brand.mission.trim(),
    tagline: brand.tagline.trim(),
    brand_voice: brand.brand_voice.trim(),
    target_audience: brand.target_audience.trim(),
    products: brand.products.trim(),
    competitors: brand.competitors.trim(),
    marketing_goals: brand.marketing_goals.trim(),
    primary_color: brand.primary_color,
    secondary_color: brand.secondary_color,
    logo_url: brand.logo_url.trim(),
    updated_at: new Date().toISOString(),
  };

  const query = brand.id
    ? getSupabaseAdmin().from("brands").update(payload).eq("id", brand.id)
    : getSupabaseAdmin().from("brands").insert(payload);

  const { data, error } = await query.select().single();
  if (error) return { success: false, error: error.message };
  return { success: true, brand: data as BrandProfile };
}

export async function deleteBrand(id: string) {
  const { error } = await getSupabaseAdmin().from("brands").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
