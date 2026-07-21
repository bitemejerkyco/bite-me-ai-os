import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  CreditCard,
  FolderKanban,
  House,
  ImageIcon,
  Megaphone,
  Settings,
  Sparkles,
} from "lucide-react";
import type { NavigationItem } from "@/types/navigation";

export const APP_NAME = "Bite Me AI OS";
export const APP_DESCRIPTION = "Sprint 1A platform foundation for auth, routing, and data services.";

export const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"] as const;
export const REDIRECT_AUTH_ROUTES = ["/login", "/signup"] as const;
export const DASHBOARD_ROUTES = [
  "/dashboard",
  "/campaigns",
  "/content-studio",
  "/marketing-calendar",
  "/knowledge-hub",
  "/brand-brain",
  "/media-library",
  "/analytics",
  "/billing",
  "/settings",
] as const;

export const DASHBOARD_NAVIGATION: NavigationItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: House },
  { title: "Campaigns", href: "/campaigns", icon: Megaphone },
  { title: "Content Studio", href: "/content-studio", icon: Sparkles },
  { title: "Marketing Calendar", href: "/marketing-calendar", icon: CalendarDays },
  { title: "Knowledge Hub", href: "/knowledge-hub", icon: BookOpen },
  { title: "Brand Brain", href: "/brand-brain", icon: Brain },
  { title: "Media Library", href: "/media-library", icon: ImageIcon },
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
  { title: "Billing", href: "/billing", icon: CreditCard },
  { title: "Settings", href: "/settings", icon: Settings },
];

export const FEATURED_DASHBOARD_SECTION: NavigationItem = {
  title: "Workspace",
  href: "/dashboard",
  icon: FolderKanban,
};
