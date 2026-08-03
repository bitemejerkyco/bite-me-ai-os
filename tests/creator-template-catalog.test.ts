import { describe, expect, it } from "vitest";
import {
  CREATOR_TEMPLATES,
  listTemplatesForMode,
  resolveCreatorTemplate,
} from "@/features/core/creator-template-catalog";

describe("creator template catalog", () => {
  it("contains five starter templates", () => {
    expect(CREATOR_TEMPLATES).toHaveLength(5);
  });

  it("filters templates by creation mode", () => {
    const memeTemplates = listTemplatesForMode("ANIMATED_MEME");
    expect(memeTemplates).toHaveLength(1);
    expect(memeTemplates[0]?.id).toBe("template-meme-remix");
  });

  it("resolves unknown template ids to a safe default", () => {
    const fallback = resolveCreatorTemplate("missing-template");
    expect(fallback.id).toBe("template-pattern-interrupt");
  });
});
