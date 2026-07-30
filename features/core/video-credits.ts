export const VIDEO_CREDITS_PER_SECOND = 1;
export const VIDEO_PROVIDER_COST_CENTS_PER_SECOND = 70;
export const VIDEO_STARTER_CREDITS = 20;
export const VIDEO_DEFAULT_MONTHLY_LIMIT = 100;

export type VideoCreditStatus = {
  balanceCredits: number;
  monthlyLimitCredits: number;
  monthlyUsedCredits: number;
  billingExempt: boolean;
  creditsPerSecond: number;
  providerCostCentsPerSecond: number;
};

export function quoteVideoCredits(seconds: number) {
  if (!Number.isInteger(seconds) || ![8, 16, 20].includes(seconds)) {
    throw new Error("Unsupported video duration.");
  }
  return {
    requiredCredits: seconds * VIDEO_CREDITS_PER_SECOND,
    estimatedProviderCostCents:
      seconds * VIDEO_PROVIDER_COST_CENTS_PER_SECOND,
  };
}

export function canStartVideoRender(
  status: VideoCreditStatus,
  seconds: number,
): { allowed: boolean; reason?: string } {
  if (status.billingExempt) return { allowed: true };
  const { requiredCredits } = quoteVideoCredits(seconds);
  if (status.balanceCredits < requiredCredits) {
    return {
      allowed: false,
      reason: `This video needs ${requiredCredits} credits. Add credits before generating.`,
    };
  }
  if (
    status.monthlyUsedCredits + requiredCredits >
    status.monthlyLimitCredits
  ) {
    return {
      allowed: false,
      reason:
        "This video would exceed the workspace monthly video limit. Increase the limit or wait for the next billing period.",
    };
  }
  return { allowed: true };
}
