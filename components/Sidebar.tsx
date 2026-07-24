import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-full bg-gray-800 text-white p-6 md:min-h-screen md:w-64">
      <h2 className="text-2xl font-bold text-red-500 mb-8">
        Bite Me AI OS
      </h2>

      <nav className="grid grid-cols-2 gap-3 md:block md:space-y-4">
        <Link href="/" className="block w-full text-left hover:text-red-400">
          📊 Dashboard
        </Link>

        <span className="block w-full text-left text-zinc-400">
          📢 Marketing
        </span>

        <span className="block w-full text-left text-zinc-400">
          🤖 AI Studio
        </span>

        <Link href="/analytics" className="block w-full text-left hover:text-red-400">
          📈 Analytics
        </Link>

        <Link href="/analytics/amazon-ads" className="block w-full text-left hover:text-red-400">
          🛒 Amazon Ads Insights
        </Link>

        <span className="block w-full text-left text-zinc-400">
          ⚙️ Settings
        </span>
      </nav>
    </aside>
  );
}