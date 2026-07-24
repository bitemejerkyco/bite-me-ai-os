import type { CampaignBrief } from "@/lib/agents/campaignStrategist";
import type { CampaignPackage } from "@/lib/orchestrators/campaignOrchestrator";

export type SavedCampaign = {
  id: string;
  title: string;
  brand_id: string | null;
  status: "draft" | "complete" | "archived";
  brief: CampaignBrief;
  output: CampaignPackage;
  created_at: string;
  updated_at: string;
};
