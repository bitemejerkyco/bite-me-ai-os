import Link from "next/link";
import Sidebar from "@/components/Sidebar";

export default function AnalyticsIndexPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 md:flex-row">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-red-500/30 bg-black/50 p-8">
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="mt-3 text-zinc-300">
            Explore channel performance dashboards in sandbox mode.
          </p>
          <Link
            href="/analytics/amazon-ads"
            className="mt-6 inline-flex rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
          >
            Open Amazon Ads Insights
          </Link>
        </div>
      </main>
    </div>
  );
}
