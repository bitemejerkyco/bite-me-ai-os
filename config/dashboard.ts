import type { DashboardQuickAction, SetupChecklistItem } from "@/types/dashboard";

export const DASHBOARD_QUICK_ACTIONS: DashboardQuickAction[] = [
  {
    id: "create-brand",
    label: "Create Brand",
    description: "Launch the brand setup wizard.",
    href: "/brand-brain",
    cta: "Start brand setup",
  },
  {
    id: "import-website",
    label: "Import Website",
    description: "Bring website context into Brand Brain.",
    href: "/brand-brain",
    cta: "Import website",
  },
  {
    id: "upload-documents",
    label: "Upload Documents",
    description: "Add source docs to Knowledge Hub.",
    href: "/knowledge-hub",
    cta: "Upload documents",
  },
  {
    id: "connect-social",
    label: "Connect Social Account",
    description: "Prepare external channel publishing.",
    href: "/settings",
    cta: "Connect account",
  },
  {
    id: "new-campaign",
    label: "New Campaign",
    description: "Open campaign planning workspace.",
    href: "/campaigns",
    cta: "Create campaign",
  },
  {
    id: "generate-content",
    label: "Generate Content",
    description: "Start content generation workflows.",
    href: "/content-studio",
    cta: "Generate content",
  },
];

export function getSetupChecklist(isSupabaseConfigured: boolean, isDatabaseConfigured: boolean): SetupChecklistItem[] {
  return [
    { id: "supabase", label: "Configure Supabase", completed: isSupabaseConfigured },
    { id: "database", label: "Configure database", completed: isDatabaseConfigured },
    { id: "brand", label: "Create first brand", completed: false },
    { id: "social", label: "Connect social accounts", completed: false },
  ];
}
