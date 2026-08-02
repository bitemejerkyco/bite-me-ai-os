"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MarketingDirectorStructuredPlan } from "@/features/marketing-director/conversational-plan";
import { inferHelpRouteFromQuestion } from "@/features/help/question-routing";
import { normalizeHelpRoute } from "@/features/help/page-help-registry";
import RecommendationActionCard from "@/components/marketing-director/RecommendationActionCard";
import AIThinkingProgress from "@/components/marketing-director/AIThinkingProgress";
import {
  buildDefaultRecommendationEntitlements,
  buildRecommendationRuntime,
  type RecommendationActionModel,
  type RecommendationActionKind,
} from "@/features/marketing-director/recommendation-workflows";

type ResponseState = {
  ok: boolean;
  code?: string;
  message?: string;
  error?: string;
  proposal?: MarketingDirectorStructuredPlan;
};

type ConversationMessage = {
  id: string;
  role: "user" | "director";
  createdAt: string;
  request?: string;
  response?: ResponseState;
  commandId?: string | null;
};

type ProposalForRender = {
  title: string;
  executiveSummary: string;
  objectives: string[];
  strategy: string[];
  weeklyPlan: Array<{ week: string; focus: string; channels: string[]; deliverables: string[] }>;
  tasks: Array<{ title: string; owner: string; dueWindow: string; priority: string }>;
  calendar: Array<{ date: string; channel: string; asset: string; status: string }>;
  contentIdeas: Array<{ title: string; format: string; channel: string; angle: string }>;
  recommendations: string[];
  approvals: string[];
  confidence: {
    scorePercent: number;
    rationale: string;
  };
  requestSummary: string;
  currentSituation: string;
  whyItMatters: string;
  recommendedActions: MarketingDirectorStructuredPlan["recommendedActions"];
  requiredApprovals: string[];
  expectedDataLimitations: string[];
  confidenceLevel: MarketingDirectorStructuredPlan["confidenceLevel"];
  nextBestAction: string;
  planId: string;
  generatedAt: string;
};

type ActionRequest = {
  commandId: string;
  actionId: string;
  type: "approve" | "reject";
};

type GeneratedDraftState = {
  draftId: string;
  title: string;
  status: string;
  approvalStatus: string;
  platform: string;
};

const STORAGE_KEY = "postmotive-marketing-director-conversation-v2";
const LEGACY_STORAGE_KEY = "postmotive_marketing_director_conversation_v1";
const COMMAND_SUGGESTIONS = [
  "Build my September campaign",
  "Launch our Labor Day promotion",
  "Increase Amazon sales",
  "Improve my Marketing Score",
  "Find my biggest weakness",
  "Prepare next week's content",
  "Analyze Facebook performance",
  "Create a TikTok strategy",
  "Build a Q4 marketing plan",
  "Generate a customer retention campaign",
  "Review pending content",
];

function getSessionValue(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(key);
}

function setSessionValue(key: string, value: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, value);
}

function removeSessionValue(key: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(key);
}

function messageId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function shouldSubmitOnKey(event: { key: string; shiftKey: boolean }): boolean {
  return event.key === "Enter" && !event.shiftKey;
}

export { shouldSubmitOnKey };

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asText(item).trim()).filter(Boolean);
}

function normalizeProposalForRender(value: unknown): ProposalForRender | null {
  if (!value || typeof value !== "object") return null;

  const proposal = value as Record<string, unknown>;
  const title = asText(proposal.title) || "Marketing Director Plan";
  const executiveSummary = asText(proposal.executiveSummary) || asText(proposal.summary) || "";
  const strategyRaw = proposal.strategy;
  const strategy = Array.isArray(strategyRaw)
    ? asTextArray(strategyRaw)
    : asText(strategyRaw)
      ? [asText(strategyRaw)]
      : [];

  const objectives = Array.isArray(proposal.objectives)
    ? asTextArray(proposal.objectives)
    : [];

  const weeklyPlan = Array.isArray(proposal.weeklyPlan)
    ? proposal.weeklyPlan
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        return {
          week: asText(row.week),
          focus: asText(row.focus),
          channels: asTextArray(row.channels),
          deliverables: asTextArray(row.deliverables),
        };
      })
      .filter((item): item is ProposalForRender["weeklyPlan"][number] => Boolean(item && item.week && item.focus))
    : [];

  const tasks = Array.isArray(proposal.tasks)
    ? proposal.tasks
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        return {
          title: asText(row.title),
          owner: asText(row.owner),
          dueWindow: asText(row.dueWindow),
          priority: asText(row.priority),
        };
      })
      .filter((item): item is ProposalForRender["tasks"][number] => Boolean(item && item.title))
    : [];

  const calendar = Array.isArray(proposal.calendar)
    ? proposal.calendar
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        return {
          date: asText(row.date),
          channel: asText(row.channel),
          asset: asText(row.asset),
          status: asText(row.status),
        };
      })
      .filter((item): item is ProposalForRender["calendar"][number] => Boolean(item && item.date && item.channel && item.asset))
    : [];

  const contentIdeas = Array.isArray(proposal.contentIdeas)
    ? proposal.contentIdeas
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        return {
          title: asText(row.title),
          format: asText(row.format),
          channel: asText(row.channel),
          angle: asText(row.angle),
        };
      })
      .filter((item): item is ProposalForRender["contentIdeas"][number] => Boolean(item && item.title && item.format && item.channel))
    : [];

  const recommendations = Array.isArray(proposal.recommendations)
    ? asTextArray(proposal.recommendations)
    : [];

  const approvals = Array.isArray(proposal.approvals)
    ? asTextArray(proposal.approvals)
    : [];

  const recommendedActions = Array.isArray(proposal.recommendedActions)
    ? (proposal.recommendedActions as MarketingDirectorStructuredPlan["recommendedActions"])
    : [];

  const requiredApprovals = Array.isArray(proposal.requiredApprovals)
    ? asTextArray(proposal.requiredApprovals)
    : [];

  const expectedDataLimitations = Array.isArray(proposal.expectedDataLimitations)
    ? asTextArray(proposal.expectedDataLimitations)
    : [];

  const confidenceRaw = proposal.confidence && typeof proposal.confidence === "object"
    ? proposal.confidence as Record<string, unknown>
    : null;
  const confidenceLevelRaw = proposal.confidenceLevel && typeof proposal.confidenceLevel === "object"
    ? proposal.confidenceLevel as Record<string, unknown>
    : null;

  const confidence = {
    scorePercent: Number(confidenceRaw?.scorePercent || confidenceLevelRaw?.scorePercent || 0),
    rationale: asText(confidenceRaw?.rationale) || asText(confidenceLevelRaw?.reason),
  };

  const confidenceLevel: MarketingDirectorStructuredPlan["confidenceLevel"] = {
    scorePercent: Number(confidenceLevelRaw?.scorePercent || confidence.scorePercent || 0),
    label: ((): "high" | "moderate" | "limited" => {
      const value = asText(confidenceLevelRaw?.label).toLowerCase();
      if (value === "high" || value === "moderate" || value === "limited") return value;
      const score = Number(confidenceLevelRaw?.scorePercent || confidence.scorePercent || 0);
      if (score >= 75) return "high";
      if (score >= 45) return "moderate";
      return "limited";
    })(),
    reason: asText(confidenceLevelRaw?.reason) || confidence.rationale || "",
  };

  const planId = asText(proposal.planId) || "legacy-plan";
  const generatedAt = asText(proposal.generatedAt) || new Date(0).toISOString();

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
    requestSummary: asText(proposal.requestSummary) || asText(proposal.summary),
    currentSituation: asText(proposal.currentSituation),
    whyItMatters: asText(proposal.whyItMatters),
    recommendedActions,
    requiredApprovals,
    expectedDataLimitations,
    confidenceLevel,
    nextBestAction: asText(proposal.nextBestAction),
    planId,
    generatedAt,
  };
}

function restoreConversationMessages(saved: string | null): ConversationMessage[] {
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed.reduce<ConversationMessage[]>((acc, item) => {
      if (!item || typeof item !== "object") return acc;
      const row = item as Record<string, unknown>;
      const role = row.role === "director" ? "director" : row.role === "user" ? "user" : null;
      if (!role) return acc;
      const id = asText(row.id);
      const createdAt = asText(row.createdAt);
      if (!id || !createdAt) return acc;

      const responseRaw = row.response && typeof row.response === "object"
        ? row.response as Record<string, unknown>
        : null;

      const normalizedProposal = responseRaw?.proposal ? normalizeProposalForRender(responseRaw.proposal) : null;
      if (responseRaw?.proposal && !normalizedProposal) {
        return acc;
      }

      acc.push({
        id,
        role,
        createdAt,
        request: asText(row.request) || undefined,
        response: responseRaw
          ? {
              ok: Boolean(responseRaw.ok),
              code: asText(responseRaw.code) || undefined,
              message: asText(responseRaw.message) || undefined,
              error: asText(responseRaw.error) || undefined,
              proposal: (normalizedProposal as unknown as MarketingDirectorStructuredPlan) || undefined,
            }
          : undefined,
        commandId: asText(row.commandId) || null,
      });

        return acc;
      }, []);
  } catch {
    return [];
  }
}

export { normalizeProposalForRender, restoreConversationMessages };

function suggestedPlatformForAction(action: MarketingDirectorStructuredPlan["recommendedActions"][number]): string {
  const text = `${action.title} ${action.description} ${action.target}`.toLowerCase();
  if (text.includes("tiktok")) return "tiktok";
  if (text.includes("linkedin")) return "linkedin";
  if (text.includes("facebook")) return "facebook";
  if (text.includes("instagram")) return "instagram";
  if (text.includes("amazon")) return "amazon_listing";
  if (text.includes("email")) return "email";
  if (text.includes("sms")) return "sms";
  if (text.includes("landing")) return "landing_page";
  if (text.includes("blog")) return "blog";
  if (text.includes("ad") || text.includes("campaign")) return "ad_copy";
  return "instagram";
}

function modeFromLabel(label: string): "advisor" | "copilot" | "autopilot" {
  const value = String(label || "").trim().toLowerCase();
  if (value === "copilot") return "copilot";
  if (value === "autopilot") return "autopilot";
  return "advisor";
}

function normalizeActionRoute(action: MarketingDirectorStructuredPlan["recommendedActions"][number]): string {
  const inferred = inferHelpRouteFromQuestion(`${action.title} ${action.description}`);
  if (inferred) return inferred;
  return normalizeHelpRoute(action.target || "/");
}

export default function CommandCenter(props: { modeLabel: string; canViewTechnicalDetails: boolean }) {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>(() => {
    if (typeof window === "undefined") return [];
    const currentSaved = getSessionValue(STORAGE_KEY);
    const legacySaved = getSessionValue(LEGACY_STORAGE_KEY);
    const restored = restoreConversationMessages(currentSaved ?? legacySaved);
    return restored;
  });
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState("");
  const [pendingAction, setPendingAction] = useState<ActionRequest | null>(null);
  const [pendingGenerateTaskId, setPendingGenerateTaskId] = useState<string | null>(null);
  const [generatedDraftByTask, setGeneratedDraftByTask] = useState<Record<string, GeneratedDraftState>>({});
  const endRef = useRef<HTMLDivElement | null>(null);

  const latestDirectorMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "director" && message.response?.proposal),
    [messages],
  );

  const recentRequests = useMemo(
    () => [...messages].reverse().filter((message) => message.role === "user" && message.request).slice(0, 4),
    [messages],
  );

  useEffect(() => {
    setSessionValue(STORAGE_KEY, JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function callEndpoint(url: string, body: Record<string, unknown>): Promise<ResponseState> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
      message?: string;
      error?: string;
      proposal?: MarketingDirectorStructuredPlan;
      commandId?: string;
    } | null;

    if (!response.ok || !payload?.ok) {
      return { ok: false, code: payload?.code, error: payload?.error || "Request failed." };
    }

    return {
      ok: true,
      code: payload.code,
      message: payload.message,
      proposal: payload.proposal,
    };
  }

  const submit = async () => {
    if (!prompt.trim()) {
      setError("Enter a command request first.");
      return;
    }

    const requestText = prompt.trim();
    setError(null);
    setLastRequest(requestText);
    setPrompt("");

    setMessages((current) => [
      ...current,
      {
        id: messageId("user"),
        role: "user",
        createdAt: new Date().toISOString(),
        request: requestText,
      },
    ]);

    setSubmitting(true);
    try {
      const response = await fetch("/api/marketing-director/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: requestText }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        code?: string;
        message?: string;
        error?: string;
        proposal?: MarketingDirectorStructuredPlan;
        commandId?: string | null;
      } | null;

      const nextState: ResponseState = !response.ok || !payload?.ok
        ? { ok: false, code: payload?.code, error: payload?.error || "Unable to create proposal." }
        : { ok: true, code: payload.code, message: payload.message, proposal: payload.proposal };

      if (!nextState.ok) {
        setError(nextState.error || "Unable to create proposal.");
      }

      setMessages((current) => [
        ...current,
        {
          id: messageId("director"),
          role: "director",
          createdAt: new Date().toISOString(),
          request: requestText,
          response: nextState,
          commandId: payload?.commandId || null,
        },
      ]);
    } catch {
      setError("Network error while sending command.");
    } finally {
      setSubmitting(false);
    }
  };

  const regenerate = async () => {
    const latest = latestDirectorMessage;
    const requestText = (latest?.request || lastRequest || prompt).trim();
    if (!requestText) {
      setError("Enter a request before regenerating.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await callEndpoint("/api/marketing-director/command/regenerate", {
        commandId: latest?.commandId,
        prompt: requestText,
      });

      if (!response.ok) {
        setError(response.error || "Unable to regenerate plan.");
      }

      setMessages((current) => [
        ...current,
        {
          id: messageId("director"),
          role: "director",
          createdAt: new Date().toISOString(),
          request: requestText,
          response,
          commandId: response.proposal?.planId || latest?.commandId || null,
        },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const clearConversation = async () => {
    setMessages([]);
    setError(null);
    setLastRequest("");
    removeSessionValue(STORAGE_KEY);
    removeSessionValue(LEGACY_STORAGE_KEY);
    try {
      await fetch("/api/marketing-director/command/clear-session", { method: "POST" });
    } catch {
      // Ignore clear-session network errors.
    }
  };

  const runAction = async (input: ActionRequest) => {
    setPendingAction(input);
    setError(null);
    try {
      const url = input.type === "approve"
        ? "/api/marketing-director/command/approve"
        : "/api/marketing-director/command/reject";

      const response = await callEndpoint(url, {
        commandId: input.commandId,
        actionId: input.actionId,
      });

      if (!response.ok) {
        setError(response.error || "Unable to process action.");
      }

      setMessages((current) => [
        ...current,
        {
          id: messageId("director"),
          role: "director",
          createdAt: new Date().toISOString(),
          request: latestDirectorMessage?.request || lastRequest,
          response,
          commandId: input.commandId,
        },
      ]);
    } finally {
      setPendingAction(null);
    }
  };

  const runRecommendationAction = async (input: {
    proposal: ProposalForRender;
    action: MarketingDirectorStructuredPlan["recommendedActions"][number];
    actionKind: RecommendationActionKind;
    deferUntil?: string;
  }) => {
    setPendingAction({ commandId: latestDirectorMessage?.commandId || "", actionId: input.action.id, type: "approve" });
    setError(null);

    try {
      const response = await fetch("/api/marketing-director/recommendations/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId: input.proposal.planId,
          actionId: input.action.id,
          actionKind: input.actionKind,
          deferUntil: input.deferUntil,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        code?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setError(payload?.error || "Unable to update recommendation.");
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: messageId("director"),
          role: "director",
          createdAt: new Date().toISOString(),
          request: latestDirectorMessage?.request || lastRequest,
          response: {
            ok: true,
            code: payload.code,
            message:
              input.actionKind === "DEFER"
                ? "Recommendation deferred."
                : input.actionKind === "DISMISS"
                  ? "Recommendation dismissed."
                  : "Recommendation updated.",
            proposal: input.proposal as unknown as MarketingDirectorStructuredPlan,
          },
          commandId: latestDirectorMessage?.commandId || null,
        },
      ]);
    } finally {
      setPendingAction(null);
    }
  };

  const generateContent = async (input: {
    proposal: ProposalForRender;
    action: MarketingDirectorStructuredPlan["recommendedActions"][number];
    regenerate?: boolean;
  }) => {
    setPendingGenerateTaskId(input.action.id);
    setError(null);

    try {
      const response = await fetch("/api/marketing-director/generate-content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId: input.proposal.planId,
          taskId: input.action.id,
          platform: suggestedPlatformForAction(input.action),
          regenerate: Boolean(input.regenerate),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        draft?: {
          id?: string;
          title?: string;
          status?: string;
          approvalStatus?: string;
        };
        asset?: {
          platform?: string;
          title?: string;
        };
      } | null;

      if (!response.ok || !payload?.ok || !payload.draft?.id) {
        setError(payload?.error || "Unable to generate content.");
        return;
      }

      setGeneratedDraftByTask((current) => ({
        ...current,
        [input.action.id]: {
          draftId: String(payload.draft?.id || ""),
          title: String(payload.draft?.title || payload.asset?.title || input.action.title),
          status: String(payload.draft?.status || "DRAFT"),
          approvalStatus: String(payload.draft?.approvalStatus || "DRAFT"),
          platform: String(payload.asset?.platform || suggestedPlatformForAction(input.action)),
        },
      }));
    } catch {
      setError("Unable to generate content.");
    } finally {
      setPendingGenerateTaskId(null);
    }
  };

  return (
    <section data-help="dashboard-command-center" className="pm-glass-premium rounded-[2rem] border border-white/90 bg-white/85 p-5" aria-label="Marketing Director conversation panel" id="command-center">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Executive Command Center</p>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
          {props.modeLabel}
        </span>
      </div>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">Ask your AI Marketing Director anything</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Describe the result you want. PostMotive builds strategy, highlights risks, and recommends the highest-impact next move.
      </p>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Prompt suggestions">
        {COMMAND_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setPrompt(suggestion)}
            className="pm-lift rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {recentRequests.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recent commands</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recentRequests.map((message) => (
              <button
                key={message.id}
                type="button"
                onClick={() => setPrompt(message.request || "")}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-violet-300 hover:text-violet-700"
              >
                {message.request}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPrompt(lastRequest || "")}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          Edit request
        </button>
        <button
          type="button"
          onClick={() => void regenerate()}
          disabled={submitting || (!latestDirectorMessage && !lastRequest)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Regenerate plan
        </button>
        <button
          type="button"
          onClick={() => clearConversation()}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          Clear history
        </button>
        <button
          type="button"
          onClick={() => setPrompt("")}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          New request
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <p className="text-xs text-slate-500">Press Enter to send instantly. Shift+Enter adds a new line.</p>
      </div>

      <input
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (shouldSubmitOnKey({ key: event.key, shiftKey: event.shiftKey })) {
            event.preventDefault();
            void submit();
          }
        }}
        maxLength={500}
        className="mt-3 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        placeholder="Increase my Amazon sales this month"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{prompt.length} / 500</p>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="pm-primary-button rounded-xl px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Preparing strategy..." : "Prepare strategy"}
        </button>
      </div>

      <div className="mt-3">
        <AIThinkingProgress active={submitting} title="AI strategy pipeline" />
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {messages.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Start with a specific business outcome.</p>
          <p className="mt-1">Example: &quot;Increase Amazon revenue by 15% this month with a campaign and posting plan.&quot;</p>
        </div>
      ) : null}

      <div className="mt-4 max-h-[30rem] space-y-3 overflow-y-auto pr-1" role="log" aria-live="polite" aria-label="Conversation messages">
        {messages.map((message) => (
          message.role === "user" ? (
            <article key={message.id} className="ml-6 rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">You</p>
              <p className="mt-1 text-sm text-slate-800">{message.request}</p>
            </article>
          ) : (
            <article key={message.id} className="mr-6 rounded-2xl border border-violet-100 bg-violet-50/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">Marketing Director</p>
              {!message.response?.ok || !message.response.proposal || !normalizeProposalForRender(message.response.proposal) ? (
                <p className="mt-1 text-sm text-rose-700">{message.response?.error || "Unable to generate plan."}</p>
              ) : (
                <div className="mt-2 space-y-2 text-sm text-slate-800">
                  {(() => {
                    const proposal = normalizeProposalForRender(message.response?.proposal);
                    if (!proposal) {
                      return <p className="mt-1 text-sm text-rose-700">Unable to generate plan.</p>;
                    }

                    const objectives = Array.isArray(proposal?.objectives)
                      ? proposal.objectives
                      : [];

                    const weeklyPlan = Array.isArray(proposal?.weeklyPlan)
                      ? proposal.weeklyPlan
                      : [];

                    const tasks = Array.isArray(proposal?.tasks)
                      ? proposal.tasks
                      : [];

                    const calendar = Array.isArray(proposal?.calendar)
                      ? proposal.calendar
                      : [];

                    const contentIdeas = Array.isArray(proposal?.contentIdeas)
                      ? proposal.contentIdeas
                      : [];

                    const recommendations = Array.isArray(proposal?.recommendations)
                      ? proposal.recommendations
                      : [];

                    const approvals = Array.isArray(proposal?.approvals)
                      ? proposal.approvals
                      : [];

                    return (
                      <>
                  <p><span className="font-semibold">Plan title:</span> {proposal?.title ?? "Marketing Director Plan"}</p>
                  <p><span className="font-semibold">Executive summary:</span> {proposal?.executiveSummary ?? proposal?.requestSummary ?? ""}</p>
                  {objectives.length > 0 ? (
                    <div>
                      <p className="font-semibold">Objectives:</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {objectives.map((objective) => (
                          <li key={objective}>{objective}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {proposal?.strategy.length > 0 ? (
                    <div>
                      <p className="font-semibold">Strategy:</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {proposal.strategy.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {weeklyPlan.length > 0 ? (
                    <div>
                      <p className="font-semibold">Weekly plan:</p>
                      <ul className="mt-1 space-y-2">
                        {weeklyPlan.map((week) => (
                          <li key={week.week} className="rounded-xl border border-slate-200 bg-white/85 p-2">
                            <p className="font-semibold text-slate-900">{week.week}: {week.focus}</p>
                            <p className="text-xs text-slate-600">Channels: {week.channels.join(", ")}</p>
                            <p className="text-xs text-slate-600">Deliverables: {week.deliverables.join(" · ")}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {tasks.length > 0 ? (
                    <div>
                      <p className="font-semibold">Tasks:</p>
                      <ul className="mt-1 space-y-1">
                        {tasks.map((task) => (
                          <li key={`${task.title}_${task.dueWindow}`} className="text-slate-700">
                            {task.title} ({task.priority}, {task.owner}, {task.dueWindow})
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {calendar.length > 0 ? (
                    <div>
                      <p className="font-semibold">Calendar:</p>
                      <ul className="mt-1 space-y-1">
                        {calendar.map((entry) => (
                          <li key={`${entry.date}_${entry.channel}_${entry.asset}`} className="text-slate-700">
                            {entry.date} · {entry.channel} · {entry.asset} ({entry.status})
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {contentIdeas.length > 0 ? (
                    <div>
                      <p className="font-semibold">Content ideas:</p>
                      <ul className="mt-1 space-y-1">
                        {contentIdeas.map((idea) => (
                          <li key={`${idea.title}_${idea.channel}`} className="text-slate-700">
                            {idea.title} ({idea.format}, {idea.channel}) - {idea.angle}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {recommendations.length > 0 ? (
                    <div>
                      <p className="font-semibold">Recommendations:</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {recommendations.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {approvals.length > 0 ? (
                    <div>
                      <p className="font-semibold">Approvals:</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {approvals.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <p><span className="font-semibold">Plan confidence:</span> {proposal.confidence.scorePercent}% - {proposal.confidence.rationale}</p>
                  <p><span className="font-semibold">Request summary:</span> {proposal.requestSummary}</p>
                  <p><span className="font-semibold">Current situation:</span> {proposal.currentSituation}</p>
                  <p><span className="font-semibold">Why it matters:</span> {proposal.whyItMatters}</p>
                  <div>
                    <p className="font-semibold">Recommended actions:</p>
                    <ul className="mt-1 space-y-2">
                      {proposal.recommendedActions.map((action) => {
                        const runtime = buildRecommendationRuntime({
                          recommendation: action,
                          route: normalizeActionRoute(action),
                          source: action.supportingData,
                          operatingMode: modeFromLabel(props.modeLabel),
                          entitlements: {
                            ...buildDefaultRecommendationEntitlements(),
                            canPublish: modeFromLabel(props.modeLabel) !== "advisor",
                          },
                          draftId: generatedDraftByTask[action.id]?.draftId || null,
                          approvalStatus: generatedDraftByTask[action.id]?.approvalStatus || null,
                        });

                        const openActionHref = (actionItem: RecommendationActionModel) => {
                          if (!actionItem.href) return;
                          window.location.assign(actionItem.href);
                        };

                        return (
                          <RecommendationActionCard
                            key={action.id}
                            action={action}
                            runtime={runtime}
                            canViewTechnicalDetails={props.canViewTechnicalDetails}
                            pendingGenerate={pendingGenerateTaskId === action.id}
                            pendingAction={Boolean(pendingAction)}
                            onGenerate={() => void generateContent({ proposal, action })}
                            onRegenerate={() => void generateContent({ proposal, action, regenerate: true })}
                            onApprove={() => {
                              if (!message.commandId) return;
                              void runAction({ commandId: message.commandId, actionId: action.id, type: "approve" });
                            }}
                            onReject={() => {
                              if (!message.commandId) return;
                              void runAction({ commandId: message.commandId, actionId: action.id, type: "reject" });
                            }}
                            onDismiss={() => void runRecommendationAction({ proposal, action, actionKind: "DISMISS" })}
                            onDefer={() => {
                              const tomorrow = new Date();
                              tomorrow.setDate(tomorrow.getDate() + 1);
                              void runRecommendationAction({
                                proposal,
                                action,
                                actionKind: "DEFER",
                                deferUntil: tomorrow.toISOString(),
                              });
                            }}
                            onPublishNow={() => void runRecommendationAction({ proposal, action, actionKind: "PUBLISH_NOW" })}
                            onOpenActionHref={openActionHref}
                            generatedDraft={generatedDraftByTask[action.id] ? {
                              draftId: generatedDraftByTask[action.id].draftId,
                              title: generatedDraftByTask[action.id].title,
                              approvalStatus: generatedDraftByTask[action.id].approvalStatus,
                            } : undefined}
                          />
                        );
                      })}
                    </ul>
                  </div>
                  <p><span className="font-semibold">Next best action:</span> {proposal.nextBestAction}</p>
                  {proposal.requiredApprovals.length > 0 ? (
                    <div>
                      <p className="font-semibold">Required approvals:</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {proposal.requiredApprovals.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {props.canViewTechnicalDetails ? (
                    <details className="rounded-xl border border-slate-200 bg-white/75 p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-700">Technical details</summary>
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        <p>Plan ID: {proposal.planId}</p>
                        <p>Generated: {new Date(proposal.generatedAt).toLocaleString()}</p>
                        <p>Confidence: {proposal.confidenceLevel.scorePercent}% ({proposal.confidenceLevel.label})</p>
                        {proposal.expectedDataLimitations.length > 0 ? <p>Expected data limitations: {proposal.expectedDataLimitations.join(" ")}</p> : null}
                      </div>
                    </details>
                  ) : null}
                      </>
                    );
                  })()}
                </div>
              )}
            </article>
          )
        ))}
        <div ref={endRef} />
      </div>
    </section>
  );
}
