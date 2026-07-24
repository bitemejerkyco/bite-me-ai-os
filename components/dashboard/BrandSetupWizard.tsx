"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { WizardLayout } from "@/components/ui/WizardLayout";
import { ChevronRightIcon, ChevronLeftIcon } from "lucide-react";

// ─── Zod Schemas ───────────────────────────────────────────────────────────

const step1Schema = z.object({
  businessName: z.string().min(1, "Business name is required").max(100),
  website: z
    .string()
    .optional()
    .refine(
      (v) => !v || v.startsWith("http://") || v.startsWith("https://"),
      "Website must start with http:// or https://"
    ),
  industry: z.string().min(1, "Please select an industry"),
  logoUrl: z.string().optional(),
});

const step2Schema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
  brandVoice: z.string().min(1, "Brand voice is required"),
  targetAudience: z.string().min(1, "Target audience is required"),
  competitors: z.string().optional(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

interface BrandData {
  step1: Partial<Step1Data>;
  step2: Partial<Step2Data>;
}

// ─── Shared input styles ────────────────────────────────────────────────────

const inputClass =
  "mt-1 block w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

const labelClass = "block text-sm font-medium text-zinc-300";

const errorClass = "mt-1 text-xs text-red-400";

const industries = [
  "Food & Beverage",
  "Retail & E-commerce",
  "Technology & SaaS",
  "Health & Wellness",
  "Professional Services",
  "Hospitality & Tourism",
  "Real Estate",
  "Education",
  "Finance & Insurance",
  "Other",
];

const voiceOptions = [
  "Professional & authoritative",
  "Friendly & approachable",
  "Bold & playful",
  "Luxurious & premium",
  "Educational & informative",
  "Casual & conversational",
];

// ─── Step 1 ─────────────────────────────────────────────────────────────────

interface Step1Props {
  defaultValues: Partial<Step1Data>;
  onNext: (data: Step1Data) => void;
}

function Step1Form({ defaultValues, onNext }: Step1Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate>
      <h2 className="text-lg font-semibold text-white">Business Information</h2>
      <p className="mt-1 text-sm text-zinc-500">Tell us about your business.</p>

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="businessName" className={labelClass}>
            Business name <span className="text-red-400">*</span>
          </label>
          <input
            id="businessName"
            type="text"
            placeholder="e.g. Bite Me Jerky"
            className={inputClass}
            aria-invalid={!!errors.businessName}
            aria-describedby={errors.businessName ? "businessName-error" : undefined}
            {...register("businessName")}
          />
          {errors.businessName && (
            <p id="businessName-error" className={errorClass} role="alert">
              {errors.businessName.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="website" className={labelClass}>
            Website
          </label>
          <input
            id="website"
            type="url"
            placeholder="https://yourwebsite.com"
            className={inputClass}
            aria-invalid={!!errors.website}
            aria-describedby={errors.website ? "website-error" : undefined}
            {...register("website")}
          />
          {errors.website && (
            <p id="website-error" className={errorClass} role="alert">
              {errors.website.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="industry" className={labelClass}>
            Industry <span className="text-red-400">*</span>
          </label>
          <select
            id="industry"
            className={inputClass}
            aria-invalid={!!errors.industry}
            aria-describedby={errors.industry ? "industry-error" : undefined}
            {...register("industry")}
          >
            <option value="">Select an industry</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
          {errors.industry && (
            <p id="industry-error" className={errorClass} role="alert">
              {errors.industry.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="logoUrl" className={labelClass}>
            Logo URL{" "}
            <span className="text-xs text-zinc-500">(upload coming soon)</span>
          </label>
          <input
            id="logoUrl"
            type="url"
            placeholder="https://yourwebsite.com/logo.png"
            className={inputClass}
            {...register("logoUrl")}
          />
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          Next <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

// ─── Step 2 ─────────────────────────────────────────────────────────────────

interface Step2Props {
  defaultValues: Partial<Step2Data>;
  onNext: (data: Step2Data) => void;
  onBack: () => void;
}

function Step2Form({ defaultValues, onNext, onBack }: Step2Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      primaryColor: "#e53e3e",
      secondaryColor: "#1a1a1a",
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate>
      <h2 className="text-lg font-semibold text-white">Brand Identity</h2>
      <p className="mt-1 text-sm text-zinc-500">Define your brand&apos;s look and voice.</p>

      <div className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="primaryColor" className={labelClass}>
              Primary color <span className="text-red-400">*</span>
            </label>
            <Controller
              name="primaryColor"
              control={control}
              render={({ field }) => (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id="primaryColorPicker"
                    type="color"
                    className="h-9 w-12 cursor-pointer rounded border border-[#2a2a2a] bg-[#1a1a1a]"
                    aria-label="Primary color picker"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                  <input
                    id="primaryColor"
                    type="text"
                    placeholder="#e53e3e"
                    className={`${inputClass} mt-0 flex-1`}
                    aria-invalid={!!errors.primaryColor}
                    aria-describedby={errors.primaryColor ? "primaryColor-error" : undefined}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                  />
                </div>
              )}
            />
            {errors.primaryColor && (
              <p id="primaryColor-error" className={errorClass} role="alert">
                {errors.primaryColor.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="secondaryColor" className={labelClass}>
              Secondary color <span className="text-red-400">*</span>
            </label>
            <Controller
              name="secondaryColor"
              control={control}
              render={({ field }) => (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id="secondaryColorPicker"
                    type="color"
                    className="h-9 w-12 cursor-pointer rounded border border-[#2a2a2a] bg-[#1a1a1a]"
                    aria-label="Secondary color picker"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                  <input
                    id="secondaryColor"
                    type="text"
                    placeholder="#1a1a1a"
                    className={`${inputClass} mt-0 flex-1`}
                    aria-invalid={!!errors.secondaryColor}
                    aria-describedby={errors.secondaryColor ? "secondaryColor-error" : undefined}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                  />
                </div>
              )}
            />
            {errors.secondaryColor && (
              <p id="secondaryColor-error" className={errorClass} role="alert">
                {errors.secondaryColor.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="brandVoice" className={labelClass}>
            Brand voice <span className="text-red-400">*</span>
          </label>
          <select
            id="brandVoice"
            className={inputClass}
            aria-invalid={!!errors.brandVoice}
            aria-describedby={errors.brandVoice ? "brandVoice-error" : undefined}
            {...register("brandVoice")}
          >
            <option value="">Select a voice</option>
            {voiceOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          {errors.brandVoice && (
            <p id="brandVoice-error" className={errorClass} role="alert">
              {errors.brandVoice.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="targetAudience" className={labelClass}>
            Target audience <span className="text-red-400">*</span>
          </label>
          <textarea
            id="targetAudience"
            rows={3}
            placeholder="e.g. Health-conscious adults aged 25-45 who enjoy outdoor activities…"
            className={`${inputClass} resize-none`}
            aria-invalid={!!errors.targetAudience}
            aria-describedby={errors.targetAudience ? "targetAudience-error" : undefined}
            {...register("targetAudience")}
          />
          {errors.targetAudience && (
            <p id="targetAudience-error" className={errorClass} role="alert">
              {errors.targetAudience.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="competitors" className={labelClass}>
            Competitors{" "}
            <span className="text-xs text-zinc-500">(optional, comma-separated)</span>
          </label>
          <input
            id="competitors"
            type="text"
            placeholder="e.g. Brand A, Brand B, Brand C"
            className={inputClass}
            {...register("competitors")}
          />
        </div>
      </div>

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] px-5 py-2 text-sm font-medium text-zinc-400 hover:border-[#333] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Back
        </button>
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          Next <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

// ─── Step 3 ─────────────────────────────────────────────────────────────────

interface Step3Props {
  data: BrandData;
  onBack: () => void;
  onFinish: () => void;
}

function ReviewStep({ data, onBack, onFinish }: Step3Props) {
  const { step1, step2 } = data;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Review &amp; Finish</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Review your brand setup before saving.
      </p>

      <div className="mt-6 space-y-6">
        {/* Step 1 review */}
        <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Business Information
          </h3>
          <dl className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-zinc-400">Business name</dt>
              <dd className="text-sm font-medium text-white">{step1.businessName || "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-zinc-400">Website</dt>
              <dd className="text-sm text-white">{step1.website || "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-zinc-400">Industry</dt>
              <dd className="text-sm text-white">{step1.industry || "—"}</dd>
            </div>
          </dl>
        </div>

        {/* Step 2 review */}
        <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Brand Identity
          </h3>
          <dl className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-zinc-400">Brand colors</dt>
              <dd className="flex items-center gap-2">
                {step2.primaryColor && (
                  <span
                    className="h-4 w-4 rounded"
                    style={{ backgroundColor: step2.primaryColor }}
                    aria-label={`Primary: ${step2.primaryColor}`}
                  />
                )}
                {step2.secondaryColor && (
                  <span
                    className="h-4 w-4 rounded border border-[#333]"
                    style={{ backgroundColor: step2.secondaryColor }}
                    aria-label={`Secondary: ${step2.secondaryColor}`}
                  />
                )}
                <span className="text-sm text-white">
                  {step2.primaryColor} / {step2.secondaryColor}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-zinc-400">Brand voice</dt>
              <dd className="text-sm text-white">{step2.brandVoice || "—"}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-sm text-zinc-400">Target audience</dt>
              <dd className="text-right text-sm text-white">{step2.targetAudience || "—"}</dd>
            </div>
            {step2.competitors && (
              <div className="flex items-center justify-between">
                <dt className="text-sm text-zinc-400">Competitors</dt>
                <dd className="text-sm text-white">{step2.competitors}</dd>
              </div>
            )}
          </dl>
        </div>

        <p className="text-xs text-zinc-600">
          This setup is a preview. Saving brand data will be implemented in a future sprint.
        </p>
      </div>

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] px-5 py-2 text-sm font-medium text-zinc-400 hover:border-[#333] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Back
        </button>
        <button
          type="button"
          onClick={onFinish}
          className="rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          Finish setup
        </button>
      </div>
    </div>
  );
}

// ─── Wizard ─────────────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { id: 1, title: "Business Info" },
  { id: 2, title: "Brand Identity" },
  { id: 3, title: "Review" },
];

export function BrandSetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [brandData, setBrandData] = useState<BrandData>({
    step1: {},
    step2: {},
  });

  const handleStep1 = (data: Step1Data) => {
    setBrandData((d) => ({ ...d, step1: data }));
    setStep(2);
  };

  const handleStep2 = (data: Step2Data) => {
    setBrandData((d) => ({ ...d, step2: data }));
    setStep(3);
  };

  const handleFinish = () => {
    // Persistence deferred to future sprint
    router.push("/brand-brain");
  };

  return (
    <WizardLayout steps={WIZARD_STEPS} currentStep={step}>
      {step === 1 && (
        <Step1Form
          defaultValues={brandData.step1}
          onNext={handleStep1}
        />
      )}
      {step === 2 && (
        <Step2Form
          defaultValues={brandData.step2}
          onNext={handleStep2}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <ReviewStep
          data={brandData}
          onBack={() => setStep(2)}
          onFinish={handleFinish}
        />
      )}
    </WizardLayout>
  );
}
