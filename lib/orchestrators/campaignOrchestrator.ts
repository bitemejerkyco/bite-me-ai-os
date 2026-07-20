import { generateCampaignStrategy, type CampaignBrief } from "@/lib/agents/campaignStrategist";
import { generateSocialContent } from "@/lib/agents/socialCopywriter";
import { generateEmailSequence } from "@/lib/agents/emailWriter";
import { generateVideoConcepts } from "@/lib/agents/videoProducer";
import { generateImagePrompts } from "@/lib/agents/imageDesigner";
import { generateContentCalendar } from "@/lib/agents/contentCalendar";

export type CampaignPackage = {
  strategy: string;
  social: string;
  email: string;
  video: string;
  images: string;
  calendar: string;
};

export async function runCampaignOrchestrator(brief: CampaignBrief): Promise<CampaignPackage> {
  const strategy = await generateCampaignStrategy(brief);

  const [social, email, video, images] = await Promise.all([
    generateSocialContent(brief, strategy),
    generateEmailSequence(brief, strategy),
    generateVideoConcepts(brief, strategy),
    generateImagePrompts(brief, strategy),
  ]);

  const calendar = await generateContentCalendar(
    brief,
    [strategy, social, email, video, images].join("\n\n---\n\n")
  );

  return { strategy, social, email, video, images, calendar };
}
