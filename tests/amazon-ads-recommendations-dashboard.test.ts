import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AmazonAdsInsightsDashboard from "@/components/analytics/AmazonAdsInsightsDashboard";
import { AMAZON_ADS_INSIGHT_FIXTURE } from "@/features/marketing/providers/amazon-ads/insights/fixtures";
import { buildDashboardViewModel } from "@/features/marketing/providers/amazon-ads/insights/view-model";

describe("Amazon Ads recommendations dashboard section", () => {
  it("renders recommendation section and read-only messaging without mutation CTAs", () => {
    const model = buildDashboardViewModel(
      AMAZON_ADS_INSIGHT_FIXTURE,
      "2026-06-05T00:00:00.000Z",
    );
    const html = renderToStaticMarkup(
      createElement(AmazonAdsInsightsDashboard, { model }),
    );

    expect(html).toContain("Recommendations");
    expect(html).toContain("Read Only — No changes applied");
    expect(html).toContain("View evidence");

    expect(html).not.toContain("Apply");
    expect(html).not.toContain("Change Bid");
    expect(html).not.toContain("Pause Campaign");
    expect(html).not.toContain("Update Budget");
  });
});
