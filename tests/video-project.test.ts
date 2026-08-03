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

const exactProductInput = {
  ...input,
  productAsset: {
    id: "asset-1",
    name: "Trail jerky pack",
    storagePath: "workspace/user/asset-1.png",
    productMetadata: {
      productId: "prod-1",
      productName: "Trail Jerky",
      role: "PRIMARY" as const,
      angle: "FRONT",
      locked: true,
      approvedForGeneration: true,
      exactProductMode: true,
      allowAiMotion: false,
      preserveOriginalAsset: true,
      background: "neutral stone",
      position: "center frame",
      scale: "large and readable",
      safeArea: "leave room for captions",
    },
  },
  exactProductMode: true,
  allowAiProductMotion: false,
};

describe("video project foundation", () => {
  it("validates and prompts a safe vertical-video brief", () => {
    expect(parseVideoPlanInput(input)).toEqual(input);
    const prompt = buildVideoPlanningPrompt(input);
    expect(prompt).toContain("9:16");
    expect(prompt).toContain("copyrighted music");
    expect(prompt).toContain("12 seconds");
  });

  it("prompts exact product mode with the provided product asset", () => {
    const prompt = buildVideoPlanningPrompt(exactProductInput);
    expect(prompt).toContain("Exact product mode is required");
    expect(prompt).toContain("Trail jerky pack");
    expect(prompt).toContain("do not redraw packaging or logos");
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
            productAssetId: "asset-1",
            productAssetName: "Trail jerky pack",
            productMode: "EXACT_PRODUCT",
            productPlacement: "center frame",
            productScale: "large and readable",
            productBackground: "neutral stone",
            productSafeArea: "leave room for captions",
            productLocked: true,
            preserveOriginalAsset: true,
          },
        ],
      }),
    );
    expect(parsed?.scenes[0].seconds).toBe(8);
    expect(parsed?.hashtags).toEqual(["#trail", "#snack"]);
    expect(parsed?.callToAction).toBe("Shop now");
      expect(parsed?.scenes[0].productAssetId).toBe("asset-1");
      expect(parsed?.scenes[0].productMode).toBe("EXACT_PRODUCT");
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
