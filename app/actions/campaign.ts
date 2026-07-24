"use server";

import { runCampaignOrchestrator } from "@/lib/orchestrators/campaignOrchestrator";
import type { CampaignBrief } from "@/lib/agents/campaignStrategist";

export async function generateCampaign(brief: CampaignBrief) {
  try {
    const campaign = await runCampaignOrchestrator(brief);
    return { success: true as const, campaign };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Campaign generation failed." };
  }
}
