import { describe, expect, it } from "vitest";
import {
  COMMAND_PROMPT_MAX_LENGTH,
  buildCommandPlan,
  classifyIntent,
} from "@/features/marketing-director/command-router";

describe("marketing director command router", () => {
  it("classifies campaign requests", () => {
    expect(classifyIntent("Create a launch campaign for spring"))
      .toBe("create_campaign");
  });

  it("builds proposal-only plans", () => {
    const plan = buildCommandPlan("Improve my marketing score this week");
    expect(plan.detectedIntent).toBe("improve_marketing_score");
    expect(plan.requiresApproval).toBe(true);
    expect(plan.unavailableActions).toContain("Publish without approval");
  });

  it("rejects empty prompts", () => {
    expect(() => buildCommandPlan("   ")).toThrow("COMMAND_INVALID");
  });

  it("rejects overlong prompts", () => {
    const tooLong = "x".repeat(COMMAND_PROMPT_MAX_LENGTH + 1);
    expect(() => buildCommandPlan(tooLong)).toThrow("COMMAND_TOO_LONG");
  });
});
