import { runTextAgent } from "@/lib/ai/runTextAgent";
import type { CampaignBrief } from "@/lib/agents/campaignStrategist";

export async function generateEmailSequence(brief: CampaignBrief, strategy: string): Promise<string> {
  return runTextAgent({
    name: "Email Specialist",
    instructions: `Create a conversion-focused email sequence. Include subject lines, preview text, complete email copy, CTA, and send timing for each email. Stay aligned with the strategy and brand tone.`,
    input: `Campaign brief:\n${JSON.stringify(brief, null, 2)}\n\nApproved strategy:\n${strategy}`,
  });
}
