import { describe, expect, it } from "vitest";
import { resolveTrainerPrompt } from "@/features/help/trainer-rules";

describe("trainer rules", () => {
  it("stays quiet when help mode is off", () => {
    const result = resolveTrainerPrompt({
      route: "/integrations",
      helpMode: "OFF",
      proactiveTrainerEnabled: true,
      isSuperAdmin: false,
      visitCount: 1,
      secondsOnPage: 60,
      pendingApprovals: 0,
      onboardingPercent: 0,
      connectedIntegrations: 0,
      walkthroughAbandoned: false,
      dismissed: false,
    });

    expect(result).toBeNull();
  });

  it("prompts for first integration help when no channels are connected", () => {
    const result = resolveTrainerPrompt({
      route: "/integrations",
      helpMode: "AUTO",
      proactiveTrainerEnabled: true,
      isSuperAdmin: false,
      visitCount: 1,
      secondsOnPage: 40,
      pendingApprovals: 0,
      onboardingPercent: 50,
      connectedIntegrations: 0,
      walkthroughAbandoned: false,
      dismissed: false,
    });

    expect(result?.promptKey).toBe("integrations-first-channel");
  });

  it("does not proactively interrupt super admins", () => {
    const result = resolveTrainerPrompt({
      route: "/admin",
      helpMode: "AUTO",
      proactiveTrainerEnabled: true,
      isSuperAdmin: true,
      visitCount: 3,
      secondsOnPage: 120,
      pendingApprovals: 2,
      onboardingPercent: 100,
      connectedIntegrations: 1,
      walkthroughAbandoned: false,
      dismissed: false,
    });

    expect(result).toBeNull();
  });
});
