import { describe, expect, it } from "vitest";
import { EXECUTIVE_CARD_DESTINATIONS } from "@/features/marketing-director/card-routes";

describe("marketing director card routes", () => {
  it("maps each dashboard card to an expected destination route", () => {
    expect(EXECUTIVE_CARD_DESTINATIONS.marketing_score).toBe("/analytics/marketing-score");
    expect(EXECUTIVE_CARD_DESTINATIONS.marketing_health).toBe("/analytics/marketing-health");
    expect(EXECUTIVE_CARD_DESTINATIONS.revenue_impact).toBe("/analytics/revenue");
    expect(EXECUTIVE_CARD_DESTINATIONS.ai_confidence).toBe("/analytics/ai-confidence");
    expect(EXECUTIVE_CARD_DESTINATIONS.active_campaigns).toBe("/marketing/campaigns");
    expect(EXECUTIVE_CARD_DESTINATIONS.content_awaiting_approval).toBe("/content-library?status=awaiting-approval");
    expect(EXECUTIVE_CARD_DESTINATIONS.scheduled_posts).toBe("/calendar?view=scheduled");
    expect(EXECUTIVE_CARD_DESTINATIONS.connected_channels).toBe("/integrations");
  });
});
