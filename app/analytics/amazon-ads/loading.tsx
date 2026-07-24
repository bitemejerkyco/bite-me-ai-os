export default function AmazonAdsInsightsLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 md:px-8" aria-busy="true">
      <div className="mx-auto max-w-7xl animate-pulse space-y-4">
        <p className="text-sm text-zinc-300">Loading Amazon Ads insights...</p>
        <div className="h-10 w-72 rounded bg-zinc-800" />
        <div className="h-24 rounded-xl bg-zinc-900" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="h-20 rounded-xl bg-zinc-900" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-zinc-900" />
      </div>
    </div>
  );
}
