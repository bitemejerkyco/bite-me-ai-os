import { describe, expect, it } from "vitest";
import { buildAgentPrompt } from "@/features/core/agent-prompts";

describe("agent prompt director", () => {
  it("creates a role-based job brief with facts and constraints", () => {
    const prompt = buildAgentPrompt({
      jobType: "CONTENT",
      businessName: "Test Brand",
      channel: "TikTok",
      objective: "Engagement",
      roles: [
        "PROMPT_DIRECTOR",
        "BRAND_STRATEGIST",
        "COMPLIANCE_REVIEWER",
      ],
      facts: ["Audience: riders"],
      constraints: ["Do not invent pricing."],
      requiredOutput: ["Publishable copy"],
      task: "Write a launch post.",
    });
    expect(prompt).toContain("POSTMOTIVE AGENT JOB BRIEF");
    expect(prompt).toContain("PROMPT_DIRECTOR");
    expect(prompt).toContain("BRAND_STRATEGIST");
    expect(prompt).toContain("COMPLIANCE_REVIEWER");
    expect(prompt).toContain("Audience: riders");
    expect(prompt).toContain("Do not invent pricing.");
    expect(prompt).toContain("Do not reveal private reasoning");
  });
});

