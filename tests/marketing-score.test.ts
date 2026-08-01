import { describe, expect, it } from "vitest";
import {
  MARKETING_SCORE_WEIGHTS,
  marketingWeightTotal,
  scoreHealthStatus,
  summarizeConfidence,
  toCategoryResult,
} from "@/features/marketing-director/marketing-score-rules";

describe("marketing score rules", () => {
  it("keeps category weights totaling 100", () => {
    expect(marketingWeightTotal()).toBe(100);
    expect(Object.values(MARKETING_SCORE_WEIGHTS).length).toBe(10);
  });

  it("marks unavailable categories correctly", () => {
    const category = toCategoryResult({
      key: "audienceEngagement",
      score: 0,
      maximumScore: 10,
      explanation: "Unavailable without impressions",
      evidence: ["Impressions: 0"],
      recommendedAction: "Connect analytics",
      confidence: 0.2,
      available: false,
    });
    expect(category.status).toBe("unavailable");
  });

  it("maps score to health bands", () => {
    expect(scoreHealthStatus(90)).toBe("excellent");
    expect(scoreHealthStatus(75)).toBe("healthy");
    expect(scoreHealthStatus(55)).toBe("needs_attention");
    expect(scoreHealthStatus(20)).toBe("critical");
  });

  it("summarizes confidence buckets", () => {
    expect(summarizeConfidence(0.85)).toContain("High confidence");
    expect(summarizeConfidence(0.6)).toContain("Moderate confidence");
    expect(summarizeConfidence(0.35)).toContain("Limited confidence");
    expect(summarizeConfidence(0.1)).toContain("Low confidence");
  });
});
