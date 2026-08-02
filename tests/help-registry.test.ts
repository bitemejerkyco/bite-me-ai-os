import { describe, expect, it } from "vitest";
import { PAGE_HELP_REGISTRY } from "@/features/help/page-help-registry";
import { ACADEMY_LESSONS } from "@/features/help/academy-registry";
import { WALKTHROUGH_REGISTRY } from "@/features/help/walkthrough-registry";
import { HELP_TERM_REGISTRY } from "@/features/help/term-registry";

describe("help registry coverage", () => {
  it("covers Monday priority primary routes", () => {
    const routes = new Set(PAGE_HELP_REGISTRY.map((entry) => entry.route));
    [
      "/",
      "/content",
      "/media",
      "/calendar",
      "/integrations",
      "/onboarding",
      "/settings/billing",
      "/studio",
      "/approvals",
      "/publishing-queue",
      "/notifications",
      "/help",
      "/academy",
      "/marketing",
      "/pricing",
    ].forEach((route) => expect(routes.has(route)).toBe(true));
  });

  it("links academy lessons that exist", () => {
    const lessonIds = new Set(ACADEMY_LESSONS.map((lesson) => lesson.lessonId));
    PAGE_HELP_REGISTRY.forEach((entry) => {
      if (entry.academyLessonId) {
        expect(lessonIds.has(entry.academyLessonId)).toBe(true);
      }
    });
  });

  it("references glossary terms that exist", () => {
    const terms = new Set(HELP_TERM_REGISTRY.map((term) => term.term));
    PAGE_HELP_REGISTRY.forEach((entry) => {
      entry.terminology.forEach((term) => {
        expect(terms.has(term.term)).toBe(true);
      });
    });
  });

  it("provides walkthroughs for Monday priority flows", () => {
    const walkthroughRoutes = new Set(WALKTHROUGH_REGISTRY.map((item) => item.route));
    ["/", "/content", "/integrations"].forEach((route) => {
      expect(walkthroughRoutes.has(route)).toBe(true);
    });
  });

  it("uses the expanded 8-step dashboard walkthrough with explicit help targets", () => {
    const dashboardWalkthrough = WALKTHROUGH_REGISTRY.find((entry) => entry.id === "dashboard-overview");
    expect(dashboardWalkthrough?.version).toBe("2");
    expect(dashboardWalkthrough?.steps.length).toBe(8);
    expect(dashboardWalkthrough?.steps.some((step) => step.title === "Ask Motive")).toBe(true);
    dashboardWalkthrough?.steps.forEach((step) => {
      expect(step.targetSelector.length).toBeGreaterThan(0);
    });
  });
});
