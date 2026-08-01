import type { DataCoverageModel } from "@/features/marketing-director/data-coverage";

export default function DataCoverageNotice({ coverage }: { coverage: DataCoverageModel }) {
  if (!coverage.warning) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-800">
        Data quality is healthy. Recommendations are based on connected workspace sources.
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
      {coverage.warning}
    </section>
  );
}
