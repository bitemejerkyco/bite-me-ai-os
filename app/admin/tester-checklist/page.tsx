import { requireSuperAdmin } from "@/lib/auth/server";

const TEST_FLOW_STEPS = [
  "Sign in",
  "Complete Business Setup",
  "Upload a logo",
  "Add one product or service",
  "Connect or review one integration",
  "Generate a marketing plan",
  "Generate content",
  "Edit a draft",
  "Approve a draft",
  "Schedule content",
  "Open Analytics",
  "Use Help Search",
  "Ask Motive five questions",
  "Complete one Academy lesson",
  "Submit one feedback report",
] as const;

const TRACKING_FIELDS = [
  "Started",
  "Completed",
  "Failed",
  "Needed assistance",
  "Time to complete",
  "Feedback submitted",
] as const;

export default async function AdminTesterChecklistPage() {
  await requireSuperAdmin();

  return (
    <div className="space-y-6">
      <section className="pm-glass rounded-[2rem] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Monday Beta Test Flow</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Manual Tester Checklist</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Use this checklist to run consistent first-time tester validation before external testing windows.
        </p>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        <h2 className="text-xl font-black tracking-tight text-slate-900">Tester Steps</h2>
        <ol className="mt-4 space-y-3 text-sm text-slate-700">
          {TEST_FLOW_STEPS.map((step, index) => (
            <li key={step} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <span className="font-semibold text-slate-900">{index + 1}. {step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        <h2 className="text-xl font-black tracking-tight text-slate-900">Tracking Template</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.16em] text-slate-500">
                <th className="px-3 py-2">Step</th>
                {TRACKING_FIELDS.map((field) => (
                  <th key={field} className="px-3 py-2">{field}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TEST_FLOW_STEPS.map((step) => (
                <tr key={step} className="border-b border-slate-100">
                  <td className="px-3 py-3 font-medium text-slate-900">{step}</td>
                  {TRACKING_FIELDS.map((field) => (
                    <td key={`${step}-${field}`} className="px-3 py-3 text-slate-600">-</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
