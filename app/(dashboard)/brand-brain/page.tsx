import { BrandSetupWizard } from "@/components/dashboard/brand-setup-wizard";
import { PageHeader } from "@/components/dashboard/page-header";
import { Section } from "@/components/dashboard/section";

export default function BrandBrainPage() {
  return (
    <section className="space-y-6">
      <PageHeader
        title="Brand Brain"
        description="Create your brand operating profile with a guided multi-step setup wizard."
      />
      <Section title="Brand Setup Wizard" description="Step through identity, messaging, and audience definitions.">
        <BrandSetupWizard />
      </Section>
    </section>
  );
}
