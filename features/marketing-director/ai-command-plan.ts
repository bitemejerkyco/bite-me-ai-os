import "server-only";

import type { MarketingDirectorDashboard } from "@/features/marketing-director/dashboard";
import type { MarketingModeSettings } from "@/features/marketing-director/modes";
import {
  buildStructuredMarketingPlan,
  classifyMarketingDirectorRequest,
  type MarketingDirectorRequestClass,
  type MarketingDirectorStructuredPlan,
} from "@/features/marketing-director/conversational-plan";

type AIWeeklyPlanItem = {
  week: string;
  focus: string;
  channels: string[];
  deliverables: string[];
};

type AITaskItem = {
  title: string;
  owner: string;
  dueWindow: string;
  priority: "critical" | "high" | "medium" | "low";
};

type AICalendarItem = {
  date: string;
  channel: string;
  asset: string;
  status: string;
};

type AIContentIdeaItem = {
  title: string;
  format: string;
  channel: string;
  angle: string;
};

type AICommandPlanSchema = {
  title: string;
  executiveSummary: string;
  objectives: string[];
  strategy: string[];
  weeklyPlan: AIWeeklyPlanItem[];
  tasks: AITaskItem[];
  calendar: AICalendarItem[];
  contentIdeas: AIContentIdeaItem[];
  recommendations: string[];
  approvals: string[];
  confidence: {
    scorePercent: number;
    rationale: string;
  };
};

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function toStringArray(value: unknown, maxItems: number, itemMaxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, itemMaxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function parsePlanPayload(input: unknown): AICommandPlanSchema | null {
  if (!input || typeof input !== "object") return null;
  const data = input as Record<string, unknown>;

  const title = cleanText(data.title, 160);
  const executiveSummary = cleanText(data.executiveSummary, 1200);
  const objectives = toStringArray(data.objectives, 12, 300);
  const strategy = toStringArray(data.strategy, 12, 300);
  const recommendations = toStringArray(data.recommendations, 20, 300);
  const approvals = toStringArray(data.approvals, 20, 300);

  const confidenceRaw = data.confidence && typeof data.confidence === "object"
    ? (data.confidence as Record<string, unknown>)
    : null;

  const confidence = {
    scorePercent: Math.max(0, Math.min(100, Number(confidenceRaw?.scorePercent || 0) || 0)),
    rationale: cleanText(confidenceRaw?.rationale, 300) || "AI-generated confidence rationale unavailable.",
  };

  const weeklyPlan = Array.isArray(data.weeklyPlan)
    ? data.weeklyPlan
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        return {
          week: cleanText(row.week, 40),
          focus: cleanText(row.focus, 220),
          channels: toStringArray(row.channels, 8, 80),
          deliverables: toStringArray(row.deliverables, 10, 160),
        };
      })
      .filter((item): item is AIWeeklyPlanItem => Boolean(item && item.week && item.focus))
      .slice(0, 8)
    : [];

  const tasks = Array.isArray(data.tasks)
    ? data.tasks
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const priorityValue = cleanText(row.priority, 20).toLowerCase();
        const priority = (priorityValue === "critical" || priorityValue === "high" || priorityValue === "medium" || priorityValue === "low")
          ? priorityValue
          : "medium";
        return {
          title: cleanText(row.title, 160),
          owner: cleanText(row.owner, 100) || "Marketing lead",
          dueWindow: cleanText(row.dueWindow, 100) || "This cycle",
          priority,
        };
      })
      .filter((item): item is AITaskItem => Boolean(item && item.title))
      .slice(0, 20)
    : [];

  const calendar = Array.isArray(data.calendar)
    ? data.calendar
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        return {
          date: cleanText(row.date, 80),
          channel: cleanText(row.channel, 80),
          asset: cleanText(row.asset, 180),
          status: cleanText(row.status, 60) || "approval_required",
        };
      })
      .filter((item): item is AICalendarItem => Boolean(item && item.date && item.channel && item.asset))
      .slice(0, 40)
    : [];

  const contentIdeas = Array.isArray(data.contentIdeas)
    ? data.contentIdeas
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        return {
          title: cleanText(row.title, 160),
          format: cleanText(row.format, 80),
          channel: cleanText(row.channel, 80),
          angle: cleanText(row.angle, 260),
        };
      })
      .filter((item): item is AIContentIdeaItem => Boolean(item && item.title && item.format && item.channel))
      .slice(0, 30)
    : [];

  if (!title || !executiveSummary) return null;

  return {
    title,
    executiveSummary,
    objectives,
    strategy,
    weeklyPlan,
    tasks,
    calendar,
    contentIdeas,
    recommendations,
    approvals,
    confidence,
  };
}

function extractResponseText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const response = value as {
    output_text?: unknown;
    output?: Array<{
      content?: Array<{ type?: string; text?: unknown }>;
    }>;
  };
  if (typeof response.output_text === "string") return response.output_text.trim();

  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => String(item.text).trim())
    .filter(Boolean)
    .join("\n");
}

function buildWorkspaceContextSummary(input: {
  dashboard: MarketingDirectorDashboard;
  workspaceName: string;
  requestClass: MarketingDirectorRequestClass;
  prompt: string;
}): string {
  const { dashboard } = input;
  const connectedChannels = dashboard.channelHealth
    .filter((channel) => channel.connected)
    .map((channel) => channel.label);

  const cardMap = new Map(dashboard.cards.map((card) => [card.id, card.value]));

  return [
    `Workspace: ${input.workspaceName}`,
    `User request: ${input.prompt}`,
    `Detected intent: ${input.requestClass}`,
    `Brand profile: ${dashboard.workspaceName} (user: ${dashboard.firstName})`,
    `Connected channels: ${connectedChannels.length > 0 ? connectedChannels.join(", ") : "none"}`,
    `Marketing score: ${cardMap.get("marketing_score") || "Unavailable"}`,
    `Calendar status: ${cardMap.get("scheduled_posts") || "Unavailable"}`,
    `Draft content queue: ${cardMap.get("content_awaiting_approval") || "Unavailable"}`,
    `Media library signal: ${dashboard.brief.performingWell.join(" ") || "Unavailable"}`,
    `Business goals context: ${dashboard.brief.recommendedNextAction?.title || "Not explicitly configured"}`,
    `Current situation: ${dashboard.brief.executiveNarrative}`,
    `Urgency: ${dashboard.brief.urgency.summary}`,
    `Data limitations: ${dashboard.brief.missingIntegrations.join(", ") || "No major limitations"}`,
  ].join("\n");
}

function buildAIPrompt(input: {
  prompt: string;
  requestClass: MarketingDirectorRequestClass;
  dashboard: MarketingDirectorDashboard;
  workspaceName: string;
}): string {
  const context = buildWorkspaceContextSummary({
    dashboard: input.dashboard,
    workspaceName: input.workspaceName,
    requestClass: input.requestClass,
    prompt: input.prompt,
  });

  return [
    "You are PostMotive's AI Marketing Director command planning engine.",
    "Build a practical, execution-ready plan using only provided workspace context.",
    "Never fabricate revenue, customer outcomes, campaign results, or integration status.",
    "Preserve safety and approval-gated execution.",
    "Return STRICT JSON only, no markdown.",
    "Required schema:",
    "{",
    "  \"title\": string,",
    "  \"executiveSummary\": string,",
    "  \"objectives\": string[],",
    "  \"strategy\": string[],",
    "  \"weeklyPlan\": [{\"week\": string, \"focus\": string, \"channels\": string[], \"deliverables\": string[]}],",
    "  \"tasks\": [{\"title\": string, \"owner\": string, \"dueWindow\": string, \"priority\": \"critical\"|\"high\"|\"medium\"|\"low\"}],",
    "  \"calendar\": [{\"date\": string, \"channel\": string, \"asset\": string, \"status\": string}],",
    "  \"contentIdeas\": [{\"title\": string, \"format\": string, \"channel\": string, \"angle\": string}],",
    "  \"recommendations\": string[],",
    "  \"approvals\": string[],",
    "  \"confidence\": {\"scorePercent\": number, \"rationale\": string}",
    "}",
    "Workspace context:",
    context,
  ].join("\n");
}

function applyAIPlanToStructuredPlan(input: {
  basePlan: MarketingDirectorStructuredPlan;
  aiPlan: AICommandPlanSchema;
}): MarketingDirectorStructuredPlan {
  return {
    ...input.basePlan,
    title: input.aiPlan.title,
    executiveSummary: input.aiPlan.executiveSummary,
    objectives: input.aiPlan.objectives.length > 0 ? input.aiPlan.objectives : input.basePlan.objectives,
    strategy: input.aiPlan.strategy.length > 0 ? input.aiPlan.strategy : input.basePlan.strategy,
    weeklyPlan: input.aiPlan.weeklyPlan.length > 0 ? input.aiPlan.weeklyPlan : input.basePlan.weeklyPlan,
    tasks: input.aiPlan.tasks.length > 0 ? input.aiPlan.tasks : input.basePlan.tasks,
    calendar: input.aiPlan.calendar.length > 0 ? input.aiPlan.calendar : input.basePlan.calendar,
    contentIdeas: input.aiPlan.contentIdeas.length > 0 ? input.aiPlan.contentIdeas : input.basePlan.contentIdeas,
    recommendations: input.aiPlan.recommendations.length > 0 ? input.aiPlan.recommendations : input.basePlan.recommendations,
    approvals: input.aiPlan.approvals.length > 0 ? input.aiPlan.approvals : input.basePlan.approvals,
    confidence: {
      scorePercent: input.aiPlan.confidence.scorePercent || input.basePlan.confidence.scorePercent,
      rationale: input.aiPlan.confidence.rationale || input.basePlan.confidence.rationale,
    },
    confidenceLevel: {
      ...input.basePlan.confidenceLevel,
      scorePercent: input.aiPlan.confidence.scorePercent || input.basePlan.confidenceLevel.scorePercent,
      reason: input.aiPlan.confidence.rationale || input.basePlan.confidenceLevel.reason,
    },
  };
}

export async function buildMarketingDirectorCommandPlan(input: {
  prompt: string;
  dashboard: MarketingDirectorDashboard;
  modeSettings: MarketingModeSettings;
  workspaceId: string;
  workspaceName: string;
}): Promise<{ plan: MarketingDirectorStructuredPlan; source: "ai" | "fallback" }> {
  const basePlan = buildStructuredMarketingPlan({
    prompt: input.prompt,
    dashboard: input.dashboard,
    modeSettings: input.modeSettings,
    workspaceId: input.workspaceId,
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { plan: basePlan, source: "fallback" };
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.6-sol";
  const requestClass = classifyMarketingDirectorRequest(input.prompt);
  const aiPrompt = buildAIPrompt({
    prompt: input.prompt,
    requestClass,
    dashboard: input.dashboard,
    workspaceName: input.workspaceName,
  });

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions:
          "You are a planning engine for PostMotive. Return strict JSON only with the requested schema. Use only provided context.",
        input: aiPrompt,
        max_output_tokens: 2200,
      }),
      cache: "no-store",
    });

    const payload: unknown = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return { plan: basePlan, source: "fallback" };
    }

    const rawText = extractResponseText(payload);
    const cleaned = rawText
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const parsed = parsePlanPayload(JSON.parse(cleaned) as unknown);
    if (!parsed) {
      return { plan: basePlan, source: "fallback" };
    }

    return {
      plan: applyAIPlanToStructuredPlan({ basePlan, aiPlan: parsed }),
      source: "ai",
    };
  } catch {
    return { plan: basePlan, source: "fallback" };
  }
}
