import { runTextAgent } from "@/lib/ai/runTextAgent";
import type { CampaignBrief } from "@/lib/agents/campaignStrategist";

export async function generateSocialContent(brief: CampaignBrief, strategy: string): Promise<string> {
  return runTextAgent({
    name: "Social Copywriter",
    instructions: `Create platform-ready social content from the approved strategy. Include 10 post concepts, hooks, captions, CTAs, and platform notes. Keep the work specific, useful, and on-brand.`,
    input: `Campaign brief:\n${JSON.stringify(brief, null, 2)}\n\nApproved strategy:\n${strategy}`,
  });
}
