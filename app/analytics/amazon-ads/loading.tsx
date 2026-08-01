export default function AmazonAdsInsightsLoading() {
  return (
    <div className="min-h-screen px-4 py-8 text-slate-900 md:px-8" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="pm-glass-premium rounded-[2rem] p-5">
          <div className="pm-skeleton h-4 w-48" />
          <div className="mt-3 pm-skeleton h-10 w-72" />
          <div className="mt-3 pm-skeleton h-5 w-80" />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="pm-glass-premium rounded-2xl p-3">
              <div className="pm-skeleton h-3 w-20" />
              <div className="mt-3 pm-skeleton h-7 w-12" />
            </div>
          ))}
        </div>

        <div className="pm-glass-premium rounded-2xl p-4">
          <div className="pm-skeleton h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
