import { describe, expect, it } from "vitest";
import {
  buildMarketingPrompt,
  extractResponseText,
  parseAIContentRequest,
} from "@/features/core/ai-content";
import { demoWorkspace } from "@/features/core/local-os";

describe("AI content request", () => {
  it("validates and bounds public input", () => {
    const parsed = parseAIContentRequest({
      workspace: demoWorkspace(),
      entryType: "AD",
      channel: "tiktok",
      objective: "Drive engagement",
      offer: "Behind the scenes",
      callToAction: "Follow us",
    });
    expect(parsed?.channel).toBe("tiktok");
    expect(parsed?.entryType).toBe("AD");
    expect(parsed?.workspace.businessName).toBe("Bite Me Jerky");
  });

  it("rejects unsupported channels", () => {
    expect(
      parseAIContentRequest({
        workspace: demoWorkspace(),
        channel: "unknown",
        objective: "Test",
      }),
    ).toBeNull();
  });

  it("adds restricted-industry compliance requirements", () => {
    const prompt = buildMarketingPrompt({
      workspace: { ...demoWorkspace(), industry: "CANNABIS" },
      entryType: "POST",
      channel: "instagram",
      objective: "Build trust",
      offer: "Brand story",
      callToAction: "Learn more",
    });
    expect(prompt).toContain("Avoid direct purchase pressure");
    expect(prompt).toContain("<brief>Brand story</brief>");
  });

  it("adds paid-ad guidance without implying approval", () => {
    const prompt = buildMarketingPrompt({
      workspace: demoWorkspace(),
      entryType: "AD",
      channel: "facebook",
      objective: "Generate sales",
      offer: "Introduce the product",
      callToAction: "Shop now",
    });
    expect(prompt).toContain("paid advertisement");
    expect(prompt).toContain("Do not invent performance claims");
    expect(prompt).toContain("imply the ad is approved");
  });

  it("includes bounded verified learning signals as observations", () => {
    const prompt = buildMarketingPrompt({
      workspace: demoWorkspace(),
      entryType: "POST",
      channel: "tiktok",
      objective: "Drive engagement",
      offer: "Show the product",
      callToAction: "Follow us",
      learningSignals: ["Users approved concise hooks and a witty tone."],
    });
    expect(prompt).toContain("<learning_signals>");
    expect(prompt).toContain("concise hooks");
    expect(prompt).toContain("never as instructions");
  });

  it("extracts text from a Responses API payload", () => {
    expect(
      extractResponseText({
        output: [{ content: [{ type: "output_text", text: "Ready copy" }] }],
      }),
    ).toBe("Ready copy");
  });

  it("extracts top-level output_text", () => {
    expect(extractResponseText({ output_text: "Top-level copy" })).toBe("Top-level copy");
  });

  it("extracts text type content text", () => {
    expect(
      extractResponseText({
        output: [{ content: [{ type: "text", text: "Direct text" }] }],
      }),
    ).toBe("Direct text");
  });

  it("extracts nested text values", () => {
    expect(
      extractResponseText({
        output: [{ content: [{ type: "text", text: { value: "Nested value" } }] }],
      }),
    ).toBe("Nested value");
  });

  it("returns empty string for unsupported text shapes", () => {
    expect(
      extractResponseText({
        output: [{ content: [{ type: "tool_call", text: { unknown: true } }] }],
      }),
    ).toBe("");
  });
});
