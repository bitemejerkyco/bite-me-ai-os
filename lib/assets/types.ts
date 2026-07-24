export type BrandAsset = {
  id: string;
  brand_id: string | null;
  name: string;
  asset_type: "logo" | "product" | "photo" | "video" | "document" | "other";
  file_url: string;
  notes: string;
  created_at: string;
};
