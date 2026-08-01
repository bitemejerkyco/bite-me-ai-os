import type { HelpMode } from "@/features/help/types";

export type TrainerSignalInput = {
  route: string;
  helpMode: HelpMode;
  proactiveTrainerEnabled: boolean;
  isSuperAdmin: boolean;
  visitCount: number;
  secondsOnPage: number;
  pendingApprovals: number;
  onboardingPercent: number;
  connectedIntegrations: number;
  walkthroughAbandoned: boolean;
  dismissed: boolean;
};

export type TrainerPrompt = {
  promptKey: string;
  title: string;
  message: string;
  route: string;
  suggestedWalkthroughId?: string;
};

export function resolveTrainerPrompt(input: TrainerSignalInput): TrainerPrompt | null {
  if (input.helpMode === "OFF") return null;
  if (!input.proactiveTrainerEnabled) return null;
  if (input.dismissed) return null;
  if (input.isSuperAdmin) return null;

  if (input.route === "/onboarding" && input.onboardingPercent < 100 && input.secondsOnPage >= 45) {
    return {
      promptKey: "onboarding-stuck",
      title: "Need help finishing setup?",
      message: "It looks like setup is still incomplete. Would you like a step-by-step walkthrough for Business Setup?",
      route: input.route,
    };
  }

  if (input.route === "/integrations" && input.connectedIntegrations === 0 && input.secondsOnPage >= 35) {
    return {
      promptKey: "integrations-first-channel",
      title: "Need help connecting a channel?",
      message: "It looks like you may be trying to connect your first marketing channel. Would you like a walkthrough or setup steps?",
      route: input.route,
      suggestedWalkthroughId: "integrations-overview",
    };
  }

  if (input.route === "/content" && input.visitCount >= 2 && input.secondsOnPage >= 35) {
    return {
      promptKey: "content-review-help",
      title: "Need help moving a draft forward?",
      message: "If you are reviewing your first draft, I can show you how approval and scheduling work from here.",
      route: input.route,
      suggestedWalkthroughId: "content-library-overview",
    };
  }

  if (input.route === "/" && input.pendingApprovals > 0 && input.secondsOnPage >= 30) {
    return {
      promptKey: "dashboard-approval-backlog",
      title: "There are approvals waiting",
      message: "You have pending approvals. Want a quick walkthrough of the dashboard and approval flow?",
      route: input.route,
      suggestedWalkthroughId: "dashboard-overview",
    };
  }

  if (input.walkthroughAbandoned && input.secondsOnPage >= 25) {
    return {
      promptKey: "resume-walkthrough",
      title: "Resume your walkthrough?",
      message: "You stopped a walkthrough earlier. Want to resume from where you left off?",
      route: input.route,
    };
  }

  return null;
}
