import { runTextAgent } from "@/lib/ai/runTextAgent";
import type { CampaignBrief } from "@/lib/agents/campaignStrategist";

export async function generateImagePrompts(brief: CampaignBrief, strategy: string): Promise<string> {
  return runTextAgent({
    name: "Creative Director",
    instructions: `Create 8 detailed image-generation prompts for campaign graphics. Include format, composition, subject, lighting, visual hierarchy, copy placement, and brand constraints.`,
    input: `Campaign brief:\n${JSON.stringify(brief, null, 2)}\n\nApproved strategy:\n${strategy}`,
  });
}
