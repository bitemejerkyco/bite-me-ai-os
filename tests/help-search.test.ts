import { describe, expect, it } from "vitest";
import { searchHelpIndex } from "@/features/help/search";

describe("help search", () => {
  it("finds TikTok guidance for connection queries", () => {
    const results = searchHelpIndex("Connect TikTok");
    expect(results[0]?.href).toBe("/settings/integrations/tiktok");
  });

  it("finds billing guidance for plan queries", () => {
    const results = searchHelpIndex("Change plans and buy credits");
    expect(results.some((result) => result.href === "/settings/billing")).toBe(true);
  });

  it("returns lesson results for learning queries", () => {
    const results = searchHelpIndex("Understand Marketing Score");
    expect(results.some((result) => result.kind === "lesson")).toBe(true);
  });
});
