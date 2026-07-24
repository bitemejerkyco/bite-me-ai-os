import { StatusBadge } from "@/components/ui/StatusBadge";

const services = [
  { name: "Next.js App", status: "active" as const },
  { name: "Database", status: "pending" as const },
  { name: "AI Engine", status: "inactive" as const },
  { name: "Storage", status: "inactive" as const },
];

export function PlatformHealth() {
  return (
    <div className="rounded-xl border border-[#222] bg-[#161616] p-5">
      <h2 className="text-sm font-semibold text-white">Platform Health</h2>
      <p className="mt-0.5 text-xs text-zinc-500">Service status overview</p>

      <ul className="mt-4 space-y-3">
        {services.map((service) => (
          <li key={service.name} className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">{service.name}</span>
            <StatusBadge
              label={
                service.status === "active"
                  ? "Operational"
                  : service.status === "pending"
                  ? "Connecting"
                  : "Not configured"
              }
              variant={service.status}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
