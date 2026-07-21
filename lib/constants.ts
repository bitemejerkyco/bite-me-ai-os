import type { NavigationItem } from "@/types/navigation";

export const APP_NAME = "PostMotive AI";
export const APP_TAGLINE = "Every Post Has a Motive.";

export const DASHBOARD_NAVIGATION: NavigationItem[] = [
  { label: "Mission Control", href: "/mission-control", icon: "gallery-vertical-end" },
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
  { label: "Campaigns", href: "/campaigns", icon: "megaphone" },
  { label: "Content Studio", href: "/content-studio", icon: "pen-square" },
  { label: "Marketing Calendar", href: "/marketing-calendar", icon: "calendar-days" },
  { label: "Knowledge Hub", href: "/knowledge-hub", icon: "book-open" },
  { label: "Brand Brain", href: "/brand-brain", icon: "brain" },
  { label: "Media Library", href: "/media-library", icon: "images" },
  { label: "Analytics", href: "/analytics", icon: "chart-column" },
  { label: "AI Employees", href: "/ai-employees", icon: "bot" },
  { label: "Billing", href: "/billing", icon: "credit-card" },
  { label: "Settings", href: "/settings", icon: "settings" },
];

export const AUTH_PATHS = new Set(["/login", "/signup", "/forgot-password"]);

export const PROTECTED_PREFIXES = [
  "/mission-control",
  "/dashboard",
  "/campaigns",
  "/content-studio",
  "/marketing-calendar",
  "/knowledge-hub",
  "/brand-brain",
  "/media-library",
  "/analytics",
  "/ai-employees",
  "/billing",
  "/settings",
];
