import { logger } from "@/lib/logger";

export type AnalyticsEventName =
  | "mission_control_viewed"
  | "navigation_item_clicked"
  | "brand_brain_setup_started"
  | "workspace_authorization_checked"
  | "api_error_raised";

export type AnalyticsPayload = Record<string, string | number | boolean | null>;

export function trackEvent(event: AnalyticsEventName, payload: AnalyticsPayload = {}) {
  logger.info("analytics:event", {
    event,
    payload,
    source: "postmotive-foundation",
  });

  return {
    accepted: true,
    event,
    timestamp: new Date().toISOString(),
  } as const;
}
