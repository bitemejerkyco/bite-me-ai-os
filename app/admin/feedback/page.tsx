import { requireSuperAdmin } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminFeedbackPage() {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("help_feedback_submissions")
    .select("id,category,route,status,description,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const items = (data as Array<Record<string, unknown>> | null) || [];

  return (
    <div className="space-y-6">
      <section className="pm-glass rounded-[2rem] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Feedback triage</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Help and guidance feedback</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Review beta feedback about confusing instructions, missing help topics, bugs, and feature requests.
        </p>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No feedback submissions yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={String(item.id)} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{String(item.category || "GENERAL_FEEDBACK")}</p>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{String(item.status || "OPEN")}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{String(item.route || "/")}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{String(item.description || "")}</p>
                <p className="mt-2 text-xs text-slate-500">{new Date(String(item.created_at || new Date().toISOString())).toLocaleString()}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
