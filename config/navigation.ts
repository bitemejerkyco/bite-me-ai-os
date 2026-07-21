import type { NavigationItem, NavigationSection } from "@/types/navigation";

export const DASHBOARD_NAVIGATION: NavigationItem[] = [
  { id: "mission-control", label: "Mission Control", href: "/mission-control", icon: "gallery-vertical-end" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
  { id: "campaigns", label: "Campaigns", href: "/campaigns", icon: "megaphone", feature: "campaigns" },
  { id: "content-studio", label: "Content Studio", href: "/content-studio", icon: "pen-square", feature: "contentStudio" },
  {
    id: "marketing-calendar",
    label: "Marketing Calendar",
    href: "/marketing-calendar",
    icon: "calendar-days",
    feature: "publishing",
  },
  { id: "knowledge-hub", label: "Knowledge Hub", href: "/knowledge-hub", icon: "book-open", feature: "knowledgeHub" },
  { id: "brand-brain", label: "Brand Brain", href: "/brand-brain", icon: "brain", feature: "brandBrainFoundation" },
  { id: "media-library", label: "Media Library", href: "/media-library", icon: "images", feature: "contentStudio" },
  { id: "analytics", label: "Analytics", href: "/analytics", icon: "chart-column", feature: "analytics" },
  { id: "ai-employees", label: "AI Employees", href: "/ai-employees", icon: "bot", feature: "aiEmployees" },
  { id: "billing", label: "Billing", href: "/billing", icon: "credit-card", feature: "billing" },
  { id: "settings", label: "Settings", href: "/settings", icon: "settings" },
];

export const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    id: "mission-control",
    label: "Mission Control",
    items: DASHBOARD_NAVIGATION,
  },
];

export const AUTH_PATHS = new Set(["/login", "/signup", "/forgot-password"]);
export const PROTECTED_PREFIXES = DASHBOARD_NAVIGATION.map((item) => item.href);
