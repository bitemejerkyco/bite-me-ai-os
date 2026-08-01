import "server-only";

import { ACADEMY_LESSONS } from "@/features/help/academy-registry";
import { getPageHelp, normalizeHelpRoute } from "@/features/help/page-help-registry";
import { inferHelpRouteFromQuestion } from "@/features/help/question-routing";
import { searchHelpIndex } from "@/features/help/search";
import { getWalkthrough } from "@/features/help/walkthrough-registry";
import { loadHelpContext } from "@/features/help/server";

function conciseSteps(pageRoute: string, count = 3) {
  const page = getPageHelp(pageRoute);
  return (page?.quickStartSteps || []).slice(0, count).map((step) => `${step.title}: ${step.description}`);
}

export async function answerHelpQuestion(input: { route: string; question: string }) {
  const route = normalizeHelpRoute(input.route);
  const question = input.question.trim();
  const context = await loadHelpContext(route);
  const page = getPageHelp(route);
  const explicitRoute = inferHelpRouteFromQuestion(question);
  const relatedPage = explicitRoute ? getPageHelp(explicitRoute) : null;
  const results = searchHelpIndex(question);
  const bestResult = results[0] || null;
  const walkthrough = getWalkthrough(explicitRoute || route);

  const directPage = relatedPage || (bestResult?.route ? getPageHelp(bestResult.route) : page);
  const steps = conciseSteps(directPage?.route || route);
  const lesson = directPage?.academyLessonId
    ? ACADEMY_LESSONS.find((item) => item.lessonId === directPage.academyLessonId) || null
    : null;

  let answer = "Use the documented page guidance and current workflow state to decide the next step.";
  if (question.toLowerCase().includes("what do i do on this page") && page) {
    answer = `${page.shortDescription} Start with: ${page.recommendedFirstAction}`;
  } else if (steps.length > 0) {
    answer = steps.join(" ");
  } else if (bestResult) {
    answer = `${bestResult.title}: ${bestResult.body}`;
  }

  if (question.toLowerCase().includes("why can't i publish") && context.workflow) {
    const degraded = context.integrations.filter((item) => item.state !== "connected");
    const blockers: string[] = [];
    if ((context.workflow.pendingApprovals || 0) > 0) blockers.push(`${context.workflow.pendingApprovals} approval item(s) are still pending.`);
    if (degraded.length > 0) blockers.push(`Integration issues remain for ${degraded.map((item) => item.label).join(", ")}.`);
    answer = blockers.length > 0
      ? `Publishing is usually blocked because ${blockers.join(" ")} Open the queue and integrations pages to clear those blockers first.`
      : "No obvious publish blocker was found in the current lightweight help context. Check the publishing queue and integrations pages for the exact item state.";
  }

  if (question.toLowerCase().includes("coming soon") || (directPage?.comingSoon || []).length > 0) {
    const soon = directPage?.comingSoon?.[0];
    if (soon && !answer.includes(soon)) {
      answer += ` Coming soon: ${soon}`;
    }
  }

  return {
    answer,
    route: directPage?.route || bestResult?.route || route,
    relatedPageLabel: directPage?.title || bestResult?.title || page?.title || "Help Center",
    relatedPageHref: directPage?.route || bestResult?.href || "/help",
    startWalkthrough: walkthrough ? { id: walkthrough.id, title: walkthrough.title } : null,
    academyLesson: lesson ? { lessonId: lesson.lessonId, title: lesson.title, href: `/academy?lesson=${lesson.lessonId}` } : null,
    searchResults: results.slice(0, 5),
  };
}
