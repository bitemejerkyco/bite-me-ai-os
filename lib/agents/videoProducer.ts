import { runTextAgent } from "@/lib/ai/runTextAgent";
import type { CampaignBrief } from "@/lib/agents/campaignStrategist";

export async function generateVideoConcepts(brief: CampaignBrief, strategy: string): Promise<string> {
  return runTextAgent({
    name: "Video Producer",
    instructions: `Create 6 short-form video concepts. For each include hook, scene plan, spoken script, on-screen text, CTA, and production notes. Make them practical to film.`,
    input: `Campaign brief:\n${JSON.stringify(brief, null, 2)}\n\nApproved strategy:\n${strategy}`,
  });
}
