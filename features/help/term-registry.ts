import type { HelpTermDefinition } from "@/features/help/types";

export const HELP_TERM_REGISTRY: HelpTermDefinition[] = [
  { term: "Marketing Score", definition: "A weighted snapshot of how complete and healthy your marketing setup is right now." },
  { term: "Marketing Health", definition: "A plain-language summary of whether content, channels, approvals, and publishing are running smoothly." },
  { term: "AI Confidence", definition: "How strongly PostMotive trusts the available data behind a recommendation or score." },
  { term: "Executive Brief", definition: "A daily summary of priorities, risks, and recommended next actions for your workspace." },
  { term: "Advisor Mode", definition: "The safest mode. PostMotive suggests work, but people still decide what happens next." },
  { term: "Copilot Mode", definition: "A guided mode where PostMotive helps draft work and structure actions, but approvals still matter." },
  { term: "Autopilot", definition: "The highest automation setting. It still respects approvals, entitlements, and policy limits." },
  { term: "Workflow", definition: "A tracked series of actions such as planning, drafting, approval, scheduling, and publishing." },
  { term: "Approval", definition: "A required human decision before a draft, schedule, or recommendation can move forward." },
  { term: "Draft", definition: "Content that exists in editable form and is not published yet." },
  { term: "Scheduled", definition: "Content with a planned publish date and time." },
  { term: "Publishing Queue", definition: "The set of items that are waiting to prepare, hand off, retry, or finish publishing." },
  { term: "Integration Health", definition: "The current status of a connected provider, including connection quality, missing permissions, and recent failures." },
  { term: "Credits", definition: "The usage units available to your workspace for AI, video, publishing, or analytics actions." },
  { term: "AI Credits", definition: "Units used by text, image, or planning actions powered by AI." },
  { term: "Video Credits", definition: "Units used by video generation and related render actions." },
  { term: "Data Coverage", definition: "How much real business, content, channel, and analytics data PostMotive can use in its recommendations." },
  { term: "ROAS", definition: "Return on ad spend, or how much revenue was generated for each dollar spent on ads." },
  { term: "ACOS", definition: "Advertising cost of sales, or the share of sales spent on ads." },
  { term: "CTR", definition: "Click-through rate, or how often people click after seeing an ad or post." },
  { term: "Conversion Rate", definition: "The percentage of people who take the action you wanted after clicking or visiting." },
  { term: "Content Readiness", definition: "A quick signal showing whether a draft is ready for review, approval, and scheduling." },
  { term: "Compliance Mode", definition: "Industry-aware safeguards that change guidance for regulated or sensitive marketing categories." },
  { term: "Marketing Memory", definition: "The record of approved patterns, successful content, and signals used to improve future recommendations." },
  { term: "Director Activity", definition: "A timeline of actions, approvals, and system events related to the Marketing Director." },
  { term: "Approval Required", definition: "A label that means a person must review the action before it can continue." },
  { term: "Connected Channel", definition: "A platform, account, or provider that is authorized and available for data or publishing work." },
];

export function getHelpTerm(term: string): HelpTermDefinition | null {
  const normalized = term.trim().toLowerCase();
  return HELP_TERM_REGISTRY.find((item) => item.term.toLowerCase() === normalized) || null;
}
