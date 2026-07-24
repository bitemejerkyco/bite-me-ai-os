import { generateCampaignStrategy, type CampaignBrief } from "@/lib/agents/campaignStrategist";
import { generateMarketResearch } from "@/lib/agents/researchAnalyst";
import { generateSocialContent } from "@/lib/agents/socialCopywriter";
import { generateEmailSequence } from "@/lib/agents/emailWriter";
import { generateVideoConcepts } from "@/lib/agents/videoProducer";
import { generateImagePrompts } from "@/lib/agents/imageDesigner";
import { generateContentCalendar } from "@/lib/agents/contentCalendar";
import { generateSeoPlan } from "@/lib/agents/seoSpecialist";

export type CampaignPackage = {
  research: string;
  strategy: string;
  social: string;
  email: string;
  video: string;
  images: string;
  seo: string;
  calendar: string;
};

export async function runCampaignOrchestrator(brief: CampaignBrief): Promise<CampaignPackage> {
  const research = await generateMarketResearch(brief);
  const strategy = await generateCampaignStrategy({
    ...brief,
    product: `${brief.product}\n\nMARKET RESEARCH:\n${research}`,
  });

  const [social, email, video, images, seo] = await Promise.all([
    generateSocialContent(brief, strategy),
    generateEmailSequence(brief, strategy),
    generateVideoConcepts(brief, strategy),
    generateImagePrompts(brief, strategy),
    generateSeoPlan(brief, strategy),
  ]);

  const calendar = await generateContentCalendar(
    brief,
    [research, strategy, social, email, video, images, seo].join("\n\n---\n\n")
  );

  return { research, strategy, social, email, video, images, seo, calendar };
}
