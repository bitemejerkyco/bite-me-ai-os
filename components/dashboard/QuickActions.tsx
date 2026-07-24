import { QuickActionCard } from "@/components/ui/QuickActionCard";
import { BuildingIcon, GlobeIcon, UploadIcon, ShareIcon, MegaphoneIcon, PenLineIcon } from "lucide-react";

const actions = [
  {
    icon: <BuildingIcon className="h-4 w-4" />,
    label: "Create Brand",
    description: "Set up a new brand identity",
    href: "/brand-setup",
  },
  {
    icon: <GlobeIcon className="h-4 w-4" />,
    label: "Import Website",
    description: "Import content from a URL",
    href: "/knowledge-hub",
  },
  {
    icon: <UploadIcon className="h-4 w-4" />,
    label: "Upload Documents",
    description: "Add files to the knowledge base",
    href: "/knowledge-hub",
  },
  {
    icon: <ShareIcon className="h-4 w-4" />,
    label: "Connect Social",
    description: "Link a social media account",
    href: "/settings",
  },
  {
    icon: <MegaphoneIcon className="h-4 w-4" />,
    label: "New Campaign",
    description: "Launch a marketing campaign",
    href: "/campaigns",
  },
  {
    icon: <PenLineIcon className="h-4 w-4" />,
    label: "Generate Content",
    description: "Create AI-powered content",
    href: "/content-studio",
  },
];

export function QuickActions() {
  return (
    <div className="rounded-xl border border-[#222] bg-[#161616] p-5">
      <h2 className="text-sm font-semibold text-white">Quick Actions</h2>
      <p className="mt-0.5 text-xs text-zinc-500">Jump-start your workflow</p>

      <div className="mt-4 space-y-2">
        {actions.map((action) => (
          <QuickActionCard
            key={action.label}
            icon={action.icon}
            label={action.label}
            description={action.description}
            href={action.href}
          />
        ))}
      </div>
    </div>
  );
}
