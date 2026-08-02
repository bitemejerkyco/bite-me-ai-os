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
  channel: "Facebook Reels" as const,
  objective: "Engagement",
  message: "Show the product on a trail",
  callToAction: "Shop now",
  durationSeconds: 12 as const,
  voice: "marin" as const,
  musicMode: "GENERATED_AMBIENT" as const,
};

describe("video project foundation", () => {
  it("validates and prompts a safe vertical-video brief", () => {
    expect(parseVideoPlanInput(input)).toEqual(input);
    const prompt = buildVideoPlanningPrompt(input);
    expect(prompt).toContain("9:16");
    expect(prompt).toContain("copyrighted music");
    expect(prompt).toContain("12 seconds");
  });

  it("rejects unsupported durations", () => {
    expect(parseVideoPlanInput({ ...input, durationSeconds: 7 })).toBeNull();
    expect(parseVideoPlanInput({ ...input, durationSeconds: 16 })).toBeNull();
  });

  it("parses a structured scene plan", () => {
    const parsed = parseVideoPlanResponse(
      JSON.stringify({
        title: "Trail snack",
        script: "Ready to ride.",
        caption: "Trail fuel.",
        renderPrompt: "Vertical product video.",
        complianceNote: "Review.",
        hashtags: ["#trail", "#snack"],
        callToAction: "Shop now",
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
    expect(parsed?.hashtags).toEqual(["#trail", "#snack"]);
    expect(parsed?.callToAction).toBe("Shop now");
  });

  it("parses JSON wrapped in fenced markdown", () => {
    const parsed = parseVideoPlanResponse(
      "```json\n" +
        JSON.stringify({
          title: "Fenced plan",
          script: "Script",
          caption: "Caption",
          renderPrompt: "Prompt",
          complianceNote: "Review.",
          hashtags: ["#a"],
          callToAction: "Shop now",
          scenes: [
            {
              order: 1,
              seconds: 8,
              visual: "Visual",
              narration: "Narration",
              onScreenText: "Text",
            },
          ],
        }) +
        "\n```",
    );

    expect(parsed?.title).toBe("Fenced plan");
    expect(parsed?.scenes).toHaveLength(1);
  });

  it("extracts the first complete JSON object from surrounding text", () => {
    const parsed = parseVideoPlanResponse(
      `Here is your plan:\n${JSON.stringify({
        title: "Wrapped plan",
        script: "Script",
        caption: "Caption",
        renderPrompt: "Prompt",
        complianceNote: "Review.",
        hashtags: ["#wrapped"],
        callToAction: "Learn more",
        scenes: [
          {
            order: 1,
            seconds: 12,
            visual: "Wrapped visual",
            narration: "Narration",
            onScreenText: "Text",
          },
        ],
      })}\nThanks!`,
    );

    expect(parsed?.title).toBe("Wrapped plan");
    expect(parsed?.callToAction).toBe("Learn more");
  });

  it("fails when required fields are missing", () => {
    const parsed = parseVideoPlanResponse(
      JSON.stringify({
        title: "Bad plan",
        script: "Script",
        caption: "Caption",
        hashtags: ["#a"],
        callToAction: "Shop now",
        scenes: [
          {
            order: 1,
            seconds: 8,
            visual: "Visual",
            narration: "Narration",
            onScreenText: "Text",
          },
        ],
      }),
    );

    expect(parsed).toBeNull();
  });
});
