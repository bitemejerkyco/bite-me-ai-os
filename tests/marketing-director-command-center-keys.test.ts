import { describe, expect, it } from "vitest";
import {
  normalizeProposalForRender,
  restoreConversationMessages,
  shouldSubmitOnKey,
} from "@/components/marketing-director/CommandCenter";

describe("marketing director command center keyboard behavior", () => {
  it("submits on Enter without Shift", () => {
    expect(shouldSubmitOnKey({ key: "Enter", shiftKey: false })).toBe(true);
  });

  it("does not submit on Shift+Enter", () => {
    expect(shouldSubmitOnKey({ key: "Enter", shiftKey: true })).toBe(false);
  });

  it("does not submit on non-enter keys", () => {
    expect(shouldSubmitOnKey({ key: "Tab", shiftKey: false })).toBe(false);
  });

  it("normalizes missing proposal arrays and optional strings safely", () => {
    const normalized = normalizeProposalForRender({
      title: "Legacy proposal",
      strategy: "single line strategy",
      summary: "Fallback summary",
      recommendedActions: [],
      requiredApprovals: undefined,
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.objectives).toEqual([]);
    expect(normalized?.weeklyPlan).toEqual([]);
    expect(normalized?.recommendations).toEqual([]);
    expect(normalized?.approvals).toEqual([]);
    expect(normalized?.strategy).toEqual(["single line strategy"]);
    expect(normalized?.executiveSummary).toBe("Fallback summary");
  });

  it("restores legacy session messages without crashing on sparse proposal shape", () => {
    const legacy = JSON.stringify([
      {
        id: "msg-1",
        role: "director",
        createdAt: "2026-08-01T00:00:00.000Z",
        request: "build a plan",
        response: {
          ok: true,
          proposal: {
            title: "Legacy plan",
            summary: "Older payload",
            strategy: "Keep consistency",
            recommendedActions: [],
          },
        },
      },
    ]);

    const restored = restoreConversationMessages(legacy);
    expect(restored).toHaveLength(1);
    expect(restored[0]?.response?.proposal).toBeDefined();

    const normalized = normalizeProposalForRender(restored[0]?.response?.proposal);
    expect(normalized?.objectives).toEqual([]);
    expect(normalized?.tasks).toEqual([]);
    expect(normalized?.calendar).toEqual([]);
    expect(normalized?.contentIdeas).toEqual([]);
    expect(normalized?.recommendations).toEqual([]);
  });
});
