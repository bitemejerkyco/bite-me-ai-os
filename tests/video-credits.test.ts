import { describe, expect, it } from "vitest";
import {
  canStartVideoRender,
  quoteVideoCredits,
  type VideoCreditStatus,
} from "../features/core/video-credits";

const status: VideoCreditStatus = {
  balanceCredits: 20,
  monthlyLimitCredits: 100,
  monthlyUsedCredits: 0,
  billingExempt: false,
  creditsPerSecond: 1,
  providerCostCentsPerSecond: 70,
};

describe("video credits", () => {
  it("quotes credits and current provider cost deterministically", () => {
    expect(quoteVideoCredits(8)).toEqual({
      requiredCredits: 8,
      estimatedProviderCostCents: 560,
    });
    expect(quoteVideoCredits(10)).toEqual({
      requiredCredits: 10,
      estimatedProviderCostCents: 700,
    });
    expect(quoteVideoCredits(12)).toEqual({
      requiredCredits: 12,
      estimatedProviderCostCents: 840,
    });
    expect(quoteVideoCredits(15)).toEqual({
      requiredCredits: 15,
      estimatedProviderCostCents: 1050,
    });
  });

  it("blocks insufficient balances and monthly overages", () => {
    expect(
      canStartVideoRender({ ...status, balanceCredits: 7 }, 8).allowed,
    ).toBe(false);
    expect(
      canStartVideoRender({ ...status, monthlyUsedCredits: 90 }, 12).allowed,
    ).toBe(false);
  });

  it("rejects unsupported durations", () => {
    expect(() => quoteVideoCredits(7)).toThrow("Unsupported video duration.");
    expect(() => quoteVideoCredits(16)).toThrow("Unsupported video duration.");
  });

  it("never blocks billing-exempt super admins", () => {
    expect(
      canStartVideoRender(
        {
          ...status,
          balanceCredits: 0,
          monthlyLimitCredits: 0,
          billingExempt: true,
        },
        15,
      ).allowed,
    ).toBe(true);
  });
});
