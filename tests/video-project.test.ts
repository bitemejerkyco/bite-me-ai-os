import { describe, expect, it } from "vitest";
import {
  buildVideoPlanningPrompt,
  parseVideoPlanResponse,
  parseVideoPlanInput,
} from "@/features/core/video-project";

const input = {
  workspace: {
    businessName: "Bite Me Jerky",
    website: "https://example.com",
    industry: "FOOD_BEVERAGE" as const,
    primaryGoal: "Sales",
    audience: "riders",
    voice: "bold",
    completedAt: "2026-07-29T00:00:00.000Z",
  },
  channel: "TikTok" as const,
  objective: "Engagement",
  message: "Show the product on a trail",
  callToAction: "Shop now",
  durationSeconds: 16 as const,
  voice: "marin" as const,
  musicMode: "GENERATED_AMBIENT" as const,
};

describe("video project foundation", () => {
  it("validates and prompts a safe vertical-video brief", () => {
    expect(parseVideoPlanInput(input)).toEqual(input);
    const prompt = buildVideoPlanningPrompt(input);
    expect(prompt).toContain("9:16");
    expect(prompt).toContain("copyrighted music");
    expect(prompt).toContain("16 seconds");
  });

  it("parses a structured scene plan", () => {
    const parsed = parseVideoPlanResponse(
      JSON.stringify({
        title: "Trail snack",
        script: "Ready to ride.",
        caption: "Trail fuel.",
        renderPrompt: "Vertical product video.",
        complianceNote: "Review.",
        scenes: [
          {
            order: 1,
            seconds: 8,
            visual: "Product on a rock",
            narration: "Ready.",
            onScreenText: "Trail ready",
          },
        ],
      }),
    );
    expect(parsed?.scenes[0].seconds).toBe(8);
  });
});
