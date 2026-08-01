import AppShell from "@/components/AppShell";
import AcademyLessonList from "@/components/help/AcademyLessonList";
import { ACADEMY_LESSONS } from "@/features/help/academy-registry";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AcademyPage() {
  const context = await requireWorkspaceContext();
  const admin = createAdminClient();
  const { data } = await admin
    .from("academy_lesson_progress")
    .select("lesson_id,status,completion_percentage")
    .eq("workspace_id", context.workspaceId)
    .eq("user_id", context.userId);

  const progress = Object.fromEntries(
    ((data as Array<{ lesson_id?: string; status?: string; completion_percentage?: number }> | null) || []).map((row) => [
      String(row.lesson_id || ""),
      {
        status: String(row.status || "NOT_STARTED"),
        completionPercentage: Number(row.completion_percentage || 0),
      },
    ]),
  );

  return (
    <AppShell title="PostMotive Academy" eyebrow="Written lessons for Monday beta readiness">
      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        <p className="text-sm leading-6 text-slate-600">
          The Academy uses written lessons now and can add videos later without changing the lesson structure or progress tracking.
        </p>
      </section>
      <AcademyLessonList lessons={ACADEMY_LESSONS} progress={progress} />
    </AppShell>
  );
}
