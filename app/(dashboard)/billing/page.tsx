import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreditCardIcon } from "lucide-react";

export const metadata = { title: "Billing – Bite Me AI OS" };

export default function BillingPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Billing"
        description="Manage your subscription and payment methods."
      />
      <EmptyState
        icon={<CreditCardIcon className="h-6 w-6" />}
        title="No billing information"
        description="Billing and subscription management coming soon."
      />
    </div>
  );
}
