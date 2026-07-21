import { PageHeader } from "@/components/ui/PageHeader";
import { BrandSetupWizard } from "@/components/dashboard/BrandSetupWizard";

export const metadata = { title: "Brand Setup – Bite Me AI OS" };

export default function BrandSetupPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Brand Setup"
        description="Configure your brand identity to unlock AI-powered marketing."
      />
      <BrandSetupWizard />
    </div>
  );
}
