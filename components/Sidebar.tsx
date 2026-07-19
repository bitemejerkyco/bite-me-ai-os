export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-800 text-white min-h-screen p-6">
      <h2 className="text-2xl font-bold text-red-500 mb-8">
        Bite Me AI OS
      </h2>

      <nav className="space-y-4">
        <button className="block w-full text-left hover:text-red-400">
          📊 Dashboard
        </button>

        <button className="block w-full text-left hover:text-red-400">
          📢 Marketing
        </button>

        <button className="block w-full text-left hover:text-red-400">
          👥 CRM
        </button>

        <button className="block w-full text-left hover:text-red-400">
          📦 Inventory
        </button>

        <button className="block w-full text-left hover:text-red-400">
          🤖 AI Studio
        </button>

        <button className="block w-full text-left hover:text-red-400">
          📈 Analytics
        </button>

        <button className="block w-full text-left hover:text-red-400">
          ⚙️ Settings
        </button>
      </nav>
    </aside>
  );
}