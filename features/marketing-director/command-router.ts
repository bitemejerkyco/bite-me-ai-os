export type MarketingDirectorIntent =
  | "create_campaign"
  | "create_content_plan"
  | "plan_content"
  | "improve_marketing_score"
  | "analyze_performance"
  | "analyze_channels"
  | "launch_product"
  | "increase_sales"
  | "amazon_growth"
  | "create_tiktok_plan"
  | "optimize_amazon_ads"
  | "unknown";

export type CommandRouterResult = {
  detectedIntent: MarketingDirectorIntent;
  summary: string;
  proposedSteps: string[];
  requiredInformation: string[];
  estimatedCreditUsage: number;
  requiresApproval: boolean;
  availableActions: string[];
  unavailableActions: string[];
};

export const COMMAND_PROMPT_MAX_LENGTH = 500;

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase();
}

function hasAny(prompt: string, terms: string[]): boolean {
  return terms.some((term) => prompt.includes(term));
}

export function classifyIntent(prompt: string): MarketingDirectorIntent {
  const value = normalizePrompt(prompt);
  if (hasAny(value, ["campaign", "launch campaign", "promotion calendar", "marketing plan", "promotion"])) return "create_campaign";
  if (hasAny(value, ["content plan", "30 days", "content calendar", "content strategy", "pending content", "review pending content"])) return "create_content_plan";
  if (hasAny(value, ["prepare content", "plan content", "prepare next week", "next week's content", "schedule content"])) return "plan_content";
  if (hasAny(value, ["improve my marketing score", "improve marketing score", "score", "weakness", "weakest", "biggest weakness"])) return "improve_marketing_score";
  if (hasAny(value, ["analyze facebook", "analyze instagram", "analyze tiktok", "analyze youtube", "analyze channel", "channel performance", "facebook performance", "instagram performance", "tiktok performance", "youtube performance"])) return "analyze_channels";
  if (hasAny(value, ["analyze", "performance", "what happened", "diagnose"])) return "analyze_performance";
  if (hasAny(value, ["launch product", "new product", "product drop"])) return "launch_product";
  if (hasAny(value, ["amazon sales", "amazon revenue", "amazon growth", "increase amazon", "grow amazon", "boost amazon"])) return "amazon_growth";
  if (hasAny(value, ["increase sales", "grow sales", "boost revenue"])) return "increase_sales";
  if (hasAny(value, ["tiktok", "short-form", "reels plan"])) return "create_tiktok_plan";
  if (hasAny(value, ["amazon", "ppc", "acos", "roas", "sponsored products"])) return "optimize_amazon_ads";
  return "unknown";
}

function template(intent: MarketingDirectorIntent): Omit<CommandRouterResult, "detectedIntent"> {
  switch (intent) {
    case "plan_content":
      return {
        summary: "Plan and prepare upcoming content for connected channels.",
        proposedSteps: [
          "Review the current draft backlog and recent publishing history.",
          "Propose a short-term content schedule with themes by channel.",
          "Queue draft requests for approval before scheduling.",
        ],
        requiredInformation: ["Posting cadence", "Channel priority", "Upcoming dates or events"],
        estimatedCreditUsage: 0,
        requiresApproval: true,
        availableActions: ["Draft content schedule", "Queue content prompts"],
        unavailableActions: ["Auto-schedule posts", "Auto-publish content"],
      };
    case "analyze_channels":
      return {
        summary: "Analyze performance on specific connected channels.",
        proposedSteps: [
          "Review available analytics data for the selected channel.",
          "Identify performance trends, gaps, and top-performing content.",
          "Propose channel-specific improvement actions for manual review.",
        ],
        requiredInformation: ["Channel name", "Date range", "Primary metric"],
        estimatedCreditUsage: 0,
        requiresApproval: true,
        availableActions: ["Open channel analytics", "Create channel action plan"],
        unavailableActions: ["Auto-adjust channel settings", "Auto-publish responses"],
      };
    case "amazon_growth":
      return {
        summary: "Identify Amazon sales growth opportunities from available channel data.",
        proposedSteps: [
          "Review current Amazon Ads performance and organic sales trends.",
          "Identify top opportunities for revenue growth and waste reduction.",
          "Prepare a prioritized growth plan for manual review and approval.",
        ],
        requiredInformation: ["Sales target", "Primary ASINs", "Budget guardrails"],
        estimatedCreditUsage: 0,
        requiresApproval: true,
        availableActions: ["Open Amazon insights", "Build Amazon growth plan"],
        unavailableActions: ["Apply ad changes automatically", "Auto-adjust budgets"],
      };
    case "create_campaign":
      return {
        summary: "Build a campaign brief, channel mix, and publishing checklist.",
        proposedSteps: [
          "Review current audience, objective, and available approved content.",
          "Propose a campaign timeline and content volume by channel.",
          "Prepare a review checklist for approvals before any scheduling.",
        ],
        requiredInformation: ["Primary offer", "Target audience", "Campaign deadline"],
        estimatedCreditUsage: 0,
        requiresApproval: true,
        availableActions: ["Draft campaign brief", "Draft schedule proposal"],
        unavailableActions: ["Publish campaign automatically", "Change ad budgets"],
      };
    case "create_content_plan":
      return {
        summary: "Create a multi-week content plan tailored to connected channels.",
        proposedSteps: [
          "Audit current draft inventory and recent engagement signals.",
          "Propose weekly themes and post volume per active channel.",
          "Prepare an approval queue for new draft generation requests.",
        ],
        requiredInformation: ["Preferred channels", "Publishing cadence", "Seasonal priorities"],
        estimatedCreditUsage: 0,
        requiresApproval: true,
        availableActions: ["Generate plan outline", "Queue draft prompts"],
        unavailableActions: ["Auto-schedule content", "Auto-publish posts"],
      };
    case "improve_marketing_score":
      return {
        summary: "Focus on the lowest Marketing Score categories with clear action steps.",
        proposedSteps: [
          "Identify lowest score categories and evidence.",
          "Prioritize actions that raise connected data confidence first.",
          "Draft a 7-day improvement checklist with owner and due date.",
        ],
        requiredInformation: ["Team owner", "Preferred channels", "Approval turnaround"],
        estimatedCreditUsage: 0,
        requiresApproval: true,
        availableActions: ["Open score breakdown", "Create improvement checklist"],
        unavailableActions: ["Modify integrations automatically", "Publish without approval"],
      };
    case "analyze_performance":
      return {
        summary: "Analyze current performance using available connected analytics.",
        proposedSteps: [
          "Compare current period metrics with recent historical baseline when available.",
          "Flag underperforming workflows and integration gaps.",
          "Propose corrective actions with confidence notes.",
        ],
        requiredInformation: ["Analysis window", "Primary KPI", "Channel focus"],
        estimatedCreditUsage: 0,
        requiresApproval: true,
        availableActions: ["Open analytics summary", "Create action plan"],
        unavailableActions: ["Auto-adjust ad budgets", "Auto-stop campaigns"],
      };
    case "launch_product":
      return {
        summary: "Prepare a product launch plan with channel and creative recommendations.",
        proposedSteps: [
          "Confirm launch objective and available assets.",
          "Propose launch phases: teaser, launch day, follow-up.",
          "Prepare required approvals for content and scheduling.",
        ],
        requiredInformation: ["Launch date", "Offer details", "Creative assets"],
        estimatedCreditUsage: 0,
        requiresApproval: true,
        availableActions: ["Draft launch plan", "Draft content brief"],
        unavailableActions: ["Auto-publish launch posts", "Auto-spend ad budget"],
      };
    case "increase_sales":
      return {
        summary: "Recommend sales growth actions based on channel coverage and campaign readiness.",
        proposedSteps: [
          "Review current conversion and revenue coverage health.",
          "Prioritize channels with strongest connected data and execution readiness.",
          "Create a weekly execution checklist with explicit approvals.",
        ],
        requiredInformation: ["Sales target", "Primary product", "Budget guardrails"],
        estimatedCreditUsage: 0,
        requiresApproval: true,
        availableActions: ["Generate sales improvement plan"],
        unavailableActions: ["Change budget settings", "Auto-launch ads"],
      };
    case "create_tiktok_plan":
      return {
        summary: "Build a TikTok draft-delivery plan for the current workspace.",
        proposedSteps: [
          "Check TikTok connection health and pending inbox jobs.",
          "Propose a short-form content calendar and asset checklist.",
          "Queue approval steps before scheduling or upload actions.",
        ],
        requiredInformation: ["Posting cadence", "Product focus", "Creative style"],
        estimatedCreditUsage: 0,
        requiresApproval: true,
        availableActions: ["Open TikTok upload workflow", "Draft TikTok plan"],
        unavailableActions: ["Auto-upload videos", "Auto-publish in TikTok"],
      };
    case "optimize_amazon_ads":
      return {
        summary: "Propose Amazon Ads optimization steps from read-only insights.",
        proposedSteps: [
          "Review ACOS, ROAS, and search-term waste from available insights.",
          "Propose keyword and budget hypotheses for manual review.",
          "Prepare a staged test plan with expected non-fabricated impact labels.",
        ],
        requiredInformation: ["Target ACOS", "Primary ASINs", "Review cadence"],
        estimatedCreditUsage: 0,
        requiresApproval: true,
        availableActions: ["Open Amazon insights", "Build optimization checklist"],
        unavailableActions: ["Apply keyword changes automatically", "Auto-adjust bids"],
      };
    case "unknown":
    default:
      return {
        summary: "Interpret the objective and propose a safe next-step plan.",
        proposedSteps: [
          "Clarify the target outcome and timeline.",
          "Map the request to available connected channels and data.",
          "Return a proposal for review before any execution.",
        ],
        requiredInformation: ["Business objective", "Timeline", "Preferred channels"],
        estimatedCreditUsage: 0,
        requiresApproval: true,
        availableActions: ["Generate proposal"],
        unavailableActions: ["Publish content automatically", "Change budgets automatically"],
      };
  }
}

export function buildCommandPlan(prompt: string): CommandRouterResult {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error("COMMAND_INVALID:Prompt is required.");
  }
  if (trimmed.length > COMMAND_PROMPT_MAX_LENGTH) {
    throw new Error(`COMMAND_TOO_LONG:Prompt must be ${COMMAND_PROMPT_MAX_LENGTH} characters or fewer.`);
  }

  const detectedIntent = classifyIntent(trimmed);
  const base = template(detectedIntent);
  return {
    detectedIntent,
    ...base,
  };
}
