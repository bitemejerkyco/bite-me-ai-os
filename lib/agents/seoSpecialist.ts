import { runTextAgent } from "@/lib/ai/runTextAgent";
import type { CampaignBrief } from "@/lib/agents/campaignStrategist";

export async function generateSeoPlan(brief: CampaignBrief, strategy: string): Promise<string> {
  return runTextAgent({
    name: "SEO Specialist",
    instructions: `Create an actionable organic-search plan. Include keyword clusters, search intent, page recommendations, title and meta examples, blog topics, internal links, and measurement priorities. Avoid claiming live keyword volumes.`,
    input: `Campaign brief:\n${JSON.stringify(brief, null, 2)}\n\nApproved strategy:\n${strategy}`,
  });
}
