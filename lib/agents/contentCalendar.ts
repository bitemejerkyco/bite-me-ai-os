import { runTextAgent } from "@/lib/ai/runTextAgent";
import type { CampaignBrief } from "@/lib/agents/campaignStrategist";

export async function generateContentCalendar(brief: CampaignBrief, completedSections: string): Promise<string> {
  return runTextAgent({
    name: "Content Planner",
    instructions: `Create a coordinated content calendar for the requested campaign length. Use a clear day-by-day format with channel, asset, objective, CTA, and dependencies.`,
    input: `Campaign brief:\n${JSON.stringify(brief, null, 2)}\n\nCompleted campaign sections:\n${completedSections}`,
  });
}
