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
    expect(quoteVideoCredits(20)).toEqual({
      requiredCredits: 20,
      estimatedProviderCostCents: 1400,
    });
  });

  it("blocks insufficient balances and monthly overages", () => {
    expect(
      canStartVideoRender({ ...status, balanceCredits: 7 }, 8).allowed,
    ).toBe(false);
    expect(
      canStartVideoRender({ ...status, monthlyUsedCredits: 90 }, 16).allowed,
    ).toBe(false);
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
        20,
      ).allowed,
    ).toBe(true);
  });
});
