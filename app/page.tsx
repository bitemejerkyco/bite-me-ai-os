import Sidebar from "../components/Sidebar";
import StatCard from "../components/StatCard";
export default function Home() {
  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <Sidebar />

      <div className="flex-1">
        <header className="bg-red-700 shadow-lg">
          <div className="max-w-7xl mx-auto px-8 py-6">
            <h1 className="text-4xl font-bold">Bite Me AI OS</h1>
            <p className="text-red-100 mt-2">Executive Dashboard</p>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-8">
          <div className="bg-gray-800 rounded-xl p-8 shadow-lg">
            <h2 className="text-3xl font-bold">
              Welcome, Keith!
            </h2>

            <p className="mt-4 text-gray-300">
              Congratulations! You just created your first reusable React component.
            </p>

            <StatCard
  title="Revenue Today"
  value="$0.00"/>
              <div className="bg-gray-700 rounded-lg p-6">
                <h3 className="text-sm text-gray-400">Wholesale Leads</h3>
                <p className="text-3xl font-bold mt-2">0</p>
              </div>

              <div className="bg-gray-700 rounded-lg p-6">
                <h3 className="text-sm text-gray-400">Tasks</h3>
                <p className="text-3xl font-bold mt-2">0</p>
              </div>

              <div className="bg-gray-700 rounded-lg p-6">
                <h3 className="text-sm text-gray-400">AI Jobs</h3>
                <p className="text-3xl font-bold mt-2">0</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}