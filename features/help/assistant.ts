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

function toNumberedSteps(steps: string[]) {
  if (steps.length === 0) return "1. Open Help Center.\n2. Search the task you need.\n3. Follow the Quick Start steps.";
  return steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
}

function directAnswerForQuestion(question: string, fallback: string) {
  const text = question.toLowerCase();
  if (text.includes("what is this page")) return "This page is designed to help you complete the current workflow safely and quickly.";
  if (text.includes("what should i do next")) return "Use the recommended first action for this page, then continue through the Quick Start steps.";
  if (text.includes("how do i create content")) return "Create a campaign or objective first, then generate a draft in AI Studio and review it in Content Library.";
  if (text.includes("how do i approve a draft")) return "Open Approval Center or Content Library, review the draft details, then approve it before scheduling.";
  if (text.includes("how do i schedule a post")) return "Move an approved draft into Calendar, pick date/time/channel, then confirm scheduling.";
  if (text.includes("how do i upload my logo")) return "Open Media Library to upload your logo and brand assets, then use them in AI Studio.";
  if (text.includes("how do i add products")) return "Open Products and complete product setup so PostMotive can generate product-specific campaigns.";
  if (text.includes("how do i connect tiktok")) return "Open TikTok settings from Integrations and complete OAuth and permissions.";
  if (text.includes("how do credits work")) return "Credits are tracked by category in Billing Settings, including AI, video, publishing, and analytics balances.";
  if (text.includes("marketing score")) return "Marketing Score reflects setup quality, campaign activity, approvals, and connected data coverage.";
  if (text.includes("ai confidence")) return "AI Confidence indicates how much connected data supports the recommendation or content guidance.";
  return fallback;
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

  let directAnswer = "Use the documented page guidance and current workflow state to decide the next step.";
  if (question.toLowerCase().includes("what do i do on this page") && page) {
    directAnswer = `${page.shortDescription} Start with: ${page.recommendedFirstAction}`;
  } else if (steps.length > 0) {
    directAnswer = steps[0] || directAnswer;
  } else if (bestResult) {
    directAnswer = `${bestResult.title}: ${bestResult.body}`;
  }

  if (question.toLowerCase().includes("why can't i publish") && context.workflow) {
    const degraded = context.integrations.filter((item) => item.state !== "connected");
    const blockers: string[] = [];
    if ((context.workflow.pendingApprovals || 0) > 0) blockers.push(`${context.workflow.pendingApprovals} approval item(s) are still pending.`);
    if (degraded.length > 0) blockers.push(`Integration issues remain for ${degraded.map((item) => item.label).join(", ")}.`);
    directAnswer = blockers.length > 0
      ? `Publishing is usually blocked because ${blockers.join(" ")} Open the queue and integrations pages to clear those blockers first.`
      : "No obvious publish blocker was found in the current lightweight help context. Check the publishing queue and integrations pages for the exact item state.";
  }

  if (question.toLowerCase().includes("coming soon") || (directPage?.comingSoon || []).length > 0) {
    const soon = directPage?.comingSoon?.[0];
    if (soon && !directAnswer.includes(soon)) {
      directAnswer += ` Coming soon: ${soon}`;
    }
  }

  const finalDirectAnswer = directAnswerForQuestion(question, directAnswer);
  const numberedSteps = toNumberedSteps(steps);
  const relatedPageHref = directPage?.route || bestResult?.href || "/help";
  const academyHref = lesson ? `/academy?lesson=${lesson.lessonId}` : "/academy";

  const answer = [
    `1) ${finalDirectAnswer}`,
    "",
    "2) Steps",
    numberedSteps,
    "",
    `3) Related page: ${relatedPageHref}`,
    `4) Walkthrough: ${walkthrough ? "Start walkthrough is available." : "No walkthrough is available for this page yet."}`,
    `5) Academy: ${lesson ? `${lesson.title} (${academyHref})` : "Open Academy for the closest lesson."}`,
  ].join("\n");

  return {
    answer,
    route: directPage?.route || bestResult?.route || route,
    relatedPageLabel: directPage?.title || bestResult?.title || page?.title || "Help Center",
    relatedPageHref,
    startWalkthrough: walkthrough ? { id: walkthrough.id, title: walkthrough.title } : null,
    academyLesson: lesson ? { lessonId: lesson.lessonId, title: lesson.title, href: academyHref } : null,
    searchResults: results.slice(0, 5),
  };
}
