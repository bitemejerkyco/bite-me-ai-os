import type { WalkthroughDefinition } from "@/features/help/types";

export const WALKTHROUGH_REGISTRY: WalkthroughDefinition[] = [
  {
    id: "dashboard-overview",
    route: "/",
    version: "2",
    title: "Marketing Director dashboard walkthrough",
    steps: [
      { id: "dash-1", title: "Welcome to PostMotive", description: "This dashboard is your executive overview for marketing priorities and progress.", targetSelector: '[data-help="dashboard-welcome"]' },
      { id: "dash-2", title: "Executive Brief", description: "Use the brief to understand current status, blockers, and recommended next action.", targetSelector: '[data-help="dashboard-executive-brief"]' },
      { id: "dash-3", title: "AI Value Summary", description: "This summary uses real workspace records to show setup and workflow readiness.", targetSelector: '[data-help="dashboard-ai-value-summary"]' },
      { id: "dash-4", title: "Top Actions", description: "Actions are ranked by urgency and expected impact so you can act quickly.", targetSelector: '[data-help="dashboard-priority-actions"]' },
      { id: "dash-5", title: "AI Marketing Director Command Center", description: "Describe your goal in plain language and PostMotive will map the next workflow steps.", targetSelector: '[data-help="dashboard-command-center"]' },
      { id: "dash-6", title: "Marketing Score", description: "Your score reflects setup quality, activity, and connected data confidence.", targetSelector: '[data-help="dashboard-score"]' },
      { id: "dash-7", title: "Navigation", description: "Use Content Library, Media Library, Calendar, Analytics, and Integrations to execute each step.", targetSelector: '[aria-label="Sidebar navigation"]' },
      { id: "dash-8", title: "Ask PostMotive", description: "Use contextual help any time to ask what to do next on your current page.", targetSelector: '[data-help="ask-postmotive"]' },
    ],
  },
  {
    id: "content-library-overview",
    route: "/content",
    version: "1",
    title: "Content Library walkthrough",
    steps: [
      { id: "content-1", title: "Folders", description: "Organize approved and in-progress drafts into reusable folders.", targetSelector: '[data-help="content-folders"]' },
      { id: "content-2", title: "Draft list", description: "Select a draft here to review or continue editing.", targetSelector: '[data-help="content-draft-list"]' },
      { id: "content-3", title: "Draft editor", description: "Edit copy, review status, and prepare the draft for approval or scheduling.", targetSelector: '[data-help="content-editor"]' },
      { id: "content-4", title: "Schedule handoff", description: "Move finished work into the calendar when it is ready.", targetSelector: '[data-help="content-schedule"]' },
    ],
  },
  {
    id: "integrations-overview",
    route: "/integrations",
    version: "1",
    title: "Integrations walkthrough",
    steps: [
      { id: "integrations-1", title: "Provider cards", description: "Use these cards to understand each provider's state, support level, and recent failures.", targetSelector: '[data-help="integrations-provider-grid"]' },
      { id: "integrations-2", title: "Provider settings", description: "Open a settings page from the provider card when you are ready to connect or troubleshoot.", targetSelector: '[data-help="integrations-provider-card"]' },
      { id: "integrations-3", title: "Health and scopes", description: "Missing scopes or degraded states tell you why an integration is not fully ready.", targetSelector: '[data-help="integrations-provider-card"]' },
    ],
  },
  {
    id: "media-library-overview",
    route: "/media",
    version: "1",
    title: "Media Library walkthrough",
    steps: [
      { id: "media-1", title: "Upload zone", description: "Start by uploading logos, brand photos, or short videos.", targetSelector: '[data-help="media-upload-zone"]' },
      { id: "media-2", title: "Folders and tags", description: "Use folders and tags so assets are easier to find during content creation.", targetSelector: '[data-help="media-folders"]' },
      { id: "media-3", title: "Asset grid", description: "Review assets here before using them in the AI Studio.", targetSelector: '[data-help="media-asset-grid"]' },
    ],
  },
  {
    id: "calendar-overview",
    route: "/calendar",
    version: "1",
    title: "Publishing Calendar walkthrough",
    steps: [
      { id: "calendar-1", title: "Schedule form", description: "Pick a draft, channel, and time to prepare a post for publishing.", targetSelector: '[data-help="calendar-form"]' },
      { id: "calendar-2", title: "Calendar grid", description: "Use the monthly grid to review what is already scheduled.", targetSelector: '[data-help="calendar-grid"]' },
      { id: "calendar-3", title: "Post details", description: "Open a post to review status, approval state, and performance follow-up.", targetSelector: '[data-help="calendar-details"]' },
    ],
  },
  {
    id: "approvals-overview",
    route: "/approvals",
    version: "1",
    title: "Approval Center walkthrough",
    steps: [
      { id: "approvals-1", title: "Pending approvals", description: "Review items that need a human decision before they can continue.", targetSelector: '[data-help="approvals-list"]' },
      { id: "approvals-2", title: "Status filters", description: "Filter to approved, rejected, or pending items when the queue grows.", targetSelector: '[data-help="approvals-filters"]' },
    ],
  },
  {
    id: "billing-overview",
    route: "/settings/billing",
    version: "1",
    title: "Billing walkthrough",
    steps: [
      { id: "billing-1", title: "Current plan", description: "Check your active plan and current invoice history.", targetSelector: '[data-help="billing-summary"]' },
      { id: "billing-2", title: "Plan upgrade", description: "Choose a paid plan when you are ready to move beyond the current workspace level.", targetSelector: '[data-help="billing-plan-grid"]' },
      { id: "billing-3", title: "Credits", description: "Review credit balances before heavier AI or video usage.", targetSelector: '[data-help="billing-summary"]' },
    ],
  },
];

export function getWalkthrough(route: string): WalkthroughDefinition | null {
  return WALKTHROUGH_REGISTRY.find((item) => item.route === route) || null;
}
