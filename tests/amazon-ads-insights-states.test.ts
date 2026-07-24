import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AmazonAdsInsightsLoading from "@/app/analytics/amazon-ads/loading";
import AmazonAdsInsightsError from "@/app/analytics/amazon-ads/error";

describe("Amazon Ads insights state surfaces", () => {
  it("renders loading state content", () => {
    const html = renderToStaticMarkup(createElement(AmazonAdsInsightsLoading));
    expect(html).toContain("Loading Amazon Ads insights...");
    expect(html).toContain("aria-busy");
  });

  it("renders error state with retry affordance", () => {
    const html = renderToStaticMarkup(
      createElement(AmazonAdsInsightsError, { error: new Error("sandbox unavailable"), reset: vi.fn() }),
    );
    expect(html).toContain("Amazon Ads Insights Unavailable");
    expect(html).toContain("sandbox unavailable");
    expect(html).toContain("Retry");
  });
});
