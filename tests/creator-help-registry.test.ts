import { describe, expect, it } from "vitest";
import { ACADEMY_LESSONS } from "@/features/help/academy-registry";
import { PAGE_HELP_REGISTRY } from "@/features/help/page-help-registry";

describe("creator help registry coverage", () => {
  it("includes creator hub page help entries", () => {
    const routes = new Set(PAGE_HELP_REGISTRY.map((entry) => entry.route));
    [
      "/creators",
      "/creators/discover",
      "/creators/pipeline",
      "/creators/campaigns",
      "/creators/content-review",
      "/creators/ugc",
      "/creators/analytics",
    ].forEach((route) => expect(routes.has(route)).toBe(true));
  });

  it("includes creator academy lessons", () => {
    const lessonIds = new Set(ACADEMY_LESSONS.map((lesson) => lesson.lessonId));
    [
      "creator-marketing-intro",
      "creator-find-right-fit",
      "creator-outreach-management",
      "creator-campaign-builder",
      "creator-content-review",
      "creator-roi-analysis",
      "creator-usage-rights",
    ].forEach((lessonId) => expect(lessonIds.has(lessonId)).toBe(true));
  });
});
