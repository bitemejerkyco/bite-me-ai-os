import { describe, expect, it } from "vitest";
import {
  CREATOR_CAMPAIGN_STATUSES,
  CREATOR_PIPELINE_STAGES,
  CREATOR_SUBMISSION_STATUSES,
} from "@/features/creators/types";

describe("creator models", () => {
  it("includes required pipeline stages", () => {
    [
      "DISCOVERED",
      "AI_RECOMMENDED",
      "SAVED",
      "CONTACTED",
      "INTERESTED",
      "NEGOTIATING",
      "AGREEMENT_PENDING",
      "CAMPAIGN_ACTIVE",
      "CONTENT_PRODUCTION",
      "CONTENT_REVIEW",
      "PUBLISHED",
      "COMPLETED",
      "AMBASSADOR",
      "DECLINED",
      "ARCHIVED",
    ].forEach((stage) => expect(CREATOR_PIPELINE_STAGES).toContain(stage));
  });

  it("includes campaign and submission statuses", () => {
    expect(CREATOR_CAMPAIGN_STATUSES).toContain("ACTIVE");
    expect(CREATOR_CAMPAIGN_STATUSES).toContain("CANCELLED");
    expect(CREATOR_SUBMISSION_STATUSES).toContain("REVISION_REQUESTED");
    expect(CREATOR_SUBMISSION_STATUSES).toContain("PUBLISHED");
  });
});
