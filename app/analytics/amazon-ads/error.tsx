"use client";

export default function AmazonAdsInsightsError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-white px-4 py-8 text-slate-900 md:px-8">
      <div className="pm-glass mx-auto max-w-3xl rounded-3xl border border-violet-200 p-6">
        <h1 className="text-2xl font-bold text-rose-600">Amazon Ads Insights Unavailable</h1>
        <p className="mt-3 text-sm text-slate-700">
          The dashboard could not be loaded. This screen is read-only and uses sandbox data only.
        </p>
        <p className="mt-2 rounded bg-white p-3 font-mono text-xs text-slate-700">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md border border-amber-500/60 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-500/20"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
