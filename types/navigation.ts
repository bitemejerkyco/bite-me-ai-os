export type NavigationIconKey =
  | "gallery-vertical-end"
  | "layout-dashboard"
  | "megaphone"
  | "pen-square"
  | "calendar-days"
  | "book-open"
  | "brain"
  | "images"
  | "chart-column"
  | "credit-card"
  | "settings"
  | "bot";

export type NavigationItem = {
  id: string;
  label: string;
  href: string;
  icon: NavigationIconKey;
  feature?: import("@/types/feature-flags").FeatureFlagKey;
};

export type NavigationSection = {
  id: string;
  label: string;
  items: NavigationItem[];
};
