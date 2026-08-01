import { ACADEMY_LESSONS } from "@/features/help/academy-registry";
import { PAGE_HELP_REGISTRY } from "@/features/help/page-help-registry";
import { HELP_TERM_REGISTRY } from "@/features/help/term-registry";
import { WALKTHROUGH_REGISTRY } from "@/features/help/walkthrough-registry";

export function buildUserGuideSections() {
  const byRoute = new Map(PAGE_HELP_REGISTRY.map((entry) => [entry.route, entry]));
  return [
    { title: "Getting Started", routes: ["/onboarding", "/settings/account", "/help", "/academy"] },
    { title: "Dashboard", routes: ["/"] },
    { title: "Marketing Director", routes: ["/", "/settings/marketing-director"] },
    { title: "Content Generation", routes: ["/studio"] },
    { title: "Content Library", routes: ["/content"] },
    { title: "Media Library", routes: ["/media"] },
    { title: "Campaigns", routes: ["/marketing/campaigns"] },
    { title: "Calendar", routes: ["/calendar"] },
    { title: "Approvals", routes: ["/approvals"] },
    { title: "Publishing", routes: ["/publishing-queue"] },
    { title: "Analytics", routes: ["/analytics"] },
    { title: "Integrations", routes: ["/integrations", "/settings/integrations/tiktok", "/settings/integrations/amazon-ads"] },
    { title: "Billing", routes: ["/settings/billing"] },
    { title: "Team Members", routes: ["/settings/team"] },
    { title: "Compliance", routes: ["/onboarding", "/settings/marketing-director"] },
    { title: "Troubleshooting", routes: ["/integrations", "/publishing-queue", "/notifications"] },
  ].map((section) => ({
    ...section,
    entries: section.routes.map((route) => byRoute.get(route)).filter(Boolean),
  }));
}

export function buildAdminGuideSections() {
  const byRoute = new Map(PAGE_HELP_REGISTRY.map((entry) => [entry.route, entry]));
  return [
    { title: "Account management", routes: ["/admin"] },
    { title: "Feature flags", routes: ["/admin/settings"] },
    { title: "System settings", routes: ["/admin/settings"] },
    { title: "Integration operations", routes: ["/admin/integrations"] },
    { title: "Billing overrides", routes: ["/admin/costs"] },
    { title: "Cost monitoring", routes: ["/admin/costs"] },
    { title: "Job queues", routes: ["/admin/integrations", "/admin/operations"] },
    { title: "Failed publishing", routes: ["/admin/operations", "/admin/integrations"] },
    { title: "Maintenance mode", routes: ["/admin/integrations"] },
    { title: "Audit logs", routes: ["/admin/audit"] },
    { title: "Beta support", routes: ["/admin/operations"] },
  ].map((section) => ({
    ...section,
    entries: section.routes.map((route) => byRoute.get(route)).filter(Boolean),
  }));
}

export function buildDocumentationMetadata() {
  return {
    pages: PAGE_HELP_REGISTRY,
    lessons: ACADEMY_LESSONS,
    walkthroughs: WALKTHROUGH_REGISTRY,
    terms: HELP_TERM_REGISTRY,
    userGuide: buildUserGuideSections(),
    adminGuide: buildAdminGuideSections(),
    releaseNoteDrafts: PAGE_HELP_REGISTRY.filter((entry) => (entry.comingSoon || []).length > 0).map((entry) => ({
      title: `Guidance update: ${entry.title}`,
      notes: entry.comingSoon || [],
    })),
  };
}
