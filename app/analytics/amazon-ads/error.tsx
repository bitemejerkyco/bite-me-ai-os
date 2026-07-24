"use client";

export default function AmazonAdsInsightsError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 md:px-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/40 bg-black/70 p-6">
        <h1 className="text-2xl font-bold text-red-300">Amazon Ads Insights Unavailable</h1>
        <p className="mt-3 text-sm text-zinc-300">
          The dashboard could not be loaded. This screen is read-only and uses sandbox data only.
        </p>
        <p className="mt-2 rounded bg-zinc-900 p-3 font-mono text-xs text-zinc-300">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md border border-amber-500/60 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
