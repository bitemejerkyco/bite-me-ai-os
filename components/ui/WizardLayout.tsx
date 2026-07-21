import type { ReactNode } from "react";
import { CheckIcon } from "lucide-react";

interface WizardStep {
  id: number;
  title: string;
}

interface WizardLayoutProps {
  steps: WizardStep[];
  currentStep: number;
  children: ReactNode;
}

export function WizardLayout({ steps, currentStep, children }: WizardLayoutProps) {
  return (
    <div className="mx-auto max-w-2xl">
      {/* Step indicators */}
      <nav aria-label="Progress" className="mb-8">
        <ol className="flex items-center gap-2">
          {steps.map((step, index) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            return (
              <li key={step.id} className="flex flex-1 items-center">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      isCompleted
                        ? "bg-emerald-500 text-white"
                        : isCurrent
                        ? "bg-red-600 text-white"
                        : "bg-[#222] text-zinc-500"
                    }`}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {isCompleted ? (
                      <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      step.id
                    )}
                  </span>
                  <span
                    className={`hidden text-sm font-medium sm:block ${
                      isCurrent ? "text-white" : isCompleted ? "text-zinc-300" : "text-zinc-500"
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`mx-3 h-px flex-1 ${
                      isCompleted ? "bg-emerald-500/50" : "bg-[#222]"
                    }`}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step content */}
      <div className="rounded-xl border border-[#222] bg-[#161616] p-6">
        {children}
      </div>
    </div>
  );
}
