"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { WizardLayout } from "@/components/dashboard/wizard-layout";

type BrandWizardValues = {
  businessName: string;
  website: string;
  industry: string;
  logo: FileList | null;
  primaryColor: string;
  secondaryColor: string;
  voice: string;
  audience: string;
  competitors: string;
};

export function BrandSetupWizard() {
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState(false);

  const form = useForm<BrandWizardValues>({
    mode: "onSubmit",
    defaultValues: {
      businessName: "",
      website: "",
      industry: "",
      logo: null,
      primaryColor: "",
      secondaryColor: "",
      voice: "",
      audience: "",
      competitors: "",
    },
  });

  const values = form.watch();

  function next() {
    if (step < 3) setStep((value) => value + 1);
  }

  function back() {
    if (step > 1) setStep((value) => value - 1);
  }

  const onSubmit = form.handleSubmit(() => {
    setCompleted(true);
  });

  if (completed) {
    return (
      <Card>
        <CardContent className="space-y-2 p-6">
          <h3 className="text-lg font-semibold">Brand setup complete</h3>
          <p className="text-sm text-[var(--muted-foreground)]">Your wizard inputs are ready. Persistence is enabled in a later sprint.</p>
          <Button type="button" variant="secondary" onClick={() => { setCompleted(false); setStep(1); }}>
            Start over
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {step === 1 ? (
        <WizardLayout title="Business profile" description="Define your core business identity." step={1} totalSteps={3}>
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input id="businessName" {...form.register("businessName", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" type="url" placeholder="https://" {...form.register("website", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" {...form.register("industry", { required: true })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="logo">Logo Upload</Label>
                <Input id="logo" type="file" accept="image/*" {...form.register("logo")} />
              </div>
            </CardContent>
          </Card>
        </WizardLayout>
      ) : null}

      {step === 2 ? (
        <WizardLayout title="Brand voice" description="Capture your visual and messaging direction." step={2} totalSteps={3}>
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Brand Color (Primary)</Label>
                <Input id="primaryColor" placeholder="#E11D48" {...form.register("primaryColor", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Brand Color (Secondary)</Label>
                <Input id="secondaryColor" placeholder="#F43F5E" {...form.register("secondaryColor", { required: true })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="voice">Voice</Label>
                <Input id="voice" placeholder="Direct, premium, clear" {...form.register("voice", { required: true })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="audience">Audience</Label>
                <Input id="audience" placeholder="Founders and growth teams" {...form.register("audience", { required: true })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="competitors">Competitors</Label>
                <Input id="competitors" placeholder="Competitor A, Competitor B" {...form.register("competitors")} />
              </div>
            </CardContent>
          </Card>
        </WizardLayout>
      ) : null}

      {step === 3 ? (
        <WizardLayout title="Review" description="Confirm before completing setup." step={3} totalSteps={3}>
          <Card>
            <CardContent className="space-y-2 p-6 text-sm">
              <ReviewRow label="Business Name" value={values.businessName} />
              <ReviewRow label="Website" value={values.website} />
              <ReviewRow label="Industry" value={values.industry} />
              <ReviewRow label="Primary Color" value={values.primaryColor} />
              <ReviewRow label="Secondary Color" value={values.secondaryColor} />
              <ReviewRow label="Voice" value={values.voice} />
              <ReviewRow label="Audience" value={values.audience} />
              <ReviewRow label="Competitors" value={values.competitors || "Not provided"} />
            </CardContent>
          </Card>
        </WizardLayout>
      ) : null}

      <div className="flex items-center justify-between">
        <Button type="button" variant="secondary" onClick={back} disabled={step === 1}>
          Back
        </Button>
        {step < 3 ? (
          <Button type="button" onClick={next}>Next</Button>
        ) : (
          <Button type="submit">Finish</Button>
        )}
      </div>
    </form>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-zinc-900/40 px-3 py-2">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="font-medium">{value || "Not provided"}</span>
    </div>
  );
}
