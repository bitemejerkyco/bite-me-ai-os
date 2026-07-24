export type DashboardQuickAction = {
  id: string;
  label: string;
  description: string;
  href: string;
  cta: string;
};

export type SetupChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
};
