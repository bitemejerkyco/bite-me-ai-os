import Link from "next/link";
import AppShell from "@/components/AppShell";
import HelpCenterClient from "@/components/help/HelpCenterClient";
import { buildDocumentationMetadata } from "@/features/help/documentation-metadata";

export default function HelpPage() {
  const metadata = buildDocumentationMetadata();
  const gettingStarted = metadata.pages.filter((page) => ["/", "/onboarding", "/integrations", "/studio", "/content"].includes(page.route));

  return (
    <AppShell title="Help & Academy" eyebrow="Interactive guidance and searchable support">
      <HelpCenterClient />

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Getting Started</p>
          <div className="mt-4 space-y-3">
            {gettingStarted.map((page) => (
              <Link key={page.id} href={page.route} className="block rounded-2xl border border-slate-200 bg-slate-50/80 p-4 hover:border-violet-300">
                <p className="text-sm font-semibold text-slate-900">{page.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{page.shortDescription}</p>
              </Link>
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Academy categories</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[...new Set(metadata.lessons.map((lesson) => lesson.category))].map((category) => (
              <Link key={category} href="/academy" className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm font-semibold text-slate-800 hover:border-violet-300">
                {category}
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Common topics</p>
          <div className="mt-4 space-y-3">
            {metadata.pages.slice(0, 8).map((page) => (
              <div key={page.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm font-semibold text-slate-900">{page.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{page.whyItMatters}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {page.relatedPages.slice(0, 2).map((related) => (
                    <Link key={related.href} href={related.href} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                      {related.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Release notes and guides</p>
          <div className="mt-4 space-y-3">
            <Link href="/help/user-guide" className="block rounded-2xl border border-slate-200 bg-slate-50/80 p-4 hover:border-violet-300">
              <p className="text-sm font-semibold text-slate-900">User Guide</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">Generated from the central help registry for customer workflows.</p>
            </Link>
            <Link href="/help/admin-guide" className="block rounded-2xl border border-slate-200 bg-slate-50/80 p-4 hover:border-violet-300">
              <p className="text-sm font-semibold text-slate-900">Admin Guide</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">Operational guidance for super admins and support teams.</p>
            </Link>
            {metadata.releaseNoteDrafts.map((draft) => (
              <div key={draft.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm font-semibold text-slate-900">{draft.title}</p>
                <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
                  {draft.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
