import { runTextAgent } from "@/lib/ai/runTextAgent";

export type CampaignBrief = {
  brandName: string;
  product: string;
  goal: string;
  audience: string;
  platforms: string[];
  campaignLength: string;
  budget?: string;
  tone?: string;
};

export async function generateCampaignStrategy(
  brief: CampaignBrief
): Promise<string> {
  return runTextAgent({
    name: "Campaign Strategist",

    instructions: `
You are LaunchAI's senior Campaign Strategist.

Create a focused, practical and brand-specific marketing campaign strategy.

Return these sections:

1. Campaign Concept
2. Primary Goal
3. Target Audience Insight
4. Core Message
5. Campaign Offer
6. Content Pillars
7. Platform Strategy
8. Recommended Content Schedule
9. Calls to Action
10. Key Performance Indicators

Avoid generic marketing advice.
Make every recommendation specific to the supplied campaign brief.
Write clearly and professionally.
`,

    input: `
Brand: ${brief.brandName}
Product or promotion: ${brief.product}
Campaign goal: ${brief.goal}
Target audience: ${brief.audience}
Platforms: ${brief.platforms.join(", ")}
Campaign length: ${brief.campaignLength}
Budget: ${brief.budget || "Not provided"}
Brand tone: ${brief.tone || "Not provided"}
`,
  });
}