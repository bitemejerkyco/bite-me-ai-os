export default function AmazonAdsInsightsLoading() {
  return (
    <div className="min-h-screen bg-white px-4 py-8 text-slate-900 md:px-8" aria-busy="true">
      <div className="mx-auto max-w-7xl animate-pulse space-y-4">
        <p className="text-sm text-slate-700">Loading Amazon Ads insights...</p>
        <div className="h-10 w-72 rounded bg-slate-100" />
        <div className="h-24 rounded-2xl bg-white" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="h-20 rounded-2xl bg-white" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-white" />
      </div>
    </div>
  );
}
