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
  label: string;
  href: string;
  icon: NavigationIconKey;
};
