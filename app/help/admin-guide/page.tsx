import AppShell from "@/components/AppShell";
import { buildAdminGuideSections } from "@/features/help/documentation-metadata";

export default function AdminGuidePage() {
  const sections = buildAdminGuideSections();

  return (
    <AppShell title="Admin Guide" eyebrow="Operational guidance for super admins">
      <div className="space-y-5">
        {sections.map((section) => (
          <section key={section.title} className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">{section.title}</p>
            <div className="mt-4 space-y-3">
              {section.entries.map((entry) => (
                <article key={entry!.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-sm font-semibold text-slate-900">{entry!.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{entry!.purpose}</p>
                  <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Start with:</span> {entry!.recommendedFirstAction}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
