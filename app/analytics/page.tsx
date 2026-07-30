import Link from "next/link";
import Sidebar from "@/components/Sidebar";

export default function AnalyticsIndexPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 md:flex-row">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="pm-glass mx-auto max-w-4xl rounded-[2rem] p-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-600">Performance intelligence</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Analytics</h1>
          <p className="mt-3 text-slate-600">
            Explore channel performance dashboards in sandbox mode.
          </p>
          <Link
            href="/analytics/amazon-ads"
            className="pm-primary-button mt-6 inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold"
          >
            Open Amazon Ads Insights
          </Link>
        </div>
      </main>
    </div>
  );
}
