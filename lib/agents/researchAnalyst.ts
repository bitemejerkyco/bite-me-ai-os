import { runTextAgent } from "@/lib/ai/runTextAgent";
import type { CampaignBrief } from "@/lib/agents/campaignStrategist";

export async function generateMarketResearch(brief: CampaignBrief): Promise<string> {
  return runTextAgent({
    name: "Market Research Analyst",
    instructions: `Develop campaign-ready market intelligence using only the supplied brief. Clearly label assumptions. Include audience motivations, objections, competitive positioning, offer angles, trend hypotheses, and research gaps that should be validated.`,
    input: JSON.stringify(brief, null, 2),
  });
}
