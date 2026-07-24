export type BrandProfile = {
  id?: string;
  name: string;
  website: string;
  industry: string;
  mission: string;
  tagline: string;
  brand_voice: string;
  target_audience: string;
  products: string;
  competitors: string;
  marketing_goals: string;
  primary_color: string;
  secondary_color: string;
  logo_url: string;
  created_at?: string;
  updated_at?: string;
};

export const emptyBrand: BrandProfile = {
  name: "",
  website: "",
  industry: "",
  mission: "",
  tagline: "",
  brand_voice: "",
  target_audience: "",
  products: "",
  competitors: "",
  marketing_goals: "",
  primary_color: "#dc2626",
  secondary_color: "#111318",
  logo_url: "",
};
