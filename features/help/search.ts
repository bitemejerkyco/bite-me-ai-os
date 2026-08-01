import { ACADEMY_LESSONS } from "@/features/help/academy-registry";
import { getPageHelp, PAGE_HELP_REGISTRY } from "@/features/help/page-help-registry";
import { HELP_TERM_REGISTRY } from "@/features/help/term-registry";
import type { HelpSearchResult } from "@/features/help/types";

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
}

function score(queryTokens: string[], haystack: string, boosts: Array<[string, number]> = []): number {
  const normalized = haystack.toLowerCase();
  let total = 0;
  for (const token of queryTokens) {
    if (normalized.includes(token)) total += 2;
  }
  for (const [text, weight] of boosts) {
    const lower = text.toLowerCase();
    for (const token of queryTokens) {
      if (lower.includes(token)) total += weight;
    }
  }
  return total;
}

export function searchHelpIndex(query: string): HelpSearchResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const results: HelpSearchResult[] = [];

  for (const page of PAGE_HELP_REGISTRY) {
    const baseText = [
      page.title,
      page.shortDescription,
      page.purpose,
      page.whyItMatters,
      page.recommendedFirstAction,
      page.tips.join(" "),
      page.quickStartSteps.map((step) => `${step.title} ${step.description}`).join(" "),
      page.commonQuestions.map((item) => `${item.question} ${item.answer}`).join(" "),
      page.terminology.map((item) => `${item.term} ${item.definition}`).join(" "),
    ].join(" ");

    const baseScore = score(queryTokens, baseText, [
      [page.title, 5],
      [page.shortDescription, 3],
      [page.recommendedFirstAction, 3],
    ]);

    if (baseScore > 0) {
      results.push({
        id: `page:${page.id}`,
        kind: "page",
        title: page.title,
        body: page.shortDescription,
        href: page.route,
        route: page.route,
        relatedLessonId: page.academyLessonId,
        score: baseScore,
      });
    }

    page.quickStartSteps.forEach((step) => {
      const stepScore = score(queryTokens, `${page.title} ${step.title} ${step.description}`, [[step.title, 4]]);
      if (stepScore > 0) {
        results.push({
          id: `step:${page.id}:${step.id}`,
          kind: "step",
          title: `${page.title}: ${step.title}`,
          body: step.description,
          href: step.route || page.route,
          route: page.route,
          relatedLessonId: page.academyLessonId,
          score: stepScore,
        });
      }
    });

    page.commonQuestions.forEach((item, index) => {
      const faqScore = score(queryTokens, `${item.question} ${item.answer}`, [[item.question, 4]]);
      if (faqScore > 0) {
        results.push({
          id: `faq:${page.id}:${index}`,
          kind: "faq",
          title: item.question,
          body: item.answer,
          href: page.route,
          route: page.route,
          relatedLessonId: page.academyLessonId,
          score: faqScore,
        });
      }
    });
  }

  for (const lesson of ACADEMY_LESSONS) {
    const lessonText = [
      lesson.title,
      lesson.summary,
      lesson.category,
      lesson.learningObjectives.join(" "),
      lesson.steps.map((step) => `${step.title} ${step.description}`).join(" "),
    ].join(" ");
    const lessonScore = score(queryTokens, lessonText, [[lesson.title, 5], [lesson.summary, 3]]);
    if (lessonScore > 0) {
      results.push({
        id: `lesson:${lesson.lessonId}`,
        kind: "lesson",
        title: lesson.title,
        body: lesson.summary,
        href: `/academy?lesson=${lesson.lessonId}`,
        relatedLessonId: lesson.lessonId,
        route: lesson.relatedRoutes[0] || "/academy",
        score: lessonScore,
      });
    }
  }

  for (const term of HELP_TERM_REGISTRY) {
    const termScore = score(queryTokens, `${term.term} ${term.definition}`, [[term.term, 6]]);
    if (termScore > 0) {
      const page = getPageHelp("/");
      results.push({
        id: `term:${term.term}`,
        kind: "term",
        title: term.term,
        body: term.definition,
        href: page?.route || "/help",
        route: "/help",
        score: termScore,
      });
    }
  }

  return results.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, 30);
}
