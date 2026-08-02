export type SidebarLink = {
  href: string;
  label: string;
  icon: string;
};

export type SidebarGroupId = "primary" | "creators" | "assets" | "account" | "support" | "admin";

export type SidebarGroup = {
  id: SidebarGroupId;
  label: string;
  defaultExpanded: boolean;
  compactDefaultExpanded?: boolean;
  links: SidebarLink[];
  adminOnly?: boolean;
};

export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    id: "primary",
    label: "Primary",
    defaultExpanded: true,
    compactDefaultExpanded: true,
    links: [
      { href: "/", label: "Dashboard", icon: "▦" },
      { href: "/onboarding", label: "Business Setup", icon: "✓" },
      { href: "/marketing", label: "Marketing", icon: "◆" },
      { href: "/studio", label: "AI Studio", icon: "✦" },
      { href: "/content", label: "Content Library", icon: "▤" },
      { href: "/calendar", label: "Calendar", icon: "◫" },
    ],
  },
  {
    id: "creators",
    label: "Creator Hub",
    defaultExpanded: true,
    compactDefaultExpanded: true,
    links: [
      { href: "/creators", label: "Creator Dashboard", icon: "◉" },
      { href: "/creators/discover", label: "Discover Creators", icon: "◌" },
      { href: "/creators/pipeline", label: "Creator Pipeline", icon: "▥" },
      { href: "/creators/campaigns", label: "Creator Campaigns", icon: "◈" },
      { href: "/creators/content-review", label: "Content Review", icon: "✓" },
      { href: "/creators/ugc", label: "UGC Library", icon: "▣" },
      { href: "/creators/analytics", label: "Creator Analytics", icon: "↗" },
    ],
  },
  {
    id: "assets",
    label: "Assets & Intelligence",
    defaultExpanded: true,
    compactDefaultExpanded: true,
    links: [
      { href: "/knowledge", label: "Knowledge Base", icon: "★" },
      { href: "/media", label: "Media Library", icon: "▧" },
      { href: "/analytics", label: "Analytics", icon: "↗" },
    ],
  },
  {
    id: "account",
    label: "Account",
    defaultExpanded: true,
    compactDefaultExpanded: false,
    links: [
      { href: "/pricing", label: "Pricing", icon: "$" },
      { href: "/settings/billing", label: "Billing Settings", icon: "¤" },
      { href: "/settings/branding", label: "Branding Settings", icon: "◍" },
      { href: "/settings/marketing-director", label: "Director Settings", icon: "◈" },
      { href: "/integrations", label: "Integrations", icon: "⚙" },
    ],
  },
  {
    id: "support",
    label: "Support",
    defaultExpanded: true,
    compactDefaultExpanded: false,
    links: [
      { href: "/help", label: "Help & Academy", icon: "?" },
      { href: "/settings/account", label: "Account Settings", icon: "◌" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    defaultExpanded: true,
    compactDefaultExpanded: false,
    adminOnly: true,
    links: [
      { href: "/admin", label: "Admin Console", icon: "⌘" },
      { href: "/admin/integrations", label: "Integration Operations", icon: "◎" },
      { href: "/admin/tester-checklist", label: "Tester Checklist", icon: "☑" },
      { href: "/admin/feedback", label: "Feedback", icon: "✉" },
    ],
  },
];

export function isActiveRoute(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function activeGroupIds(pathname: string): SidebarGroupId[] {
  return SIDEBAR_GROUPS.filter((group) => group.links.some((link) => isActiveRoute(pathname, link.href))).map((group) => group.id);
}

export function defaultExpandedGroups(input: { pathname: string; compact: boolean; showAdminSection: boolean }): Record<SidebarGroupId, boolean> {
  const activeGroups = new Set(activeGroupIds(input.pathname));
  const result = {} as Record<SidebarGroupId, boolean>;

  for (const group of SIDEBAR_GROUPS) {
    if (group.adminOnly && !input.showAdminSection) {
      result[group.id] = false;
      continue;
    }
    const defaultExpanded = input.compact ? Boolean(group.compactDefaultExpanded) : group.defaultExpanded;
    result[group.id] = activeGroups.has(group.id) || defaultExpanded;
  }

  return result;
}
